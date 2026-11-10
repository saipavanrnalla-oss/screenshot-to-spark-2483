import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { prepare } from "@/components/r1/wf-model";
import {
  beatFromResult, contactFor, resolveCase, runStep, settle, startRun, stagePolicy,
  type ChannelResult, type DueRow, type Reply, type RunState, type StoryBeat,
} from "@/engine/live-run";

/** Uploaded due lists and the policies running from them. Kept in the browser; the live loop uses /api/live. */
export const LIVE_KEY = "pct-live-v3";

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
  /** Live use cases place real calls and messages when the server has a dispatch address and this is on. */
  liveOn: boolean;
  /** Set from /api/live/config: whether the server forwards to the voice and WhatsApp platform. */
  serverLive: boolean;
  lastPoll: string | null;
  addUpload: (fileName: string, rows: DueRow[]) => Upload;
  setReply: (policy: string, r: Reply) => void;
  setPhone: (policy: string, phone: string) => void;
  setLiveOn: (on: boolean) => void;
  loadConfig: () => Promise<void>;
  step: (policy: string) => Promise<void>;
  stepAll: (policies: string[]) => Promise<void>;
  poll: () => Promise<void>;
  /** Apply a result by hand when the live one does not arrive: the scenario's answer, or a given one. */
  applyByHand: (policy: string, beat?: StoryBeat) => void;
  resolve: (policy: string, by: string, outcome: Parameters<typeof resolveCase>[3]) => void;
  clear: () => void;
}

/** A run places real calls and messages only for live use cases, with the server set up and the switch on. */
export function isLiveRun(run: RunState, s: Pick<LiveState, "liveOn" | "serverLive">): boolean {
  return !!run.story?.live && s.liveOn && s.serverLive;
}

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

function payLinkFor(run: RunState): string {
  const q = new URLSearchParams({ amount: (run.row.netCollectable || run.row.premium).toLocaleString("en-IN"), plan: run.row.plan, name: run.row.name });
  return `${origin()}/pay/${run.row.policy}?${q.toString()}`;
}

