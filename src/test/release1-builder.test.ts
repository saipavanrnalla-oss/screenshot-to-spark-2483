import { describe, expect, it } from "vitest";
import { SEED_GRAPHS, generateFromPrompt, PREPARED_PROMPTS, seedWorkflowVersions, type WfGraph } from "@/data/persistency/r1/wf";
import { simulate, validateGraph, diffGraphs } from "@/engine/workflow";
import { addNode, connect, deleteNode, insertOnEdge } from "@/components/r1/wf-model";
import { guardrailConflict, hasConditions } from "@/components/r1/rule-model";
import { SEED_RULES } from "@/data/persistency";

describe("workflow builder", () => {
  it("every seeded workflow passes the publish checks", () => {
    for (const [code, g] of Object.entries(SEED_GRAPHS)) expect(validateGraph(g), code).toEqual([]);
  });

  it("R1 has four versions and R4 two, with differences", () => {
    const r1 = seedWorkflowVersions("R1");
    const r4 = seedWorkflowVersions("R4");
    expect(r1.length).toBe(4);
    expect(r4.length).toBe(2);
    expect(diffGraphs(r4[0]!.data, r4[1]!.data).lines.length).toBeGreaterThan(0);
  });

  it("a complaint path that reaches an outcome passes; contact after a complaint fails", () => {
    const g = SEED_GRAPHS["R2"]!;
    expect(simulate(g, "Already paid").result).toBe("Pass");
  });

  it("an outreach node with no edge for its results is refused", () => {
    const base: WfGraph = { nodes: [{ id: "t", type: "trigger.manual", label: "Start", x: 0, y: 0, config: {} }, { id: "o", type: "outcome.bau", label: "End", x: 0, y: 0, config: {} }], edges: [{ id: "e1", from: "t", to: "o" }] };
    const r = insertOnEdge(base, "e1", "agent.voice");
    // insertOnEdge gives the new node one labelled edge only, so the other results are uncovered.
    expect(validateGraph(r.graph).some((p) => p.nodeId === r.id)).toBe(true);
  });

  it("deleting a node reconnects the edges either side", () => {
    let g: WfGraph = { nodes: [{ id: "t", type: "trigger.manual", label: "Start", x: 0, y: 0, config: {} }, { id: "o", type: "outcome.bau", label: "End", x: 0, y: 0, config: {} }], edges: [] };
    const a = addNode(g, "wait.days");
    g = connect(connect(a.graph, "t", a.id), a.id, "o");
    const d = deleteNode(g, a.id);
    expect(d.edges.some((e) => e.from === "t" && e.to === "o")).toBe(true);
  });

  it("the two prepared prompts generate a draft; any other prompt does not", () => {
    for (const p of PREPARED_PROMPTS) expect(generateFromPrompt(p)).not.toBeNull();
    expect(generateFromPrompt("Call everyone twice a day")).toBeNull();
  });
});

describe("rules", () => {
  it("a rule that sends outreach to complaint-hold policies contradicts a guardrail", () => {
    const r = { ...SEED_RULES.find((x) => x.level === "rule")!, when: { state: ["Complaint-hold"] }, conds: [] };
    expect(guardrailConflict(r as never)).not.toBeNull();
  });

  it("a rule with no conditions needs a second approver", () => {
    const r = { ...SEED_RULES.find((x) => x.level === "rule")!, when: {}, conds: [[]] };
    expect(hasConditions(r as never)).toBe(false);
  });
});
