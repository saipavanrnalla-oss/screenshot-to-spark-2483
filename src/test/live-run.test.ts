import { describe, expect, it } from "vitest";
import { BOOTH_FILE, SAMPLE_FILE, beatFromResult, storyFor, parseDueFile, runStep, resolveCase, scriptFor, settle, stagePolicy, startRun, type RunState } from "@/engine/live-run";
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

  it("reads the booth file with Low, Medium and High propensity", () => {
    expect(missing).toEqual([]);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(7);
    expect(rows.slice(0, 5).map((r) => r.band)).toEqual(["Low", "Low", "Medium", "High", "Low"]);
  });

  it("stages each policy with a reason and an entry step", () => {
    const s = rows.map((r) => stagePolicy(r));
    expect(s[0]).toMatchObject({ workflowId: "R1", stage: "Renewal window", entryNodeId: "early" });
    expect(s[1]).toMatchObject({ workflowId: "R1", entryNodeId: "early" });
    expect(s[2]).toMatchObject({ workflowId: "R1", entryNodeId: "ad" });
    expect(s[3]).toMatchObject({ workflowId: "R1", entryNodeId: "ad" });
    expect(s[4]).toMatchObject({ workflowId: "R1", stage: "Grace Period", entryNodeId: "rehit" });
    expect(s[5]).toMatchObject({ workflowId: "R8", entryNodeId: "ad" });
    for (const x of s) expect(x.reasons.length).toBeGreaterThan(1);
  });

  it("the same step gives different words to different propensity", () => {
    const [, , m, h] = rows;
    const sm = scriptFor(m!, stagePolicy(m!), "link15")!;
    const sh = scriptFor(h!, stagePolicy(h!), "link15")!;
    expect(sm.v.id).not.toBe(sh.v.id);
    expect(sm.rule).toContain("Medium propensity");
    expect(sh.rule).toContain("High propensity");
    const a = rows[0]!;
    expect(scriptFor(a, stagePolicy(a), "early")!.v.id).toBe("early-low-en");
  });

  it("use case 1: call, disposition read, payment link on WhatsApp as the next step, renewed", () => {
    let run = begin(SAMPLE_FILE, 0);
    expect(run.nodeId).toBe("early");
    run = runStep(g.R1, run);
    expect(run.events.some((e) => e.kind === "call" && e.disposition === "Promise to pay")).toBe(true);
    expect(run.nodeId).toBe("elink");
    const end = runToEnd(run);
    expect(end.endState).toBe("Renewed");
    expect(kinds(end)).toEqual(["call", "whatsapp", "payment"]);
  });

  it("use case 2a: not convinced, an explanation call as its own step, then the link", () => {
    let run = begin(SAMPLE_FILE, 1);
    run = runStep(g.R1, run);
    expect(run.events.some((e) => e.kind === "call" && e.disposition === "Follow-up: not convinced")).toBe(true);
    expect(run.nodeId).toBe("explain1");
    const end = runToEnd(run);
    expect(end.endState).toBe("Renewed");
    expect(kinds(end)).toEqual(["call", "call", "whatsapp", "payment"]);
  });

  it("use case 2b: two WhatsApp messages unpaid, then a call, then the link", () => {
    const run = begin(SAMPLE_FILE, 2);
    expect(run.nodeId).toBe("link15");
    const end = runToEnd(run);
    expect(end.endState).toBe("Renewed");
    expect(kinds(end)).toEqual(["whatsapp", "whatsapp", "call", "whatsapp", "payment"]);
  });

  it("High propensity stays digital: no call before the due date", () => {
    const end = runToEnd(begin(SAMPLE_FILE, 3));
    expect(end.endState).toBe("Renewed");
    expect(kinds(end)).toEqual(["whatsapp", "whatsapp", "payment"]);
  });

  it("scenario 4: two refusals, the score drops below the line, the vendor takes it", () => {
    const end = runToEnd(begin(SAMPLE_FILE, 4));
    const scores = end.events.filter((e) => e.kind === "score").map((e) => e.worth!);
    expect(scores).toHaveLength(2);
    expect(scores[0]!.handOver).toBe(false);
    expect(scores[1]!.handOver).toBe(true);
    expect(end.events.some((e) => e.kind === "vendor")).toBe(true);
    expect(end.done).toBe(true);
  });

  it("a live result drives the next step and its transcript is kept", () => {
    let run = begin(SAMPLE_FILE, 0);
    run = { ...run, liveResult: { nodeId: "early", beat: beatFromResult({ policy: run.row.policy, channel: "Voice", disposition: "No Intention To Pay", subDisposition: "Financial problem", at: "" }), transcript: [{ who: "Customer", text: "Not this year." }] } };
    run = runStep(g.R1, run);
    const call = run.events.find((e) => e.kind === "call")!;
    expect(call.transcript).toEqual([{ who: "Customer", text: "Not this year." }]);
    expect(run.liveResult).toBeUndefined();
    expect(run.refusals).toBe(1);
  });

  it("maps the insurer's disposition codes", () => {
    const v = (disposition: string, sub?: string) => beatFromResult({ policy: "x", channel: "Voice", disposition, subDisposition: sub, at: "" });
    expect(v("Promise To Pay", "Will pay by own")).toBe("Will pay");
    expect(v("Follow-up", "Not convinced")).toBe("Not convinced");
    expect(v("NON CONTACT", "Switched off")).toBe("Not reached");
    expect(v("No Intention To Pay", "Misselling")).toBe("Refused");
    expect(v("Do Not Call")).toBe("Needs a person");
    expect(beatFromResult({ policy: "x", channel: "WhatsApp", paid: true, at: "" })).toBe("Pays on the link");
  });

  it("the score hands over after three refusals whatever the propensity", () => {
    expect(worthScore({ band: "High", calls: 3, unanswered: 0, refusals: 3, promise: false, brokenPromises: 0, daysPastDue: 2, unpaidLinks: 0, annualPremium: 50000 }).handOver).toBe(true);
    expect(worthScore({ band: "High", calls: 1, unanswered: 0, refusals: 1, promise: false, brokenPromises: 0, daysPastDue: 2, unpaidLinks: 0, annualPremium: 50000 }).handOver).toBe(false);
  });

  it("every call and message is listed for the real platform with its script", () => {
    const end = runToEnd(begin(SAMPLE_FILE, 2));
    expect(end.handoffs.filter((h) => h.channel === "WhatsApp" || h.channel === "Voice").every((h) => !!h.scriptId && !!h.text)).toBe(true);
  });

  it("an uploaded row replays a booth use case from its demo_use_case column", () => {
    const csv = SAMPLE_FILE.replace("SLI02409102,Farhan Ali,+919800000002", "TEST0001,Visitor,+919811111111");
    const row = parseDueFile(csv).rows[1]!;
    expect(row.policy).toBe("TEST0001");
    expect(storyFor(row)?.code).toBe("2a");
    const end = runToEnd(begin(csv, 1));
    expect(end.endState).toBe("Renewed");
    expect(kinds(end)).toEqual(["call", "call", "whatsapp", "payment"]);
  });

  it("every booth policy reaches an end state", () => {
    for (let i = 0; i < rows.length; i++) {
      const end = runToEnd(begin(BOOTH_FILE, i));
      expect(end.done, rows[i]!.policy).toBe(true);
    }
  });
});
