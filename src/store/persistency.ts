import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useMemo } from "react";
import {
  BASE_POLICIES,
  DEFAULT_BAND_CUTOFFS,
  DEFAULT_WEIGHTS,
  FILE_ADAPTERS,
  LANGUAGES,
  NOW,
  NOW_ISO,
  POLICY_INDEX,
  SEED_RULES,
  VENDORS,
  type CohortSet,
  type Decision,
  type FileAdapter,
  type Policy,
  type Product,
  type Rule,
  type ScoreFactor,
  type SimulatedEvent,
  type TimelineEvent,
  type VendorMode,
} from "@/data/persistency";
import { PERSONAS } from "@/config/personas";
import { Rng } from "@/data/persistency/rng";
import type { CallOutcome } from "@/data/persistency/scripts";
import { applyEvent, evaluate, type EngineContext } from "@/engine/persistency";

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  kind: "decision" | "event" | "rule-change" | "approval" | "kill-switch" | "cancel" | "setting" | "outcome";
  policyId?: string | undefined;
  ruleId?: string | undefined;
  detail: string;
}

export interface PendingChange {
  id: string;
  title: string;
  source: "Rule edit" | "War-room recommendation" | "Learn step" | "Product matrix";
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

export interface CohortCondition {
  dim: string;
  values: string[];
}
export interface CohortGroup {
  op: "AND" | "OR";
  conditions: CohortCondition[];
}
export interface SavedCohort {
  id: string;
  name: string;
  groupsOp: "AND" | "OR";
  groups: CohortGroup[];
  count: number;
  savedAt: string;
}

export type ProofMethod = "none" | "holdout" | "staggered" | "yoy";

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
      then: { workflowId: "R1", action: "WhatsApp with fund value, call two days later", executor: "WhatsApp vendor", delayHours: 2 },
      effectiveFrom: "2026-10-29",
      needsApprovalFrom: "Head of Persistency",
    },
  },
  {
    id: "PC-102",
    title: "Grace, A4 cohort: move from Call-centre vendor (fixed payout) to Desible voice",
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
  testNumber: string | null;
  vendorModes: Record<string, VendorMode>;
  proofMethod: ProofMethod;
  stationLabels: Record<number, string>;
  staleAdapters: string[];
  adapterEnabled: Record<string, boolean>;
  cohortFile: { droppedName: string; at: string } | null;
  savedCohorts: SavedCohort[];
  starterWeights: ScoreFactor[];
  bandCutoffs: number[];
  languages: string[];
  enabledPersonas: string[];
  personaActions: Record<string, string>;

  simulate: (policyId: string, event: SimulatedEvent) => void;
  tick: () => void;
  approve: (changeId: string, actor?: string, effectiveFrom?: string) => void;
  reject: (changeId: string, actor?: string, reason?: string) => void;
  propose: (change: PendingChange) => void;
  applyNow: (change: PendingChange, actor: string) => void;
  setKillSwitch: (on: boolean) => void;
  setWorkflowKilled: (workflowId: string, on: boolean) => void;
  setActiveCohortSet: (product: Product, set: CohortSet) => void;
  setTestNumber: (n: string | null) => void;
  setVendorMode: (vendorId: string, mode: VendorMode) => void;
  setProofMethod: (m: ProofMethod) => void;
  setStationLabel: (n: number, label: string) => void;
  markAdapterReceived: (id: string) => void;
  setAdapterEnabled: (id: string, on: boolean) => void;
  loadCohortFile: (droppedName: string) => void;
  saveCohort: (c: SavedCohort) => void;
  setStarterWeights: (w: ScoreFactor[]) => void;
  setBandCutoffs: (c: number[]) => void;
  toggleLanguage: (l: string) => void;
  togglePersona: (id: string) => void;
  recordAction: (actor: string, key: string, label: string, policyId?: string) => void;
  logOutcome: (policyId: string, outcome: CallOutcome, actor: string) => void;
  log: (entry: Omit<AuditEntry, "id" | "at">) => void;
  resetDemo: () => void;
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

export function staleWorkflowsFor(staleAdapters: readonly string[]): Set<string> {
  return new Set(FILE_ADAPTERS.filter((a) => staleAdapters.includes(a.id)).flatMap((a) => a.feeds));
}

type CtxSlice = Pick<PersistencyState, "activeCohortSet" | "receipts" | "killSwitchGlobal" | "killedWorkflows" | "staleAdapters">;

function ctxFrom(s: CtxSlice, now: Date): EngineContext {
  return {
    activeCohortSet: s.activeCohortSet,
    receipts: new Set(s.receipts),
    killSwitchGlobal: s.killSwitchGlobal,
    killedWorkflows: new Set(s.killedWorkflows),
    staleWorkflows: staleWorkflowsFor(s.staleAdapters),
    now,
  };
}

const DEFAULT_COHORT_SET: Record<Product, CohortSet> = { ULIP: "insurer", Traditional: "insurer", Term: "starter" };
const SEED_STALE = FILE_ADAPTERS.filter((a) => a.stale).map((a) => a.id);

function initialTicker(): TickerItem[] {
  const ctx = ctxFrom(
    { activeCohortSet: DEFAULT_COHORT_SET, receipts: SEED_RECEIPTS, killSwitchGlobal: false, killedWorkflows: [], staleAdapters: SEED_STALE },
    NOW,
  );
  return TICKER_POOL.slice(0, 40).map((idx, k) => {
    const p = BASE_POLICIES[idx]!;
    const at = new Date(NOW.getTime() - k * TICK_MS * 1.7);
    return { id: tickerSeq++, at: at.toISOString(), decision: evaluate(p, SEED_RULES, { ...ctx, now: at }), product: p.product };
  });
}

function seedAudit(ticker: TickerItem[]): AuditEntry[] {
  const out: AuditEntry[] = ticker.map((t) => ({
    id: auditSeq++,
    at: t.at,
    actor: "Engine",
    kind: t.decision.cancelledReason ? ("cancel" as const) : ("decision" as const),
    policyId: t.decision.policyId,
    ruleId: t.decision.ruleId,
    detail: t.decision.cancelledReason ? `${t.decision.action} (cancelled: ${t.decision.cancelledReason})` : t.decision.action,
  }));
  out.push(
    { id: auditSeq++, at: "2026-10-26T16:40:00.000Z", actor: "Ops / remittance", kind: "setting", detail: "bounce_returns marked late; R4 paused until it arrives" },
    { id: auditSeq++, at: "2026-10-03T05:50:00.000Z", actor: "MIS / analytics", kind: "setting", detail: "risk_cohorts_2026-10.csv loaded; insurer cohorts A1-A5 active for ULIP and Traditional" },
    { id: auditSeq++, at: "2026-10-01T04:30:00.000Z", actor: "Head of Persistency", kind: "approval", detail: "Insurer defaults D1, D2, D3 confirmed" },
    { id: auditSeq++, at: "2026-10-01T04:00:00.000Z", actor: "Compliance", kind: "approval", detail: "Guardrails G1 to G5 locked" },
  );
  return out;
}

function initialData() {
  const ticker = initialTicker();
  return {
    overrides: {} as Record<string, Partial<Policy>>,
    extraTimeline: {} as Record<string, TimelineEvent[]>,
    audit: seedAudit(ticker),
    rules: SEED_RULES,
    pending: SEED_PENDING,
    receipts: SEED_RECEIPTS,
    killSwitchGlobal: false,
    killedWorkflows: [] as string[],
    activeCohortSet: DEFAULT_COHORT_SET,
    ticker,
    tickCount: 0,
    rulesVersion: 0,
    testNumber: null as string | null,
    vendorModes: Object.fromEntries(VENDORS.map((v) => [v.id, v.defaultMode])) as Record<string, VendorMode>,
    proofMethod: "none" as ProofMethod,
    stationLabels: {} as Record<number, string>,
    staleAdapters: SEED_STALE,
    adapterEnabled: Object.fromEntries(FILE_ADAPTERS.map((a) => [a.id, a.enabled])) as Record<string, boolean>,
    cohortFile: { droppedName: "risk_cohorts_2026-10.csv", at: "2026-10-03T05:50:00.000Z" } as { droppedName: string; at: string } | null,
    savedCohorts: [] as SavedCohort[],
    starterWeights: DEFAULT_WEIGHTS,
    bandCutoffs: [...DEFAULT_BAND_CUTOFFS] as number[],
    languages: [...LANGUAGES] as string[],
    enabledPersonas: PERSONAS.map((p) => p.id),
    personaActions: {} as Record<string, string>,
  };
}

/** localStorage key for saved work. Bump the version when the saved shape changes. */
export const STORE_KEY = "pct-store-v1";

export const usePersistencyStore = create<PersistencyState>()(
  persist(
  (set, get) => {
  const now = () => new Date(NOW.getTime() + get().tickCount * TICK_MS);
  const entry = (e: Omit<AuditEntry, "id" | "at">): AuditEntry => ({ id: auditSeq++, at: now().toISOString(), ...e });
  const pushAudit = (...entries: AuditEntry[]) => set((s) => ({ audit: [...entries, ...s.audit].slice(0, 600) }));

  return {
    ...initialData(),

    simulate: (policyId, event) => {
      const s = get();
      const before = mergedPolicy(policyId, s.overrides);
      if (!before) return;
      const at = now();
      const ctx = ctxFrom(s, at);
      const pre = evaluate(before, s.rules, ctx);
      const result = applyEvent(before, event, at);
      const after = { ...before, ...result.patch } as Policy;
      const receipts = result.addReceipt && !s.receipts.includes(policyId) ? [...s.receipts, policyId] : s.receipts;
      const post = evaluate(after, s.rules, { ...ctx, receipts: new Set(receipts) });

      const entries: TimelineEvent[] = [result.timeline];
      const audit: AuditEntry[] = [entry({ actor: "Simulator", kind: "event", policyId, detail: `${event} simulated` })];
      let note: string | undefined;
      if (event === "Payment received" && !pre.frozen && pre.ruleId !== "G5") {
        entries.push({ at: at.toISOString(), kind: "decision", title: `Pending action cancelled: paid meanwhile`, detail: `${pre.action} (${pre.ruleId}) via ${pre.executor}` });
        audit.push(entry({ actor: "Engine", kind: "cancel", policyId, ruleId: pre.ruleId, detail: `Cancelled "${pre.action}": paid meanwhile` }));
        note = `Cancelled "${pre.action}": paid meanwhile`;
      }
      if (post.frozen) {
        entries.push({ at: at.toISOString(), kind: "decision", title: "Outreach frozen", detail: `${post.ruleName} (${post.ruleId})` });
        note = `Outreach frozen by ${post.ruleId}`;
      }
      entries.push({ at: at.toISOString(), kind: "state", title: `State: ${after.state}`, detail: `Next: ${post.action} (${post.ruleId})` });
      audit.push(entry({ actor: "Engine", kind: "decision", policyId, ruleId: post.ruleId, detail: post.action }));

      set({
        overrides: { ...s.overrides, [policyId]: { ...s.overrides[policyId], ...result.patch } },
        extraTimeline: { ...s.extraTimeline, [policyId]: [...entries.reverse(), ...(s.extraTimeline[policyId] ?? [])] },
        receipts,
        audit: [...audit.reverse(), ...s.audit].slice(0, 600),
        ticker: [{ id: tickerSeq++, at: at.toISOString(), decision: post, product: after.product, note }, ...s.ticker].slice(0, 60),
      });
    },

    tick: () => {
      const s = get();
      const count = s.tickCount + 1;
      const idx = TICKER_POOL[(40 + count) % TICKER_POOL.length];
      const p = mergedPolicy(BASE_POLICIES[idx!]!.policyId, s.overrides)!;
      const at = new Date(NOW.getTime() + count * TICK_MS);
      const decision = evaluate(p, s.rules, ctxFrom(s, at));
      set({
        tickCount: count,
        ticker: [{ id: tickerSeq++, at: at.toISOString(), decision, product: p.product }, ...s.ticker].slice(0, 60),
        audit: [
          { id: auditSeq++, at: at.toISOString(), actor: "Engine", kind: decision.cancelledReason ? ("cancel" as const) : ("decision" as const), policyId: p.policyId, ruleId: decision.ruleId, detail: decision.cancelledReason ? `${decision.action} (cancelled: ${decision.cancelledReason})` : decision.action },
          ...s.audit,
        ].slice(0, 600),
      });
    },

    approve: (changeId, actor = "Head of Persistency", effectiveFrom) => {
      const s = get();
      const change = s.pending.find((c) => c.id === changeId);
      if (!change) return;
      const rule = effectiveFrom ? { ...change.rule, effectiveFrom } : change.rule;
      const exists = s.rules.some((r) => r.id === rule.id);
      const rules = exists ? s.rules.map((r) => (r.id === rule.id ? rule : r)) : [...s.rules, rule];
      set({ rules, rulesVersion: s.rulesVersion + 1, pending: s.pending.filter((c) => c.id !== changeId) });
      pushAudit(entry({ actor, kind: "approval", ruleId: rule.id, detail: `Approved: ${change.title}${effectiveFrom ? ` (from ${effectiveFrom})` : ""}` }));
    },

    reject: (changeId, actor = "Head of Persistency", reason) => {
      const s = get();
      const change = s.pending.find((c) => c.id === changeId);
      if (!change) return;
      set({ pending: s.pending.filter((c) => c.id !== changeId) });
      pushAudit(entry({ actor, kind: "rule-change", ruleId: change.rule.id, detail: `Returned: ${change.title}${reason ? ` (${reason})` : ""}` }));
    },

    propose: (change) => {
      set((s) => ({ pending: [change, ...s.pending.filter((c) => c.id !== change.id)] }));
      pushAudit(entry({ actor: change.proposedBy, kind: "rule-change", ruleId: change.rule.id, detail: `Proposed: ${change.title} (waiting for ${change.rule.needsApprovalFrom})` }));
    },

    applyNow: (change, actor) => {
      const s = get();
      const exists = s.rules.some((r) => r.id === change.rule.id);
      const rules = exists ? s.rules.map((r) => (r.id === change.rule.id ? change.rule : r)) : [...s.rules, change.rule];
      set({ rules, rulesVersion: s.rulesVersion + 1, pending: s.pending.filter((c) => c.id !== change.id) });
      pushAudit(entry({ actor, kind: "approval", ruleId: change.rule.id, detail: `Approved: ${change.title}` }));
    },

    setKillSwitch: (on) => {
      set({ killSwitchGlobal: on });
      pushAudit(entry({ actor: "Compliance", kind: "kill-switch", detail: on ? "Global kill switch turned on" : "Global kill switch turned off" }));
    },

    setWorkflowKilled: (workflowId, on) => {
      set((s) => ({ killedWorkflows: on ? [...new Set([...s.killedWorkflows, workflowId])] : s.killedWorkflows.filter((w) => w !== workflowId) }));
      pushAudit(entry({ actor: "Compliance", kind: "kill-switch", detail: `${workflowId} ${on ? "paused" : "resumed"}` }));
    },

    setActiveCohortSet: (product, cohortSet) => {
      set((s) => ({ activeCohortSet: { ...s.activeCohortSet, [product]: cohortSet } }));
      const label = cohortSet === "insurer" ? "insurer cohorts" : cohortSet === "rules" ? "rules cohorts" : "Desible starter score";
      pushAudit(entry({ actor: "Head of Persistency", kind: "setting", detail: `${product} now decides with ${label}` }));
    },

    setTestNumber: (n) => {
      set({ testNumber: n });
      pushAudit(entry({ actor: "Setup", kind: "setting", detail: n ? "Registered test number saved" : "Registered test number removed" }));
    },

    setVendorMode: (vendorId, mode) => {
      set((s) => ({ vendorModes: { ...s.vendorModes, [vendorId]: mode } }));
      const v = VENDORS.find((x) => x.id === vendorId);
      pushAudit(entry({ actor: "Head of Persistency", kind: "setting", detail: `${v?.name ?? vendorId} mode set to ${mode}` }));
    },

    setProofMethod: (m) => set({ proofMethod: m }),

    setStationLabel: (n, label) => set((s) => ({ stationLabels: { ...s.stationLabels, [n]: label } })),

    markAdapterReceived: (id) => {
      set((s) => ({ staleAdapters: s.staleAdapters.filter((a) => a !== id) }));
      pushAudit(entry({ actor: "Ops / remittance", kind: "setting", detail: `${id} received; paused decisions resume` }));
    },

    setAdapterEnabled: (id, on) => {
      set((s) => ({ adapterEnabled: { ...s.adapterEnabled, [id]: on } }));
      pushAudit(entry({ actor: "MIS / analytics", kind: "setting", detail: `${id} adapter ${on ? "turned on" : "turned off"}` }));
    },

    loadCohortFile: (droppedName) => {
      set({ cohortFile: { droppedName, at: now().toISOString() } });
      pushAudit(entry({ actor: "MIS / analytics", kind: "setting", detail: `Cohort file dropped (${droppedName}); seeded risk_cohorts_2026-10.csv used` }));
    },

    saveCohort: (c) => {
      set((s) => ({ savedCohorts: [c, ...s.savedCohorts] }));
      pushAudit(entry({ actor: "Head of Persistency", kind: "setting", detail: `Rules cohort "${c.name}" saved (${c.count} policies)` }));
    },

    setStarterWeights: (w) => set({ starterWeights: w }),
    setBandCutoffs: (c) => set({ bandCutoffs: c }),

    toggleLanguage: (l) => set((s) => ({ languages: s.languages.includes(l) ? s.languages.filter((x) => x !== l) : [...s.languages, l] })),

    togglePersona: (id) =>
      set((s) => ({
        enabledPersonas: s.enabledPersonas.includes(id)
          ? id === "head" ? s.enabledPersonas : s.enabledPersonas.filter((x) => x !== id)
          : [...s.enabledPersonas, id],
      })),

    recordAction: (actor, key, label, policyId) => {
      set((s) => ({ personaActions: { ...s.personaActions, [key]: label } }));
      pushAudit(entry({ actor, kind: "outcome", policyId, detail: label }));
    },

    logOutcome: (policyId, outcome, actor) => {
      if (outcome === "Paid on call") get().simulate(policyId, "Payment received");
      else if (outcome === "Wants to surrender") get().simulate(policyId, "Customer says wants out");
      else if (outcome === "Complaint raised") get().simulate(policyId, "Complaint raised");
      const s = get();
      const p = mergedPolicy(policyId, s.overrides);
      if (!p) return;
      const at = now();
      const patch: Partial<Policy> = { lastTouch: NOW_ISO, lastTouchChannel: "Telecall", touchesLast30d: p.touchesLast30d + 1 };
      if (outcome === "Promised to pay") Object.assign(patch, { state: "Promised", reasonCode: "Will pay later" });
      if (outcome === "Not reached") Object.assign(patch, { reasonCode: "Not reached" });
      const t: TimelineEvent = { at: at.toISOString(), kind: "touch", title: `Telecall: ${outcome}`, detail: `Logged by ${actor} on the handoff screen`, channel: "Telecall" };
      set({
        overrides: { ...s.overrides, [policyId]: { ...s.overrides[policyId], ...patch } },
        extraTimeline: { ...s.extraTimeline, [policyId]: [t, ...(s.extraTimeline[policyId] ?? [])] },
        personaActions: { ...s.personaActions, [`outcome:${policyId}`]: outcome },
      });
      pushAudit(entry({ actor, kind: "outcome", policyId, detail: `Call outcome: ${outcome}` }));
    },

    log: (e) => pushAudit(entry(e)),

    resetDemo: () => {
      auditSeq = 1;
      usePersistencyStore.persist.clearStorage();
      set(initialData());
    },
  };
  },
  {
    name: STORE_KEY,
    version: 1,
    storage: createJSONStorage(() => localStorage),
    // The ticker is rebuilt on load; everything a user changes is kept.
    partialize: (s) => {
      const { ticker: _t, tickCount: _c, ...rest } = s;
      return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function")) as Partial<PersistencyState>;
    },
    onRehydrateStorage: () => (state) => {
      if (state?.audit.length) auditSeq = Math.max(...state.audit.map((a) => a.id)) + 1;
    },
  },
  ),
);

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
  const staleAdapters = usePersistencyStore((s) => s.staleAdapters);
  return useMemo(
    () => ctxFrom({ activeCohortSet, receipts, killSwitchGlobal, killedWorkflows, staleAdapters }, NOW),
    [activeCohortSet, receipts, killSwitchGlobal, killedWorkflows, staleAdapters],
  );
}

