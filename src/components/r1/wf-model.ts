import { useMemo } from "react";
import { WORKFLOWS, type Policy } from "@/data/persistency";
import { PALETTE_BY_TYPE, type WfEdge, type WfGraph, type WfNode } from "@/data/persistency/r1/wf";
import { edgeOptions, isOutcome, layoutGraph } from "@/engine/workflow";
import type { Version } from "@/data/persistency/r1/types";
import { hashId } from "@/data/persistency/derived";
import { activeVersion, seedVersions, useWork } from "@/store/work";

export const WF_STAGES = ["Sourcing", "Warming", "Renewal window", "Early lapse", "Late lapse", "Cross-cutting"] as const;

export interface WfRow {
  code: string;
  name: string;
  stage: string;
  products: string[];
  trigger: string;
  executors: string[];
  version: number;
  status: string;
  draft?: number | undefined;
  inReview?: number | undefined;
  isNew: boolean;
  archived: boolean;
}

export function wfVersions(saved: Record<string, Version<unknown>[]>, code: string): Version<WfGraph>[] {
  return (saved[`workflow:${code}`] ?? seedVersions(`workflow:${code}`)) as Version<WfGraph>[];
}

export function executorsOf(g: WfGraph | undefined): string[] {
  if (!g) return [];
  return [...new Set(g.nodes.map((n) => n.config.executor).filter((x): x is string => !!x && x !== "None"))];
}

/** All workflows: the 18 seeded ones plus any created this session. */
export function useWorkflowRows(): WfRow[] {
  const saved = useWork((s) => s.versions);
  const created = useWork((s) => s.newWorkflows);
  const archived = useWork((s) => s.archived);
  const names = useWork((s) => s.wfNames);
  return useMemo(() => {
    const base = [
      ...WORKFLOWS.map((w) => ({ code: w.id, name: w.name, stage: w.stage, products: [...w.products] as string[], trigger: w.trigger, isNew: false })),
      ...created.map((w) => ({ code: w.code, name: w.name, stage: w.stage, products: ["ULIP", "Traditional", "Term"], trigger: "Set in the builder", isNew: true })),
    ];
    return base.map((w) => {
      const list = wfVersions(saved, w.code);
      const act = list.find((v) => v.status === "Active");
      const last = list[list.length - 1];
      const g = (act ?? last)?.data;
      const trig = g?.nodes.find((n) => n.type.startsWith("trigger."));
      return {
        ...w,
        name: names[w.code] ?? w.name,
        trigger: w.isNew && trig ? trig.label : w.trigger,
        executors: executorsOf(g),
        version: act?.no ?? 0,
        status: archived.includes(w.code) ? "Archived" : act ? "Active" : last?.status ?? "Draft",
        draft: last?.status === "Draft" ? last.no : undefined,
        inReview: list.find((v) => v.status === "In review")?.no,
        archived: archived.includes(w.code),
      };
    });
  }, [saved, created, archived, names]);
}

export function wfName(code: string, created: { code: string; name: string }[]): string {
  return WORKFLOWS.find((w) => w.id === code)?.name ?? created.find((w) => w.code === code)?.name ?? code;
}

/** Version in force when a row happened: the latest version approved on or before that time. */
export function versionAt(list: Version<WfGraph>[], at: string): number | undefined {
  let best: Version<WfGraph> | undefined;
  for (const v of list) if (v.approvedAt && v.approvedAt <= at && (!best || v.approvedAt > best.approvedAt!)) best = v;
  return best?.no ?? activeVersion(list)?.no;
}

/** Spreads the policies in a workflow across its working steps, deterministically by policy number. */
export function nodeCounts(g: WfGraph, policies: Policy[]): { counts: Record<string, number>; byNode: Record<string, Policy[]> } {
  const steps = g.nodes.filter((n) => !n.type.startsWith("trigger.") && !isOutcome(n));
  const byNode: Record<string, Policy[]> = {};
  if (!steps.length) return { counts: {}, byNode };
  for (const p of policies) {
    const n = steps[hashId(p.policyId + "node") % steps.length]!;
    (byNode[n.id] ??= []).push(p);
  }
  return { counts: Object.fromEntries(Object.entries(byNode).map(([k, v]) => [k, v.length])), byNode };
}

