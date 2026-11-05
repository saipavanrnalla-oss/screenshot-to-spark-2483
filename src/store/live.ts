import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { prepare } from "@/components/r1/wf-model";
import { resolveCase, runStep, startRun, stagePolicy, type DueRow, type Reply, type RunState } from "@/engine/live-run";

/** Uploaded due lists and the policies running from them. Kept in the browser; no backend. */
export const LIVE_KEY = "pct-live-v1";

const graphs = { R1: prepare(SEED_GRAPHS["R1"]!), R8: prepare(SEED_GRAPHS["R8"]!) };
export const liveGraph = (id: "R1" | "R8") => graphs[id];

export interface Upload {
  id: string;
  fileName: string;
  at: string;
  rows: number;
  started: number;
  skipped: { policy: string; why: string }[];
}

interface LiveState {
  uploads: Upload[];
  runs: Record<string, RunState>;
  replies: Record<string, Reply>;
  addUpload: (fileName: string, rows: DueRow[]) => Upload;
  setReply: (policy: string, r: Reply) => void;
  step: (policy: string) => void;
  stepAll: (policies: string[]) => void;
  resolve: (policy: string, by: string, outcome: Parameters<typeof resolveCase>[3]) => void;
  clear: () => void;
}

export const useLive = create<LiveState>()(
  persist(
    (set, get) => ({
      uploads: [],
      runs: {},
      replies: {},
      addUpload: (fileName, rows) => {
        const runs = { ...get().runs };
        const skipped: Upload["skipped"] = [];
        let started = 0;
        for (const r of rows) {
          const st = stagePolicy(r);
          const run = startRun(r, st, fileName);
          if (!run) {
            skipped.push({ policy: r.policy, why: st.reasons[0] ?? "Not in these workflows" });
            continue;
          }
          runs[r.policy] = run;
          started += 1;
        }
        const up: Upload = { id: `UP-${Date.now().toString(36)}`, fileName, at: new Date().toISOString(), rows: rows.length, started, skipped };
        set({ runs, uploads: [up, ...get().uploads].slice(0, 10) });
        return up;
      },
      setReply: (policy, r) => set({ replies: { ...get().replies, [policy]: r } }),
      step: (policy) => {
        const run = get().runs[policy];
        if (!run) return;
        const next = runStep(graphs[run.graphId], run, get().replies[policy] ?? "As the customer would");
        set({ runs: { ...get().runs, [policy]: next }, replies: { ...get().replies, [policy]: "As the customer would" } });
      },
      stepAll: (policies) => {
        const runs = { ...get().runs };
        for (const p of policies) {
          const run = runs[p];
          if (run && !run.done && !run.waitingCase) runs[p] = runStep(graphs[run.graphId], run, get().replies[p] ?? "As the customer would");
        }
        set({ runs });
      },
      resolve: (policy, by, outcome) => {
        const run = get().runs[policy];
        if (!run) return;
        set({ runs: { ...get().runs, [policy]: resolveCase(graphs[run.graphId], run, by, outcome) } });
      },
      clear: () => set({ uploads: [], runs: {}, replies: {} }),
    }),
    { name: LIVE_KEY, storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);
