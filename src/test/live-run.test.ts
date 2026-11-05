import { describe, expect, it } from "vitest";
import { BOOTH_FILE, SAMPLE_FILE, parseDueFile, runStep, resolveCase, scriptFor, settle, stagePolicy, startRun, type RunState } from "@/engine/live-run";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { prepare } from "@/components/r1/wf-model";
import { worthScore } from "@/engine/worth-score";

const g = { R1: prepare(SEED_GRAPHS["R1"]!), R8: prepare(SEED_GRAPHS["R8"]!) };

function begin(text: string, i: number): RunState {
  const r = parseDueFile(text).rows[i]!;
  const run = startRun(r, stagePolicy(r), "test.csv")!;
  return settle(g[run.graphId], run);
}

function runToEnd(s: RunState, reply: Parameters<typeof runStep>[2] = "As the customer would"): RunState {
  let cur = s;
  for (let i = 0; i < 60 && !cur.done; i++) {
    if (cur.waitingCase) cur = resolveCase(g[cur.graphId], cur, "Test caller", cur.waitingCase.team === "Revival underwriting" ? "Documents in" : "Will pay");
    else cur = runStep(g[cur.graphId], cur, reply);
  }
  return cur;
}

const kinds = (s: RunState) => s.events.filter((e) => e.kind === "call" || e.kind === "whatsapp" || e.kind === "payment" || e.kind === "score" || e.kind === "vendor").map((e) => e.kind);

describe("live run", () => {
  const { rows, problems, missing } = parseDueFile(BOOTH_FILE);

  it("reads the booth file", () => {
    expect(missing).toEqual([]);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(6);
  });

  it("stages each policy with a reason and an entry step", () => {
    const s = rows.map((r) => stagePolicy(r));
    expect(s[0]).toMatchObject({ workflowId: "R1", stage: "Renewal window", entryNodeId: "early" });
    expect(s[1]).toMatchObject({ workflowId: "R1", entryNodeId: "ad" });
    expect(s[2]).toMatchObject({ workflowId: "R1", entryNodeId: "ad" });
    expect(s[3]).toMatchObject({ workflowId: "R1", stage: "Grace Period", entryNodeId: "rehit" });
    expect(s[4]).toMatchObject({ workflowId: "R8", entryNodeId: "ad" });
    for (const x of s) expect(x.reasons.length).toBeGreaterThan(1);
  });

  it("the same step gives different words to different bands", () => {
    const [, b, c] = rows;
    const sb = scriptFor(b!, stagePolicy(b!), "link15")!;
    const sc = scriptFor(c!, stagePolicy(c!), "link15")!;
    expect(sb.v.id).not.toBe(sc.v.id);
    expect(sb.rule).toContain("P6 to P10");
    expect(sc.rule).toContain("P1 to P5");
    const a = rows[0]!;
    expect(scriptFor(a, stagePolicy(a), "early")!.v.id).toBe("early-p13-hi");
  });

  it("scenario A: call, disposition read, payment link on WhatsApp as the next step, renewed", () => {
    let run = begin(SAMPLE_FILE, 0);
    expect(run.nodeId).toBe("early");
    run = runStep(g.R1, run);
    expect(run.events.some((e) => e.kind === "call" && e.disposition === "Promise to pay")).toBe(true);
    expect(run.nodeId).toBe("elink");
    const end = runToEnd(run);
    expect(end.endState).toBe("Renewed");
    expect(kinds(end)).toEqual(["call", "whatsapp", "payment"]);
  });

  it("scenario B: WhatsApp, no payment for 2 days, WhatsApp again, renewed with no call", () => {
    const run = begin(SAMPLE_FILE, 1);
    expect(run.nodeId).toBe("link15");
    const end = runToEnd(run);
    expect(end.endState).toBe("Renewed");
    expect(kinds(end)).toEqual(["whatsapp", "whatsapp", "payment"]);
    expect(end.day).toBe(2);
  });

  it("scenario C: two WhatsApp messages, then a call with an explanation, then the link", () => {
    const end = runToEnd(begin(SAMPLE_FILE, 2));
    expect(end.endState).toBe("Renewed");
    expect(kinds(end)).toEqual(["whatsapp", "whatsapp", "call", "call", "whatsapp", "payment"]);
    expect(end.events.some((e) => e.title.startsWith("Product explanation call"))).toBe(true);
  });

  it("scenario D: two refusals, the score drops below the line, the vendor takes it", () => {
    const end = runToEnd(begin(SAMPLE_FILE, 3));
    const scores = end.events.filter((e) => e.kind === "score").map((e) => e.worth!);
    expect(scores).toHaveLength(2);
    expect(scores[0]!.handOver).toBe(false);
    expect(scores[1]!.handOver).toBe(true);
    expect(end.events.some((e) => e.kind === "vendor")).toBe(true);
    expect(end.done).toBe(true);
  });

  it("the score hands over after three refusals whatever the band", () => {
    expect(worthScore({ band: 10, calls: 3, unanswered: 0, refusals: 3, promise: false, brokenPromises: 0, daysPastDue: 2, unpaidLinks: 0, annualPremium: 50000 }).handOver).toBe(true);
    expect(worthScore({ band: 8, calls: 1, unanswered: 0, refusals: 1, promise: false, brokenPromises: 0, daysPastDue: 2, unpaidLinks: 0, annualPremium: 50000 }).handOver).toBe(false);
  });

  it("every call and message is listed for the real platform with its script", () => {
    const end = runToEnd(begin(SAMPLE_FILE, 2));
    expect(end.handoffs.filter((h) => h.channel === "WhatsApp" || h.channel === "Voice").every((h) => !!h.scriptId && !!h.text)).toBe(true);
  });

  it("every booth policy reaches an end state", () => {
    for (let i = 0; i < rows.length; i++) {
      const end = runToEnd(begin(BOOTH_FILE, i));
      expect(end.done, rows[i]!.policy).toBe(true);
    }
  });
});
