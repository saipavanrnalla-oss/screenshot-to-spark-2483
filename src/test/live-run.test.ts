import { describe, expect, it } from "vitest";
import { BOOTH_FILE, parseDueFile, runStep, resolveCase, stagePolicy, startRun, type RunState } from "@/engine/live-run";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { prepare } from "@/components/r1/wf-model";

const g = { R1: prepare(SEED_GRAPHS["R1"]!), R8: prepare(SEED_GRAPHS["R8"]!) };

function runToEnd(s: RunState, reply: Parameters<typeof runStep>[2] = "As the customer would"): RunState {
  let cur = s;
  for (let i = 0; i < 60 && !cur.done; i++) {
    if (cur.waitingCase) cur = resolveCase(g[cur.graphId], cur, "Test caller", cur.waitingCase.team === "Revival underwriting" ? "Documents in" : "Will pay");
    else cur = runStep(g[cur.graphId], cur, reply);
  }
  return cur;
}

describe("live run", () => {
  const { rows, problems, missing } = parseDueFile(BOOTH_FILE);

  it("reads the booth file", () => {
    expect(missing).toEqual([]);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(4);
  });

  it("stages each policy with a reason and an entry step", () => {
    const s = rows.map((r) => stagePolicy(r));
    expect(s[0]).toMatchObject({ workflowId: "R1", stage: "Renewal window", entryNodeId: "early" });
    expect(s[1]).toMatchObject({ workflowId: "R1", entryNodeId: "t45" });
    expect(s[2]).toMatchObject({ workflowId: "R8", stage: "Renewal window", entryNodeId: "ad" });
    expect(s[3]).toMatchObject({ workflowId: "R1", stage: "Grace Period", entryNodeId: "rehit" });
    for (const x of s) expect(x.reasons.length).toBeGreaterThan(1);
  });

  it("a low-propensity policy gets a call, a payment link after 'will pay', and renews when paid", () => {
    const r = rows[0]!;
    let run = startRun(r, stagePolicy(r), "test.csv")!;
    run = runStep(g.R1, run, "Will pay");
    expect(run.events.some((e) => e.kind === "call" && e.disposition === "Promise to pay")).toBe(true);
    expect(run.events.some((e) => e.kind === "whatsapp" && /payment link/i.test(e.title))).toBe(true);
    const end = runToEnd(run, "Pays now");
    expect(end.done).toBe(true);
    expect(end.endState).toMatch(/Renewed/);
  });

  it("'wants an explanation' adds a product explanation call", () => {
    const r = rows[0]!;
    const run = runStep(g.R1, startRun(r, stagePolicy(r), "test.csv")!, "Wants an explanation");
    expect(run.events.filter((e) => e.kind === "call")).toHaveLength(2);
    expect(run.events.some((e) => e.title.startsWith("Product explanation call"))).toBe(true);
  });

  it("every booth policy reaches an end state", () => {
    for (const r of rows) {
      const st = stagePolicy(r);
      const end = runToEnd(startRun(r, st, "test.csv")!);
      expect(end.done, r.policy).toBe(true);
    }
  });
});
