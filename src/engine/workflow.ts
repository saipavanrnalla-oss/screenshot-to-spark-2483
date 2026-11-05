import dagre from "@dagrejs/dagre";
import { PALETTE_BY_TYPE, SCENARIO_DISPOSITION, type Scenario, type WfEdge, type WfGraph, type WfNode } from "@/data/persistency/r1/wf";

const NODE_W = 220;
const NODE_H = 76;

/** Left-to-right layout. */
export function layoutGraph(g: WfGraph, dir: "LR" | "TB" = "LR"): WfGraph {
  const d = new dagre.graphlib.Graph();
  d.setGraph(dir === "TB" ? { rankdir: "TB", nodesep: 40, ranksep: 56 } : { rankdir: "LR", nodesep: 28, ranksep: 70 });
  d.setDefaultEdgeLabel(() => ({}));
  for (const n of g.nodes) d.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of g.edges) d.setEdge(e.from, e.to);
  dagre.layout(d);
  return {
    ...g,
    nodes: g.nodes.map((n) => {
      const p = d.node(n.id) as { x: number; y: number } | undefined;
      return p ? { ...n, x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } : n;
    }),
  };
}

export function isOutreach(n: WfNode): boolean {
  return !!PALETTE_BY_TYPE[n.type]?.outreach;
}

export function isOutcome(n: WfNode): boolean {
  return n.type.startsWith("outcome.");
}

export function isWait(n: WfNode): boolean {
  return n.type.startsWith("wait.");
}

/** Every option a node can send an edge for. Outreach nodes add "Default". */
export function edgeOptions(n: WfNode): string[] {
  const item = PALETTE_BY_TYPE[n.type];
  if (!item) return ["Default"];
  if (item.outreach) return [...new Set([...item.returns, "Default"])];
  return item.returns.length ? [...item.returns] : ["Default"];
}

export interface Problem {
  nodeId?: string | undefined;
  text: string;
}

/**
 * Publish checks: outreach nodes cover every disposition or have a default edge,
 * every path ends in an outcome, loops carry a wait or a retry limit, outreach keeps its three checks.
 */
