import type { Policy } from "@/data/persistency";
import { hashId } from "@/data/persistency/derived";
import type { WfGraph } from "@/data/persistency/r1/wf";
import { isOutcome } from "@/engine/workflow";

export const PERIODS = ["Today", "Last 7 days", "Last 30 days"] as const;
export type Period = (typeof PERIODS)[number];

/** Share of a node's policies that take an edge, by the edge's result. Anything not listed shares what is left. */
const SHARE: Record<string, number> = {
  Clear: 0.97,
  "On hold": 0.03,
  Paid: 0.34,
  "Not paid": 0.66,
  Yes: 0.45,
  No: 0.55,
  Done: 1,
  Sent: 1,
  Packet: 1,
  Reason: 0.8,
  "Low confidence": 0.2,
  Fixed: 0.62,
  "Not fixed": 0.38,
  Retained: 0.58,
  Surrender: 0.42,
  "Will pay (link requested)": 0.31,
  "Promise to pay with date": 0.14,
  "Already paid": 0.05,
  "Wants to surrender": 0.04,
  "Complaint or mis-selling": 0.02,
  "Asked for a person": 0.07,
  "Mandate problem": 0.06,
  "Not reachable": 0.2,
};

export interface Funnel {
  total: number;
  nodes: Record<string, number>;
  edges: Record<string, number>;
  /** Policies that ended in each outcome node. */
  outcomes: { id: string; label: string; type: string; count: number }[];
  /** Count at each node by cohort, for the side panel. */
  byCohort: Record<string, Record<string, number>>;
}

/** Day factor: more days, more policies passing through. */
export const PERIOD_FACTOR: Record<Period, number> = { Today: 1, "Last 7 days": 6.4, "Last 30 days": 24.8 };

function cohortMix(policies: Policy[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const p of policies) c[p.insurerCohort] = (c[p.insurerCohort] ?? 0) + 1;
  const t = Object.values(c).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / t]));
}

/**
 * Pushes `total` policies through the graph from its triggers. Splits on an edge come from the result on the edge,
 * or from the cohort mix of the book where the edge is a cohort. Loops are cut at the edge that returns to a step already visited.
 */
export function computeFunnel(g: WfGraph, total: number, policies: Policy[], salt: string): Funnel {
  const mix = cohortMix(policies);
  const out = new Map<string, typeof g.edges>();
  for (const e of g.edges) out.set(e.from, [...(out.get(e.from) ?? []), e]);

  // Cut back edges with a depth-first walk.
  const back = new Set<string>();
  const color = new Map<string, number>();
  const order: string[] = [];
  const visit = (id: string) => {
    color.set(id, 1);
    for (const e of out.get(id) ?? []) {
      const c = color.get(e.to) ?? 0;
      if (c === 1) back.add(e.id);
      else if (c === 0) visit(e.to);
    }
    color.set(id, 2);
    order.push(id);
  };
  const triggers = g.nodes.filter((n) => n.type.startsWith("trigger."));
  for (const t of triggers) if (!color.get(t.id)) visit(t.id);
  order.reverse();

  const nodes: Record<string, number> = {};
  const edges: Record<string, number> = {};
  const byCohort: Record<string, Record<string, number>> = {};
  for (const t of triggers) {
    nodes[t.id] = total / Math.max(1, triggers.length);
    byCohort[t.id] = Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, (nodes[t.id] ?? 0) * v]));
  }

  // A step whose only way on is a loop back (wait, then call again) counts toward the steps it returns to,
  // so the funnel splits only across edges that lead forward to an outcome.
  const byNode = new Map(g.nodes.map((n) => [n.id, n]));
  const dead = new Set<string>();
  for (const id of [...order].reverse()) {
    const n = byNode.get(id);
    if (!n || isOutcome(n)) continue;
    const fwd = (out.get(id) ?? []).filter((e) => !back.has(e.id));
    if (fwd.every((e) => dead.has(e.to))) dead.add(id);
  }

  for (const id of order) {
    const flow = nodes[id] ?? 0;
    const all = (out.get(id) ?? []).filter((e) => !back.has(e.id));
    const live = all.filter((e) => !dead.has(e.to));
    const es = live.length ? live : all;
    if (!es.length || flow === 0) continue;
    const isCohortSplit = es.some((e) => e.label && mix[e.label] !== undefined);
    const weights = es.map((e) => {
      if (isCohortSplit && e.label && mix[e.label] !== undefined) return mix[e.label]!;
      if (e.label && SHARE[e.label] !== undefined) return SHARE[e.label]!;
      return undefined;
    });
    const known = weights.reduce<number>((a, w) => a + (w ?? 0), 0);
    const unknown = weights.filter((w) => w === undefined).length;
    const rest = Math.max(0.08, 1 - known);
    const raw = weights.map((w, i) => {
      // A little deterministic variation so repeated labels do not look uniform.
      const jitter = 1 + (((hashId(salt + id + es[i]!.id) % 21) - 10) / 100);
      return (w ?? rest / Math.max(1, unknown)) * jitter;
    });
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    es.forEach((e, i) => {
      const f = (flow * raw[i]!) / sum;
      edges[e.id] = (edges[e.id] ?? 0) + f;
      nodes[e.to] = (nodes[e.to] ?? 0) + f;
      const from = byCohort[id] ?? {};
      const cut = isCohortSplit && e.label && mix[e.label] !== undefined ? { [e.label]: f } : Object.fromEntries(Object.entries(from).map(([k, v]) => [k, (v * f) / flow]));
      const into = (byCohort[e.to] ??= {});
      for (const [k, v] of Object.entries(cut)) into[k] = (into[k] ?? 0) + v;
    });
  }

  const round = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v)]));
  return {
    total: Math.round(total),
    nodes: round(nodes),
    edges: round(edges),
    outcomes: g.nodes.filter(isOutcome).map((n) => ({ id: n.id, label: n.label, type: n.type, count: Math.round(nodes[n.id] ?? 0) })),
    byCohort: Object.fromEntries(Object.entries(byCohort).map(([k, v]) => [k, round(v)])),
  };
}
