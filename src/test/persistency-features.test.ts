import { describe, expect, it } from "vitest";
import { BASE_POLICIES, DEFAULT_WEIGHTS, PANEL_IDS_FOR_TEST, WORKFLOWS, WORKFLOW_GRAPHS, isHoldout, rebalanceWeights } from "./feature-imports";
import { PERSONAS } from "@/config/personas";
import { evaluate } from "@/engine/persistency";
import { usePersistencyStore } from "@/store/persistency";

const total = (w: typeof DEFAULT_WEIGHTS) => w.reduce((s, x) => s + x.weight, 0);

describe("starter scorecard weights", () => {
  it("keeps enabled weights at exactly 100 after moving one slider", () => {
    expect(total(DEFAULT_WEIGHTS)).toBe(100);
    const moved = rebalanceWeights(DEFAULT_WEIGHTS, "paymentMode", 30);
    expect(moved.find((w) => w.key === "paymentMode")?.weight).toBe(30);
    expect(total(moved)).toBe(100);
    expect(total(rebalanceWeights(moved, "region", 0))).toBe(100);
  });

  it("leaves the bureau factor out until a bureau file is mapped", () => {
    const moved = rebalanceWeights(DEFAULT_WEIGHTS, "region", 10);
    expect(moved.find((w) => w.key === "bureau")?.weight).toBe(4);
  });
});

describe("holdout", () => {
  it("puts about 15% of policies in the fixed holdout", () => {
    const share = BASE_POLICIES.filter(isHoldout).length / BASE_POLICIES.length;
    expect(share).toBeGreaterThan(0.14);
    expect(share).toBeLessThan(0.16);
  });
});

describe("personas and workflows", () => {
  it("has 14 personas, each with 1 to 6 known panels and a work queue", () => {
    expect(PERSONAS).toHaveLength(14);
    for (const p of PERSONAS) {
      expect(p.panels.length).toBeGreaterThan(0);
      expect(p.panels.length).toBeLessThanOrEqual(6);
      for (const id of p.panels) expect(PANEL_IDS_FOR_TEST).toContain(id);
      expect(p.nav).toContain("queues");
    }
  });

  it("has 18 workflows with full canvases for W1, R2, R4, L2, L3 and X1", () => {
    expect(WORKFLOWS).toHaveLength(19);
    expect(Object.keys(WORKFLOW_GRAPHS).sort()).toEqual(["L2", "L3", "R2", "R4", "W1", "X1"]);
    for (const g of Object.values(WORKFLOW_GRAPHS)) {
      expect(g.nodes.length).toBeGreaterThanOrEqual(8);
      expect(g.nodes.length).toBeLessThanOrEqual(12);
    }
  });
});

describe("approvals", () => {
  it("a proposed rule changes nothing until approved, then decides matching policies", () => {
    const store = usePersistencyStore.getState();
    store.resetDemo();
    const target = BASE_POLICIES.find((p) => p.state === "Grace" && p.paymentMethod === "Credit card SI" && p.touchesLast30d < 8)!;
    const rule = {
      id: "R-TEST", name: "Test: card payers in grace get Desible voice", stage: "Renewal window" as const, level: "rule" as const, priority: 1,
      when: { state: ["Grace"], paymentMethod: ["Credit card SI"], channel: [target.channel] },
      then: { workflowId: "R2", action: "Desible voice call", executor: "Desible", delayHours: 1 },
      effectiveFrom: "2026-10-28", needsApprovalFrom: "Head of Persistency", source: "Insurer rule" as const,
    };
    store.propose({ id: "PC-TEST", title: "test", source: "Rule edit", proposedBy: "test", at: "2026-10-28T05:00:00.000Z", rule });
    const ctx = { activeCohortSet: usePersistencyStore.getState().activeCohortSet, receipts: new Set<string>(), killSwitchGlobal: false, killedWorkflows: new Set<string>(), staleWorkflows: new Set<string>() };
    expect(evaluate(target, usePersistencyStore.getState().rules, ctx).ruleId).not.toBe("R-TEST");
    usePersistencyStore.getState().approve("PC-TEST");
    expect(evaluate(target, usePersistencyStore.getState().rules, ctx).ruleId).toBe("R-TEST");
    expect(usePersistencyStore.getState().pending.some((c) => c.id === "PC-TEST")).toBe(false);
  });
});