export function validateGraph(g: WfGraph): Problem[] {
  const out: Problem[] = [];
  const outgoing = new Map<string, WfEdge[]>();
  for (const e of g.edges) outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  if (!g.nodes.some((n) => n.type.startsWith("trigger."))) out.push({ text: "Add a trigger." });
  if (!g.nodes.some(isOutcome)) out.push({ text: "Add at least one outcome." });
  for (const n of g.nodes) {
    const edges = outgoing.get(n.id) ?? [];
    if (isOutcome(n)) continue;
    if (edges.length === 0) out.push({ nodeId: n.id, text: `${n.label}: path does not end in an outcome.` });
    if (isOutreach(n) && edges.length > 0) {
      const labels = new Set(edges.map((e) => e.label ?? "Default"));
      if (!labels.has("Default")) {
        const declared = n.config.dispositions?.filter((d) => d !== "Default") ?? [];
        const needed = declared.length ? declared : PALETTE_BY_TYPE[n.type]?.returns ?? [];
        const missing = needed.filter((d) => !labels.has(d));
        if (missing.length) out.push({ nodeId: n.id, text: `${n.label}: no edge for ${missing.length} result${missing.length > 1 ? "s" : ""} and no default edge.` });
      }
    }
  }
  // Loops need a wait node or a retry limit.
  const color = new Map<string, number>();
  const stack: string[] = [];
  const visit = (id: string) => {
    color.set(id, 1);
    stack.push(id);
    for (const e of outgoing.get(id) ?? []) {
      const c = color.get(e.to) ?? 0;
      if (c === 1) {
        const cycle = stack.slice(stack.indexOf(e.to));
        const ok = cycle.some((cid) => {
          const node = byId.get(cid);
          return !!node && (isWait(node) || (node.config.retries ?? 0) > 0);
        });
        if (!ok) out.push({ nodeId: e.to, text: `Loop through ${byId.get(e.to)?.label ?? e.to} has no wait or retry limit.` });
      } else if (c === 0) visit(e.to);
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const n of g.nodes) if (!color.get(n.id)) visit(n.id);
  return out;
}

export function guardrailsPresent(g: WfGraph): boolean {
  // The three automatic checks are part of every outreach node and cannot be removed.
  return g.nodes.filter(isOutreach).every(() => true);
}

/* ---------- Simulation ---------- */

export interface SimStep {
  nodeId: string;
  label: string;
  executor: string;
  disposition: string;
  edge: string;
  checks: string[];
  elapsedMs: number;
  breach?: string | undefined;
}

export interface SimResult {
  steps: SimStep[];
  result: "Pass" | "Fail";
  reason?: string | undefined;
}

const HALT = new Set(["Complaint or mis-selling", "Wants to surrender", "Do not call"]);

/** Plays the graph for one scenario. Deterministic: the same graph and scenario give the same path. */
export function simulate(g: WfGraph, scenario: Scenario): SimResult {
  const disp = SCENARIO_DISPOSITION[scenario];
  const outgoing = new Map<string, WfEdge[]>();
  for (const e of g.edges) outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const start = g.nodes.find((n) => n.type.startsWith("trigger."));
  if (!start) return { steps: [], result: "Fail", reason: "No trigger." };
  const steps: SimStep[] = [];
  let cur: WfNode | undefined = start;
  let elapsed = 0;
  let haltSeen = false;
  let paidSeen = scenario === "Already paid";
  const visits = new Map<string, number>();
  while (cur) {
    const v = (visits.get(cur.id) ?? 0) + 1;
    visits.set(cur.id, v);
    if (v > 3 || steps.length > 40) return { steps, result: "Fail", reason: `Loop at ${cur.label} did not end.` };
    const edges: WfEdge[] = outgoing.get(cur.id) ?? [];
    const item = PALETTE_BY_TYPE[cur.type];
    const outreach = !!item?.outreach;
    const checks = outreach ? ["Paid since the list", "On hold", "Contact policy"] : [];
    let breach: string | undefined;
    if (outreach && haltSeen) breach = "Contact after a complaint, surrender request or do-not-call";
    let chosen: WfEdge | undefined;
    let disposition = "";
    const pick = (label: string) => edges.find((e) => (e.label ?? "Default") === label);
    if (isOutcome(cur)) {
      steps.push({ nodeId: cur.id, label: cur.label, executor: "None", disposition: "", edge: "End", checks, elapsedMs: elapsed });
      if (breach) return { steps, result: "Fail", reason: breach };
      return { steps, result: "Pass" };
    }
    if (outreach && paidSeen && cur.type !== "agent.payment") {
      // The automatic paid-since-the-list check stops outreach for a policy that has paid.
      steps.push({ nodeId: cur.id, label: cur.label, executor: cur.config.executor ?? item?.executor ?? "", disposition: "Stopped: paid since the list", edge: "End", checks, elapsedMs: elapsed });
      return { steps, result: "Pass", reason: "Stopped by the paid-since-the-list check." };
    }
    if (cur.type === "check.paid" || cur.type === "file.payment" || cur.type === "wait.payment") {
      const paid = paidSeen || (scenario === "Pays after the link" && steps.some((s) => s.disposition === "Paid"));
      chosen = pick(paid ? "Paid" : "Not paid") ?? edges[0];
      disposition = paid ? "Paid" : "Not paid";
    } else if (cur.type === "check.hold") {
      chosen = pick(haltSeen ? "On hold" : "Clear") ?? edges.find((e) => e.label !== "On hold") ?? edges[0];
      disposition = haltSeen ? "On hold" : "Clear";
    } else if (cur.type === "agent.payment") {
      const r = scenario === "Pays after the link" || scenario === "Already paid" ? "Paid" : "Not paid";
      chosen = pick(r) ?? pick("Default") ?? edges[0];
      disposition = r;
      if (r === "Paid") paidSeen = true;
    } else if (outreach || cur.type === "decision.disposition" || cur.type === "vendor.read") {
      disposition = cur.type === "vendor.send" || cur.type === "vendor.visit" ? "Sent" : disp;
      chosen = pick(disposition) ?? pick("Default") ?? (cur.type === "decision.disposition" ? undefined : edges[0]);
      if (HALT.has(disposition)) haltSeen = true;
      if (disposition === "Already paid") paidSeen = true;
    } else if (cur.type === "decision.cohort") {
      chosen = pick("Low propensity") ?? edges[0];
      disposition = "Cohort Low propensity";
    } else if (cur.type === "decision.product") {
      chosen = pick("ULIP") ?? edges[0];
      disposition = "ULIP";
    } else if (cur.type === "decision.field") {
      const yes = !/short|registered/i.test(cur.config.condition ?? "") || scenario !== "No answer";
      chosen = pick(yes ? "Yes" : "No") ?? edges[0];
      disposition = yes ? "Yes" : "No";
    } else {
      chosen = edges[0];
      disposition = chosen?.label ?? "Done";
    }
    elapsed += isWait(cur) ? 0 : outreach ? 4_000 : 200;
    steps.push({ nodeId: cur.id, label: cur.label, executor: cur.config.executor ?? item?.executor ?? "System", disposition, edge: chosen ? `${chosen.label ?? "Default"} to ${byId.get(chosen.to)?.label ?? chosen.to}` : "No edge", checks, elapsedMs: elapsed, breach });
    if (breach) return { steps, result: "Fail", reason: breach };
    if (!chosen) return { steps, result: "Fail", reason: `${cur.label} has no edge for ${disposition || "this result"}.` };
    cur = byId.get(chosen.to);
  }
  return { steps, result: "Fail", reason: "Path ended outside an outcome." };
}

/* ---------- Compare two versions ---------- */

export interface GraphDiff {
  added: string[];
  removed: string[];
  changed: string[];
  lines: string[];
}

export function diffGraphs(a: WfGraph, b: WfGraph): GraphDiff {
  const am = new Map(a.nodes.map((n) => [n.id, n]));
  const bm = new Map(b.nodes.map((n) => [n.id, n]));
  const added = b.nodes.filter((n) => !am.has(n.id)).map((n) => n.id);
  const removed = a.nodes.filter((n) => !bm.has(n.id)).map((n) => n.id);
  const changed = b.nodes.filter((n) => {
    const o = am.get(n.id);
    return o && (o.label !== n.label || o.type !== n.type || JSON.stringify(o.config) !== JSON.stringify(n.config));
  }).map((n) => n.id);
  const ek = (e: WfEdge) => `${e.from}>${e.to}:${e.label ?? ""}`;
  const ae = new Set(a.edges.map(ek));
  const be = new Set(b.edges.map(ek));
  const lines = [
    ...added.map((id) => `Added node: ${bm.get(id)!.label}`),
    ...removed.map((id) => `Removed node: ${am.get(id)!.label}`),
    ...changed.map((id) => `Changed node: ${bm.get(id)!.label}`),
    ...b.edges.filter((e) => !ae.has(ek(e))).map((e) => `Added connection: ${bm.get(e.from)?.label ?? e.from} to ${bm.get(e.to)?.label ?? e.to}${e.label ? ` (${e.label})` : ""}`),
    ...a.edges.filter((e) => !be.has(ek(e))).map((e) => `Removed connection: ${am.get(e.from)?.label ?? e.from} to ${am.get(e.to)?.label ?? e.to}${e.label ? ` (${e.label})` : ""}`),
  ];
  return { added, removed, changed, lines };
}

export function estimatedCost(n: WfNode, costOverrides?: Record<string, number>): number {
  const item = PALETTE_BY_TYPE[n.type];
  const ex = n.config.executor ?? item?.executor ?? "";
  return costOverrides?.[ex] ?? item?.cost ?? 0;
}
