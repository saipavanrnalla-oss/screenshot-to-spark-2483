import { describe, expect, it } from "vitest";
import { BASE_POLICIES, SEED_RULES, persistency, requiredInstalment, collection, countByStage, type Policy } from "@/data/persistency";
import { applyEvent, evaluate, type EngineContext } from "@/engine/persistency";

const ctx: EngineContext = {
  activeCohortSet: { ULIP: "insurer", Traditional: "insurer", Term: "starter" },
  receipts: new Set(),
  killSwitchGlobal: false,
  killedWorkflows: new Set(),
  staleWorkflows: new Set(),
};

function find(pred: (p: Policy) => boolean): Policy {
  const p = BASE_POLICIES.find(pred);
  if (!p) throw new Error("no seeded policy matches");
  return p;
}

describe("seeded book", () => {
  it("has 12,000 policies with the brief's stage shares", () => {
    expect(BASE_POLICIES).toHaveLength(12000);
    const c = countByStage(BASE_POLICIES);
    expect(c["Early lapse"] / 12000).toBeCloseTo(0.1, 1);
    expect(c["Late lapse"] / 12000).toBeCloseTo(0.08, 1);
    expect(c.Warming / 12000).toBeGreaterThan(0.49);
    expect(c.Warming / 12000).toBeLessThan(0.55);
  });

  it("keeps persistency plausible: 13M in the low-to-mid 80s, 61M around 55-62%", () => {
    const rows = persistency(BASE_POLICIES);
    expect(rows[0]!.premiumWeighted).toBeGreaterThan(0.8);
    expect(rows[0]!.premiumWeighted).toBeLessThan(0.88);
    expect(rows[4]!.premiumWeighted).toBeGreaterThan(0.53);
    expect(rows[4]!.premiumWeighted).toBeLessThan(0.64);
  });

  it("splits the ₹182 Cr monthly plan across products", () => {
    expect(collection(BASE_POLICIES, "All").planCr).toBeCloseTo(182, 5);
    const sum = (["ULIP", "Traditional", "Term"] as const).reduce((s, p) => s + collection(BASE_POLICIES, p).planCr, 0);
    expect(sum).toBeCloseTo(182, 5);
  });

  it("uses 15 days of grace for Monthly and 30 for other modes", () => {
    expect(find((p) => p.paymentMode === "Monthly").graceDays).toBe(15);
    expect(find((p) => p.paymentMode === "Annual").graceDays).toBe(30);
    expect(find((p) => p.paymentMode === "Quarterly").graceDays).toBe(30);
  });
});

describe("mode rule", () => {
  it("13M counts the 13th monthly, 5th quarterly, 3rd half-yearly and 2nd annual premium", () => {
    expect(requiredInstalment(13, "Monthly")).toBe(13);
    expect(requiredInstalment(13, "Quarterly")).toBe(5);
    expect(requiredInstalment(13, "Half-yearly")).toBe(3);
    expect(requiredInstalment(13, "Annual")).toBe(2);
  });
});

describe("engine precedence", () => {
  it("a hold freezes outreach through the G1 guardrail", () => {
    const p = { ...find((x) => x.state === "Grace"), state: "Complaint-hold" as const };
    const d = evaluate(p, SEED_RULES, ctx);
    expect(d.ruleId).toBe("G1");
    expect(d.frozen).toBe(true);
  });

  it("insurer defaults beat a Desible rule that matches more dimensions", () => {
    const p = find((x) => x.channel === "Bancassurance" && x.state === "Renewal window open" && x.advisorStatus === "Left" && x.annualisedPremium < 500000);
    expect(evaluate(p, SEED_RULES, ctx).ruleId).toBe("D1");
  });

  it("the rule matching more dimensions wins over a broader one", () => {
    const p = find((x) => x.product === "ULIP" && x.policyYear === 1 && x.lifecycleStage === "Warming" && x.touchesLast30d < 8 && x.state.startsWith("Warming"));
    expect(evaluate(p, SEED_RULES, ctx).ruleId).toBe("R08");
  });

  it("logs a conflict when two rules tie on level, dimensions and priority", () => {
    const p = { ...find((x) => x.state === "Grace"), paymentMethod: "Cash/cheque" as const, insurerCohort: "A5" as const, product: "ULIP" as const, channel: "Agency" as const, annualisedPremium: 60000, reasonCode: "Not reached" as const, touchesLast30d: 2 };
    const d = evaluate(p, SEED_RULES, ctx);
    expect(["R03", "R04"]).toContain(d.ruleId);
    expect(d.conflictWith?.length).toBe(1);
  });

  it("cancels a payment action when the receipt arrived meanwhile", () => {
    const p = find((x) => x.state === "Grace" && x.channel !== "Bancassurance" && x.touchesLast30d < 8);
    const d = evaluate(p, SEED_RULES, { ...ctx, receipts: new Set([p.policyId]) });
    expect(d.cancelledReason).toBe("Paid meanwhile");
  });

  it("the kill switch stops actions", () => {
    const p = find((x) => x.state === "Grace" && x.touchesLast30d < 8);
    expect(evaluate(p, SEED_RULES, { ...ctx, killSwitchGlobal: true }).cancelledReason).toBe("Kill switch on");
  });
});

describe("events", () => {
  it("payment on an early-lapsed policy revives it", () => {
    const p = find((x) => x.lifecycleStage === "Early lapse" && x.state === "Lapsed early");
    expect(applyEvent(p, "Payment received").patch.state).toBe("Revived");
  });

  it("wants out moves the policy to surrender intent and routes to retention", () => {
    const p = find((x) => x.state === "Renewal window open");
    const after = { ...p, ...applyEvent(p, "Customer says wants out").patch } as Policy;
    expect(after.state).toBe("Surrender-intent");
    expect(evaluate(after, SEED_RULES, ctx).ruleId).toBe("G4");
  });
});
