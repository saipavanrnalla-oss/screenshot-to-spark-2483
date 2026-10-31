import { create } from "zustand";
import { useMemo } from "react";
import {
  BASE_POLICIES,
  NOW,
  POLICY_INDEX,
  SEED_RULES,
  STALE_WORKFLOWS,
  type CohortSet,
  type Decision,
  type Policy,
  type Product,
  type Rule,
  type SimulatedEvent,
  type TimelineEvent,
} from "@/data/persistency";
import { Rng } from "@/data/persistency/rng";
import { applyEvent, evaluate, type EngineContext } from "@/engine/persistency";

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  kind: "decision" | "event" | "rule-change" | "approval" | "kill-switch" | "cancel";
  policyId?: string | undefined;
  ruleId?: string | undefined;
  detail: string;
}

export interface PendingChange {
  id: string;
  title: string;
  source: "Rule edit" | "War-room recommendation" | "Learn step";
  proposedBy: string;
  at: string;
  rule: Rule;
  effect?: string | undefined;
}

export interface TickerItem {
  id: number;
  at: string;
  decision: Decision;
  product: Product;
  note?: string | undefined;
}

const TICK_MS = 6000;

// Policies whose receipt landed in today's file before outreach fired.
const SEED_RECEIPTS = BASE_POLICIES.filter(
  (p, i) => (p.state === "Grace" || p.state === "Promised" || p.state === "Renewal window open") && i % 17 === 0,
).map((p) => p.policyId);

