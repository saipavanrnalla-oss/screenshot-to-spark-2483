import { describe, expect, it } from "vitest";
import { BASE_POLICIES, SEED_RULES } from "@/data/persistency";
import { evaluate, type EngineContext } from "@/engine/persistency";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { END_STATES, walkPolicy } from "@/engine/walk";

const sample = BASE_POLICIES.slice(0, 600);

describe("Example run walks a policy to exactly one end state", () => {
  it.each(["R1", "R8"])("%s: every policy reaches an outcome by itself", (code) => {
    const g = SEED_GRAPHS[code]!;
    for (const p of sample) {
      const w = walkPolicy(g, p);
      expect(w.complete, `${p.policyId}`).toBe(true);
      expect(END_STATES as readonly string[]).toContain(w.endState);
    }
  });

  it.each(["R1", "R8"])("%s: the four customer behaviours end where they should", (code) => {
    const g = SEED_GRAPHS[code]!;
    const p = sample[3]!;
    expect(walkPolicy(g, p, "Pays by the due date").endState).toBe("Renewed");
    expect(walkPolicy(g, p, "Pays in the Grace Period").endState).toBe("Renewed in the Grace Period");
    expect(walkPolicy(g, p, "Lapses, then revives").endState).toBe("Revived");
    expect(walkPolicy(g, p, "Refuses and is closed").endState).toBe("Closed with reason");
  });

  it("25th month: a traditional plan that does not pay passes through Reduced Paid-up", () => {
    const g = SEED_GRAPHS["R8"]!;
    const p = sample.find((x) => x.product !== "ULIP")!;
    expect(walkPolicy(g, p, "Traditional plan goes Reduced Paid-up").steps.map((s) => s.nodeId)).toContain("rpu");
  });

  it("is the same on every run", () => {
    const g = SEED_GRAPHS["R1"]!;
    expect(walkPolicy(g, sample[7]!)).toEqual(walkPolicy(g, sample[7]!));
  });

  it("routes a plain second-year renewal-window policy to the 25th month workflow", () => {
    const ctx: EngineContext = { activeCohortSet: { ULIP: "insurer", Traditional: "insurer", Term: "starter" }, receipts: new Set(), killSwitchGlobal: false, killedWorkflows: new Set(), staleWorkflows: new Set() };
    const p = BASE_POLICIES.find((x) => x.lifecycleStage === "Renewal window" && x.policyYear === 2 && x.state === "Renewal window open");
    expect(p).toBeDefined();
    if (!p) return;
    expect(["R8", "X1", "X2", "S3", "L3", "R6", "R7"]).toContain(evaluate(p, SEED_RULES, ctx).workflowId);
  });
});
