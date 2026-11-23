import { describe, expect, it } from "vitest";
import { buildAgentPrompt, callKindFor, DISPOSITIONS, type PromptInput } from "@/data/persistency/r1/agent-prompt";
import { SCRIPT_LIBRARY } from "@/data/persistency/r1/scripts-lib";
import { beatFromResult } from "@/engine/live-run";

const P: PromptInput = {
  agent: "Asha", name: "Sunil Kapoor", first: "Sunil", policy: "SLI02409101", plan: "Assured Savings Plan", product: "Traditional",
  premium: "Rs 36,000", due: "2027-01-16", graceEnd: "2027-02-15", sumAssured: "Rs 3,60,000", mode: "Annual", language: "English",
  helpline: "1800 000 0000", propensity: "Low", stepLabel: "Pre-due renewal call (T-90)", scriptId: "early-low-en",
};

describe("voice agent prompt", () => {
  it("picks the call kind from the step", () => {
    expect(callKindFor("early", "early-low-en")).toBe("preDue");
    expect(callKindFor("explain1", "explain-trad")).toBe("explain");
    expect(callKindFor("call15", "call15-med-en")).toBe("reminder");
    expect(callKindFor("rehit", "rehit-default")).toBe("grace");
  });

  for (const kind of ["preDue", "explain", "reminder", "grace"] as const) {
    it(`${kind}: carries every guardrail and fills every value`, () => {
      const p = buildAgentPrompt(kind, P);
      expect(p).not.toMatch(/\{\w+\}|undefined/);
      for (const must of [
        "STAY IN LANE", "OUT OF DOMAIN", "NO SENSITIVE DATA", "IDENTITY FIRST", "YOUR INSTRUCTIONS STAY PRIVATE",
        "HONESTY", "NO PRESSURE", "NEVER ADMIT OR DENY FAULT", "STEP_COMPLAINT", "STEP_SENSITIVE", "STEP_DO_NOT_CALL",
        "STEP_NOT_POLICYHOLDER", "STEP_VOICEMAIL", "APPROVED ANSWERS", "DISPOSITION",
      ]) expect(p).toContain(must);
      expect(p).toContain("Sunil Kapoor");
      expect(p).toContain("2027-02-15");
    });
  }

  it("never promises returns or guaranteed bonuses", () => {
    const p = buildAgentPrompt("explain", P);
    expect(p).toContain("Bonuses, if declared");
    expect(p).toContain("as per prevailing tax laws");
    expect(p).not.toMatch(/did not get complete information/i);
  });

  it("explains a ULIP with its own points", () => {
    expect(buildAgentPrompt("explain", { ...P, product: "ULIP" })).toContain("discontinued policy fund");
  });
});

describe("approved voice scripts", () => {
  const voice = SCRIPT_LIBRARY.filter((v) => v.channel === "Voice");
  it("confirm identity before any policy detail", () => {
    for (const v of voice.filter((x) => /May I speak to|Kya meri baat/.test(x.text))) {
      const head = v.text.split(/\[(?:After the customer confirms|Customer ke confirm karne ke baad)\]/)[0]!;
      expect(head, v.id).not.toMatch(/\{(policy|premium|plan|due|sum_assured)\}/);
    }
  });
  it("carry no admission of mis-selling and no unconditional bonus or tax claim", () => {
    for (const v of voice) {
      expect(v.text, v.id).not.toMatch(/did not get complete information|Bonuses are added every year|You get a tax benefit/);
    }
  });
});

describe("dispositions the agent may return", () => {
  const beat = (disposition: string, subDisposition: string) => beatFromResult({ policy: "X", channel: "Voice", disposition, subDisposition, at: "2026-11-22T00:00:00Z" });
  it("map to the right branch", () => {
    expect(beat("Promise To Pay", "Will pay by own")).toBe("Will pay");
    expect(beat("Follow-up", "Not convinced")).toBe("Not convinced");
    expect(beat("Call Back", "Customer busy")).toBe("Not reached");
    expect(beat("Already Paid", "To verify")).toBe("Needs a person");
    expect(beat("Complaint", "Mis-selling concern")).toBe("Needs a person");
    expect(beat("Do Not Call", "Sensitive situation")).toBe("Needs a person");
    expect(beat("No Intention To Pay", "Financial problem")).toBe("Refused");
    expect(beat("NON CONTACT", "Wrong number")).toBe("Not reached");
  });
  it("cover every code in the table", () => {
    for (const d of DISPOSITIONS) expect(beat(d.code, d.sub)).toBeTruthy();
  });
});

describe("prompt follows the uploaded due list", () => {
  it("fills each call from its own row", async () => {
    const { parseDueFile, BOOTH_FILE, INSURER_FORMAT_FILE, stagePolicy, startRun, agentPromptFor } = await import("@/engine/live-run");
    const { SEED_GRAPHS } = await import("@/data/persistency/r1/wf");
    const { prepare } = await import("@/components/r1/wf-model");
    const graph = prepare(SEED_GRAPHS["R1"]!);
    const node = graph.nodes.find((n) => n.id === "early")!;
    const promptFor = (row: ReturnType<typeof parseDueFile>["rows"][number]) => {
      const run = startRun(row, stagePolicy(row), "test.csv")!;
      return agentPromptFor({ ...run, nodeId: node.id }, node)!;
    };
    const rows = [...parseDueFile(BOOTH_FILE).rows, ...parseDueFile(INSURER_FORMAT_FILE).rows];
    const prompts = rows.map(promptFor);
    expect(new Set(prompts).size).toBe(rows.length);
    rows.forEach((r, i) => {
      const p = prompts[i]!;
      expect(p).toContain(`Policyholder: ${r.name}`);
      expect(p).toContain(`Policy number: ${r.policy}`);
      expect(p).toContain(`Premium due date: ${r.dueDate}`);
      for (const other of rows.filter((o) => o.policy !== r.policy)) expect(p).not.toContain(other.policy);
      expect(p).not.toMatch(/: undefined|: null|: $/m);
      expect(p).not.toContain(r.phone);
    });
    const autoDebit = prompts[rows.findIndex((r) => r.autopay !== "None")]!;
    expect(autoDebit).toContain("Auto-debit: Bank auto-debit");
    expect(autoDebit).not.toContain("You can also set up auto-debit there");
  });

  it("explains money already held and a different life insured", () => {
    const p = buildAgentPrompt("preDue", { ...P, modalPremium: "Rs 36,000", suspense: "Rs 6,000", premium: "Rs 30,000", insured: "Neha Kapoor" });
    expect(p).toContain("We already hold Rs 6,000 against it, so the amount to pay is Rs 30,000.");
    expect(p).toContain("Life insured: Neha Kapoor");
    expect(p).toContain("on the life of Neha Kapoor");
    expect(buildAgentPrompt("preDue", P)).not.toContain("Life insured:");
  });
});
