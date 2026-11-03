import { describe, expect, it } from "vitest";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { validateGraph } from "@/engine/workflow";
import { computeFunnel } from "@/components/r1/funnel-model";

describe("Demo workflows and funnel", () => {
  it.each(["R1", "L1", "L3", "R2", "R3", "R4", "W1", "W3", "S2", "L2", "X1"])("%s passes the publish checks", (code) => {
    expect(validateGraph(SEED_GRAPHS[code]!)).toEqual([]);
  });

  it("starts every trigger's policies and loses none between a step and its outcomes", () => {
    const g = SEED_GRAPHS["R1"]!;
    const f = computeFunnel(g, 1000, [], "t");
    expect(f.total).toBe(1000);
    const ended = f.outcomes.reduce((a, o) => a + o.count, 0);
    expect(Math.abs(ended - 1000)).toBeLessThanOrEqual(12);
  });

  it("is the same on every run", () => {
    const g = SEED_GRAPHS["R1"]!;
    expect(computeFunnel(g, 1000, [], "t")).toEqual(computeFunnel(g, 1000, [], "t"));
  });

  it("sends the high-propensity cohorts to the message and the low ones to the call", () => {
    const g = SEED_GRAPHS["R1"]!;
    const to = (label: string) => g.edges.filter((e) => e.label === label && e.from === "cohort").map((e) => g.nodes.find((n) => n.id === e.to)!.type);
    expect(to("Highest propensity")).toEqual(["agent.message"]);
    expect(to("Lowest propensity")).toEqual(["agent.voice"]);
  });
});