/** Decisions for a list of policies, memoised on rules and context. */
export function useDecisions(policies: Policy[], rulesOverride?: Rule[]): Map<string, Decision> {
  const storeRules = usePersistencyStore((s) => s.rules);
  const rules = rulesOverride ?? storeRules;
  const ctx = useEngineContext();
  return useMemo(() => {
    const m = new Map<string, Decision>();
    for (const p of policies) m.set(p.policyId, evaluate(p, rules, ctx));
    return m;
  }, [policies, rules, ctx]);
}

/** File adapters with in-session freshness and on/off applied. */
export function useAdapters(): FileAdapter[] {
  const staleAdapters = usePersistencyStore((s) => s.staleAdapters);
  const adapterEnabled = usePersistencyStore((s) => s.adapterEnabled);
  return useMemo(
    () => FILE_ADAPTERS.map((a) => ({ ...a, stale: staleAdapters.includes(a.id), enabled: adapterEnabled[a.id] ?? a.enabled })),
    [staleAdapters, adapterEnabled],
  );
}

export function useStationLabel(): (n: number, fallback: string) => string {
  const labels = usePersistencyStore((s) => s.stationLabels);
  return (n, fallback) => labels[n] ?? fallback;
}

export function currentTime(tickCount: number): Date {
  return new Date(NOW.getTime() + tickCount * TICK_MS);
}
export { TICK_MS };