export const useLive = create<LiveState>()(
  persist(
    (set, get) => {
      const put = (run: RunState) => set({ runs: { ...get().runs, [run.id]: run } });

      /** Run the current step, or, for a live contact step, send it out and wait for the result. */
      const advance = async (run: RunState, reply: Reply): Promise<void> => {
        if (run.done || run.waitingCase || run.live) return;
        const g = graphs[run.graphId];
        const node = g.nodes.find((n) => n.id === run.nodeId);
        const contact = node ? contactFor(run, node) : undefined;
        if (node && contact && isLiveRun(run, get()) && reply === "As the customer would" && !run.paid) {
          const requestId = `${run.row.policy}-${node.id}-${Date.now().toString(36)}`;
          const withLink: RunState = { ...run, payLink: payLinkFor(run) };
          const text = contactFor(withLink, node)?.text ?? contact.text;
          const sentAt = new Date().toISOString();
          put({
            ...withLink,
            live: { requestId, nodeId: node.id, channel: contact.channel, sentAt, phone: run.row.phone },
            events: [...withLink.events, {
              id: `${run.id}-L${withLink.events.length + 1}`, day: run.day, kind: "system", nodeId: node.id, by: "Live dispatch",
              title: contact.channel === "Voice" ? `Live call placed to ${run.row.phone}` : `Live WhatsApp sent to ${run.row.phone}`,
              detail: contact.channel === "Voice" ? "Waiting for the disposition and transcript from the voice platform" : "Waiting for the customer to pay on the link",
            }],
          });
          try {
            const res = await fetch("/api/live/dispatch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestId, policy: run.row.policy, customer: run.row.name, phone: run.row.phone, language: run.row.language,
                step: node.id, stepLabel: node.label, channel: contact.channel, scriptId: contact.scriptId, scriptName: contact.scriptName, text,
                payLink: withLink.payLink, premium: run.row.netCollectable || run.row.premium, dueDate: run.row.dueDate, plan: run.row.plan,
                propensity: run.row.band, workflow: run.graphId,
              }),
            });
            const body = (await res.json().catch(() => ({}))) as { forwarded?: boolean; reason?: string };
            if (!body.forwarded) {
              const cur = get().runs[run.id];
              if (cur?.live?.requestId === requestId) {
                put({ ...cur, events: [...cur.events, { id: `${cur.id}-L${cur.events.length + 1}`, day: cur.day, kind: "system", nodeId: node.id, by: "Live dispatch", title: "The platform did not accept the request", detail: body.reason ?? `Status ${res.status}` }] });
              }
            }
          } catch {
            /* the board shows the wait; the operator can apply the scenario answer by hand */
          }
          return;
        }
        put(runStep(g, run, reply));
      };

      const applyResult = (run: RunState, beat: StoryBeat, r?: ChannelResult) => {
        if (!run.live) return;
        const ready: RunState = {
          ...run,
          live: undefined,
          liveResult: { nodeId: run.live.nodeId, beat, disposition: r?.disposition, transcript: r?.transcript, recordingUrl: r?.recordingUrl },
        };
        put(runStep(graphs[run.graphId], ready, "As the customer would"));
      };

      return {
        uploads: [],
        runs: {},
        replies: {},
        liveOn: true,
        serverLive: false,
        lastPoll: null,
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
            runs[r.policy] = settle(graphs[run.graphId], run);
            started += 1;
          }
          const up: Upload = { id: `UP-${Date.now().toString(36)}`, fileName, at: new Date().toISOString(), rows: rows.length, started, skipped };
          set({ runs, uploads: [up, ...get().uploads].slice(0, 10) });
          return up;
        },
        setReply: (policy, r) => set({ replies: { ...get().replies, [policy]: r } }),
        setPhone: (policy, phone) => {
          const run = get().runs[policy];
          if (run) put({ ...run, row: { ...run.row, phone } });
        },
        setLiveOn: (on) => set({ liveOn: on }),
        loadConfig: async () => {
          try {
            const res = await fetch("/api/live/config");
            const body = (await res.json()) as { live?: boolean };
            set({ serverLive: !!body.live });
          } catch {
            set({ serverLive: false });
          }
        },
        step: async (policy) => {
          const run = get().runs[policy];
          if (!run) return;
          const reply = get().replies[policy] ?? "As the customer would";
          set({ replies: { ...get().replies, [policy]: "As the customer would" } });
          await advance(run, reply);
        },
        stepAll: async (policies) => {
          const replies = { ...get().replies };
          for (const p of policies) delete replies[p];
          const want = Object.fromEntries(policies.map((p) => [p, get().replies[p] ?? "As the customer would"]));
          set({ replies });
          await Promise.all(policies.map((p) => {
            const run = get().runs[p];
            return run ? advance(run, want[p] as Reply) : Promise.resolve();
          }));
        },
        poll: async () => {
          const waiting = Object.values(get().runs).filter((r) => r.live);
          if (!waiting.length) return;
          const since = waiting.reduce((a, r) => (r.live!.sentAt < a ? r.live!.sentAt : a), waiting[0]!.live!.sentAt);
          try {
            const res = await fetch(`/api/live/result?since=${encodeURIComponent(since)}`);
            const body = (await res.json()) as { results?: ChannelResult[]; now?: string };
            for (const r of body.results ?? []) {
              const run = get().runs[r.policy];
              if (!run?.live || r.at < run.live.sentAt) continue;
              if (r.requestId && r.requestId !== run.live.requestId) continue;
              if (r.channel !== run.live.channel && !(r.channel === "WhatsApp" && r.paid)) continue;
              applyResult(run, beatFromResult({ ...r, channel: run.live.channel === "WhatsApp" ? "WhatsApp" : r.channel }), r);
            }
            set({ lastPoll: body.now ?? new Date().toISOString() });
          } catch {
            /* try again on the next tick */
          }
        },
        applyByHand: (policy, beat) => {
          const run = get().runs[policy];
          if (!run?.live) return;
          const fallback = run.story?.beats[run.live.nodeId] ?? (run.live.channel === "WhatsApp" ? "No reply" : "Not reached");
          applyResult(run, beat ?? fallback);
        },
        resolve: (policy, by, outcome) => {
          const run = get().runs[policy];
          if (!run) return;
          set({ runs: { ...get().runs, [policy]: resolveCase(graphs[run.graphId], run, by, outcome) } });
        },
        clear: () => set({ uploads: [], runs: {}, replies: {} }),
      };
    },
    {
      name: LIVE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({ uploads: s.uploads, runs: s.runs, replies: s.replies, liveOn: s.liveOn }),
    },
  ),
);

/** The first step a policy will act on once started, with the words it will use there. */
export function previewEntry(row: DueRow): { nodeId: string; label: string; type: string } | undefined {
  const st = stagePolicy(row);
  const run = startRun(row, st, "preview");
  if (!run) return undefined;
  const g = graphs[run.graphId];
  const s = settle(g, run);
  const n = g.nodes.find((x) => x.id === s.nodeId);
  return n ? { nodeId: n.id, label: n.label, type: n.type } : undefined;
}