// Deterministic order for the decisions ticker.
const TICKER_POOL: number[] = (() => {
  const rng = new Rng(777);
  const idx = BASE_POLICIES.map((p, i) => ({ p, i }))
    .filter(({ p }) => p.lifecycleStage !== "Warming" || p.policyYear === 1)
    .map(({ i }) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx;
})();

const SEED_PENDING: PendingChange[] = [
  {
    id: "PC-101",
    title: "Quarterly-mode ULIP, year 2: WhatsApp before call",
    source: "Learn step",
    proposedBy: "Desible (from outcomes)",
    at: "2026-10-27T18:00:00.000Z",
    effect: "Changes the first touch for matching policies in the renewal window",
    rule: {
      id: "R17",
      name: "Quarterly ULIP year 2: WhatsApp before call",
      stage: "Renewal window",
      level: "rule",
      priority: 28,
      source: "Proposed by Desible, insurer to confirm",
      when: { stage: ["Renewal window"], product: ["ULIP"], paymentMode: ["Quarterly"], policyYear: ["2"] },
      then: { workflowId: "R1", action: "WhatsApp with fund value, call two days later", executor: "Paylocal", delayHours: 2 },
      effectiveFrom: "2026-10-29",
      needsApprovalFrom: "Head of Persistency",
    },
  },
  {
    id: "PC-102",
    title: "Grace, A4 cohort: move from Pace Setters to Desible voice",
    source: "War-room recommendation",
    proposedBy: "Month-end war room (rule-based)",
    at: "2026-10-28T08:15:00.000Z",
    effect: "Reassigns month-end grace calls for A4 policies",
    rule: {
      id: "R18",
      name: "Month-end grace, A4: Desible voice first",
      stage: "Renewal window",
      level: "rule",
      priority: 18,
      source: "Proposed by Desible, insurer to confirm",
      when: { state: ["Grace"], cohort: ["A4"], calendar: ["Month-end (last 5 days)"] },
      then: { workflowId: "R2", action: "Desible voice call, telecall fallback", executor: "Desible", delayHours: 1 },
      effectiveFrom: "2026-10-28",
      needsApprovalFrom: "Head of Persistency",
    },
  },
];

interface PersistencyState {
  overrides: Record<string, Partial<Policy>>;
  extraTimeline: Record<string, TimelineEvent[]>;
  audit: AuditEntry[];
  rules: Rule[];
  pending: PendingChange[];
  receipts: string[];
  killSwitchGlobal: boolean;
  killedWorkflows: string[];
  activeCohortSet: Record<Product, CohortSet>;
  ticker: TickerItem[];
  tickCount: number;
  rulesVersion: number;
  simulate: (policyId: string, event: SimulatedEvent) => void;
  tick: () => void;
  approve: (changeId: string) => void;
  reject: (changeId: string) => void;
  propose: (change: PendingChange) => void;
  setKillSwitch: (on: boolean) => void;
  setWorkflowKilled: (workflowId: string, on: boolean) => void;
  setActiveCohortSet: (product: Product, set: CohortSet) => void;
}

let auditSeq = 1;
let tickerSeq = 1;

function mergedPolicy(id: string, overrides: Record<string, Partial<Policy>>): Policy | undefined {
  const i = POLICY_INDEX.get(id);
  if (i === undefined) return undefined;
  const base = BASE_POLICIES[i]!;
  const o = overrides[id];
  return o ? ({ ...base, ...o } as Policy) : base;
}

function ctxFrom(s: Pick<PersistencyState, "activeCohortSet" | "receipts" | "killSwitchGlobal" | "killedWorkflows">, now: Date): EngineContext {
  return {
    activeCohortSet: s.activeCohortSet,
    receipts: new Set(s.receipts),
    killSwitchGlobal: s.killSwitchGlobal,
    killedWorkflows: new Set(s.killedWorkflows),
    staleWorkflows: STALE_WORKFLOWS,
    now,
  };
}

const DEFAULT_COHORT_SET: Record<Product, CohortSet> = { ULIP: "insurer", Traditional: "insurer", Term: "starter" };

function initialTicker(): TickerItem[] {
  const ctx = ctxFrom(
    { activeCohortSet: DEFAULT_COHORT_SET, receipts: SEED_RECEIPTS, killSwitchGlobal: false, killedWorkflows: [] },
    NOW,
  );
  return TICKER_POOL.slice(0, 40).map((idx, k) => {
    const p = BASE_POLICIES[idx]!;
    const at = new Date(NOW.getTime() - k * TICK_MS * 1.7);
    return { id: tickerSeq++, at: at.toISOString(), decision: evaluate(p, SEED_RULES, { ...ctx, now: at }), product: p.product };
  });
}

export const usePersistencyStore = create<PersistencyState>((set, get) => ({
  overrides: {},
  extraTimeline: {},
  audit: [],
  rules: SEED_RULES,
  pending: SEED_PENDING,
  receipts: SEED_RECEIPTS,
  killSwitchGlobal: false,
  killedWorkflows: [],
  activeCohortSet: DEFAULT_COHORT_SET,
  ticker: initialTicker(),
  tickCount: 0,
  rulesVersion: 0,

  simulate: (policyId, event) => {
    const s = get();
    const before = mergedPolicy(policyId, s.overrides);
    if (!before) return;
    const now = new Date(NOW.getTime() + s.tickCount * TICK_MS);
    const ctx = ctxFrom(s, now);
    const pre = evaluate(before, s.rules, ctx);
    const result = applyEvent(before, event, now);
    const after = { ...before, ...result.patch } as Policy;
    const receipts = result.addReceipt && !s.receipts.includes(policyId) ? [...s.receipts, policyId] : s.receipts;
    const post = evaluate(after, s.rules, { ...ctx, receipts: new Set(receipts) });

    const entries: TimelineEvent[] = [result.timeline];
    const audit: AuditEntry[] = [
      { id: auditSeq++, at: now.toISOString(), actor: "Simulator", kind: "event", policyId, detail: `${event} simulated` },
    ];
    let note: string | undefined;
    if (event === "Payment received" && !pre.frozen && pre.ruleId !== "G5") {
      entries.push({ at: now.toISOString(), kind: "decision", title: `Pending action cancelled: paid meanwhile`, detail: `${pre.action} (${pre.ruleId}) via ${pre.executor}` });
      audit.push({ id: auditSeq++, at: now.toISOString(), actor: "Engine", kind: "cancel", policyId, ruleId: pre.ruleId, detail: `Cancelled "${pre.action}": paid meanwhile` });
      note = `Cancelled "${pre.action}": paid meanwhile`;
    }
    if (post.frozen) {
      entries.push({ at: now.toISOString(), kind: "decision", title: "Outreach frozen", detail: `${post.ruleName} (${post.ruleId})` });
      note = `Outreach frozen by ${post.ruleId}`;
    }
    entries.push({ at: now.toISOString(), kind: "state", title: `State: ${after.state}`, detail: `Next: ${post.action} (${post.ruleId})` });
    audit.push({ id: auditSeq++, at: now.toISOString(), actor: "Engine", kind: "decision", policyId, ruleId: post.ruleId, detail: post.action });

    set({
      overrides: { ...s.overrides, [policyId]: { ...s.overrides[policyId], ...result.patch } },
      extraTimeline: { ...s.extraTimeline, [policyId]: [...entries.reverse(), ...(s.extraTimeline[policyId] ?? [])] },
      receipts,
      audit: [...audit.reverse(), ...s.audit].slice(0, 500),
      ticker: [{ id: tickerSeq++, at: now.toISOString(), decision: post, product: after.product, note }, ...s.ticker].slice(0, 60),
    });
  },

  tick: () => {
    const s = get();
    const count = s.tickCount + 1;
    const idx = TICKER_POOL[(40 + count) % TICKER_POOL.length];
    const p = mergedPolicy(BASE_POLICIES[idx!]!.policyId, s.overrides)!;
    const now = new Date(NOW.getTime() + count * TICK_MS);
    const decision = evaluate(p, s.rules, ctxFrom(s, now));
    set({
      tickCount: count,
      ticker: [{ id: tickerSeq++, at: now.toISOString(), decision, product: p.product }, ...s.ticker].slice(0, 60),
      audit: [
        { id: auditSeq++, at: now.toISOString(), actor: "Engine", kind: "decision" as const, policyId: p.policyId, ruleId: decision.ruleId, detail: decision.cancelledReason ? `${decision.action} (cancelled: ${decision.cancelledReason})` : decision.action },
        ...s.audit,
      ].slice(0, 500),
    });
  },

  approve: (changeId) => {
    const s = get();
    const change = s.pending.find((c) => c.id === changeId);
    if (!change) return;
    const exists = s.rules.some((r) => r.id === change.rule.id);
    const rules = exists ? s.rules.map((r) => (r.id === change.rule.id ? change.rule : r)) : [...s.rules, change.rule];
    const now = new Date(NOW.getTime() + s.tickCount * TICK_MS);
    set({
      rules,
      rulesVersion: s.rulesVersion + 1,
      pending: s.pending.filter((c) => c.id !== changeId),
      audit: [
        { id: auditSeq++, at: now.toISOString(), actor: "Head of Persistency", kind: "approval" as const, ruleId: change.rule.id, detail: `Approved: ${change.title}` },
        ...s.audit,
      ].slice(0, 500),
    });
  },

  reject: (changeId) => {
    const s = get();
    const change = s.pending.find((c) => c.id === changeId);
    if (!change) return;
    const now = new Date(NOW.getTime() + s.tickCount * TICK_MS);
    set({
      pending: s.pending.filter((c) => c.id !== changeId),
      audit: [
        { id: auditSeq++, at: now.toISOString(), actor: "Head of Persistency", kind: "rule-change" as const, ruleId: change.rule.id, detail: `Rejected: ${change.title}` },
        ...s.audit,
      ].slice(0, 500),
    });
  },

  propose: (change) => set((s) => ({ pending: [change, ...s.pending] })),

  setKillSwitch: (on) => {
    const s = get();
    const now = new Date(NOW.getTime() + s.tickCount * TICK_MS);
    set({
      killSwitchGlobal: on,
      audit: [{ id: auditSeq++, at: now.toISOString(), actor: "Compliance", kind: "kill-switch" as const, detail: on ? "Global kill switch turned on" : "Global kill switch turned off" }, ...s.audit].slice(0, 500),
    });
  },

  setWorkflowKilled: (workflowId, on) => {
    const s = get();
    const now = new Date(NOW.getTime() + s.tickCount * TICK_MS);
    set({
      killedWorkflows: on ? [...new Set([...s.killedWorkflows, workflowId])] : s.killedWorkflows.filter((w) => w !== workflowId),
      audit: [{ id: auditSeq++, at: now.toISOString(), actor: "Compliance", kind: "kill-switch" as const, detail: `${workflowId} ${on ? "paused" : "resumed"}` }, ...s.audit].slice(0, 500),
    });
  },

  setActiveCohortSet: (product, cohortSet) => set((s) => ({ activeCohortSet: { ...s.activeCohortSet, [product]: cohortSet } })),
}));

/** All policies with in-session changes applied. */
export function usePolicies(): Policy[] {
  const overrides = usePersistencyStore((s) => s.overrides);
  return useMemo(() => {
    const keys = Object.keys(overrides);
    if (keys.length === 0) return BASE_POLICIES;
    const out = BASE_POLICIES.slice();
    for (const id of keys) {
      const i = POLICY_INDEX.get(id);
      if (i !== undefined) out[i] = { ...out[i]!, ...overrides[id] } as Policy;
    }
    return out;
  }, [overrides]);
}

export function usePolicy(id: string | null): Policy | undefined {
  const overrides = usePersistencyStore((s) => s.overrides);
  return useMemo(() => (id ? mergedPolicy(id, overrides) : undefined), [id, overrides]);
}

export function useEngineContext(): EngineContext {
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const receipts = usePersistencyStore((s) => s.receipts);
  const killSwitchGlobal = usePersistencyStore((s) => s.killSwitchGlobal);
  const killedWorkflows = usePersistencyStore((s) => s.killedWorkflows);
  return useMemo(
    () => ctxFrom({ activeCohortSet, receipts, killSwitchGlobal, killedWorkflows }, NOW),
    [activeCohortSet, receipts, killSwitchGlobal, killedWorkflows],
  );
}

/** Decisions for a list of policies, memoised on rules and context. */
export function useDecisions(policies: Policy[]): Map<string, Decision> {
  const rules = usePersistencyStore((s) => s.rules);
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const receipts = usePersistencyStore((s) => s.receipts);
  const killSwitchGlobal = usePersistencyStore((s) => s.killSwitchGlobal);
  const killedWorkflows = usePersistencyStore((s) => s.killedWorkflows);
  return useMemo(() => {
    const ctx = ctxFrom({ activeCohortSet, receipts, killSwitchGlobal, killedWorkflows }, NOW);
    const m = new Map<string, Decision>();
    for (const p of policies) m.set(p.policyId, evaluate(p, rules, ctx));
    return m;
  }, [policies, rules, activeCohortSet, receipts, killSwitchGlobal, killedWorkflows]);
}

export function currentTime(tickCount: number): Date {
  return new Date(NOW.getTime() + tickCount * TICK_MS);
}
export { TICK_MS };