export function prepare(g: WfGraph): WfGraph {
  return g.nodes.every((n) => n.x === 0 && n.y === 0) ? layoutGraph(g) : g;
}

/* ---------- Edit operations (pure) ---------- */

function nextNodeId(g: WfGraph): string {
  let i = g.nodes.length + 1;
  while (g.nodes.some((n) => n.id === `n${i}`)) i++;
  return `n${i}`;
}

function nextEdgeId(g: WfGraph, offset = 0): string {
  let i = g.edges.length + 1 + offset;
  while (g.edges.some((e) => e.id === `e${i}`)) i++;
  return `e${i}`;
}

export function makeNode(g: WfGraph, type: string, x: number, y: number): WfNode {
  const item = PALETTE_BY_TYPE[type];
  return {
    id: nextNodeId(g),
    type,
    label: type === "wait.days" ? "Wait 2 days" : (item?.label ?? type),
    x,
    y,
    config: { executor: item?.executor, ...(item?.outreach ? { dispositions: [...(item.returns ?? [])] } : {}), ...(type === "wait.days" ? { days: 2 } : {}) },
  };
}

/** The first edge option this node has not used yet. */
export function freeLabel(g: WfGraph, from: string): string | undefined {
  const n = g.nodes.find((x) => x.id === from);
  if (!n) return undefined;
  const opts = edgeOptions(n);
  const used = new Set(g.edges.filter((e) => e.from === from).map((e) => e.label ?? "Default"));
  const free = opts.find((o) => !used.has(o));
  if (opts.length === 1 && opts[0] === "Default") return undefined;
  return free ?? opts[0];
}

export function addNode(g: WfGraph, type: string, x?: number, y?: number): { graph: WfGraph; id: string } {
  const maxX = Math.max(0, ...g.nodes.map((n) => n.x));
  const n = makeNode(g, type, x ?? maxX + 280, y ?? 40);
  return { graph: { ...g, nodes: [...g.nodes, n] }, id: n.id };
}

export function connect(g: WfGraph, from: string, to: string): WfGraph {
  if (from === to) return g;
  const label = freeLabel(g, from);
  if (g.edges.some((e) => e.from === from && e.to === to && (e.label ?? "") === (label ?? ""))) return g;
  const e: WfEdge = { id: nextEdgeId(g), from, to, ...(label ? { label } : {}) };
  return { ...g, edges: [...g.edges, e] };
}

/** Deletes a node; its incoming edges reconnect to the node that followed it. */
export function deleteNode(g: WfGraph, id: string): WfGraph {
  const incoming = g.edges.filter((e) => e.to === id);
  const next = g.edges.find((e) => e.from === id)?.to;
  const kept = g.edges.filter((e) => e.from !== id && e.to !== id);
  const bridged = next ? incoming.filter((e) => e.from !== next).map((e) => ({ ...e, to: next })) : [];
  return { nodes: g.nodes.filter((n) => n.id !== id), edges: [...kept, ...bridged] };
}

/** Inserts a node on an edge: a → new (old label), new → b. */
export function insertOnEdge(g: WfGraph, edgeId: string, type: string): { graph: WfGraph; id: string } {
  const e = g.edges.find((x) => x.id === edgeId);
  if (!e) return { graph: g, id: "" };
  const a = g.nodes.find((n) => n.id === e.from);
  const b = g.nodes.find((n) => n.id === e.to);
  const n = makeNode(g, type, ((a?.x ?? 0) + (b?.x ?? 0)) / 2, ((a?.y ?? 0) + (b?.y ?? 0)) / 2 + 60);
  const withNode: WfGraph = { nodes: [...g.nodes, n], edges: g.edges.map((x) => (x.id === edgeId ? { ...x, to: n.id } : x)) };
  const label = freeLabel(withNode, n.id);
  return { graph: { ...withNode, edges: [...withNode.edges, { id: nextEdgeId(withNode), from: n.id, to: e.to, ...(label ? { label } : {}) }] }, id: n.id };
}

export function blankGraph(): WfGraph {
  return {
    nodes: [
      { id: "t", type: "trigger.manual", label: "Manual start", x: 0, y: 40, config: {} },
      { id: "o", type: "outcome.bau", label: "Business as usual", x: 320, y: 40, config: {} },
    ],
    edges: [{ id: "e1", from: "t", to: "o" }],
  };
}
