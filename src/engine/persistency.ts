import { NOW, addDays, diffDays, fromIso, toIso } from "@/data/persistency/dates";
import { INSURER_NAME, WARMING_STATIONS } from "@/data/persistency/reference";
import { inr } from "@/lib/format";
import type {
  CohortSet,
  ConditionRow,
  Decision,
  DimensionKey,
  Policy,
  Product,
  Rule,
  RuleLevel,
  SimulatedEvent,
  TimelineEvent,
} from "@/data/persistency/types";

export interface EngineContext {
  activeCohortSet: Record<Product, CohortSet>;
  /** Policy ids whose receipt arrived in the latest receipts file. */
  receipts: ReadonlySet<string>;
  killSwitchGlobal: boolean;
  killedWorkflows: ReadonlySet<string>;
  staleWorkflows: ReadonlySet<string>;
  now?: Date;
}

export const LEVEL_RANK: Record<RuleLevel, number> = { guardrail: 0, insurer: 1, rule: 2 };
export const LEVEL_LABEL: Record<RuleLevel, string> = {
  guardrail: "1 · Guardrail",
  insurer: "2 · Insurer default",
  rule: "3 · Most dimensions matched",
};

export function cohortLabel(p: Policy, set: CohortSet): string {
  if (set === "insurer") return p.insurerCohort;
  if (set === "rules") return p.rulesCohort;
  return p.starterBand === null ? "Unscored" : `Band ${p.starterBand}`;
}

export function ticketBand(premium: number): string {
  if (premium < 25_000) return "Under ₹25,000";
  if (premium < 100_000) return "₹25,000 to ₹1,00,000";
  if (premium < 500_000) return "₹1,00,000 to ₹5,00,000";
  return "₹5,00,000 and above";
}

export function policyYearBand(y: number): string {
  return y <= 3 ? String(y) : y <= 5 ? "4-5" : "6+";
}

export function touchBand(n: number): string {
  if (n === 0) return "No touches in 30 days";
  if (n <= 3) return "1 to 3 touches in 30 days";
  if (n <= 7) return "4 to 7 touches in 30 days";
  return "8 or more touches in 30 days";
}

export function calendarValues(now: Date): string[] {
  const out: string[] = [];
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  out.push(now.getUTCDate() > lastDay - 5 ? "Month-end (last 5 days)" : "Mid-month");
  // Diwali 2026 falls on 8 Nov; the festival window runs 25 Oct to 10 Nov.
  const t = now.getTime();
  if (t >= Date.UTC(2026, 9, 25) && t <= Date.UTC(2026, 10, 10, 23, 59)) out.push("Festival window");
  return out;
}

export function policyDimensions(p: Policy, ctx: EngineContext): Record<DimensionKey, string[]> {
  const now = ctx.now ?? NOW;
  return {
    product: [p.product],
    policyYear: [policyYearBand(p.policyYear)],
    paymentMode: [p.paymentMode],
    paymentMethod: [p.paymentMethod],
    channel: [p.channel],
    cohort: [cohortLabel(p, ctx.activeCohortSet[p.product])],
    ticketBand: [ticketBand(p.annualisedPremium)],
    customerProfile: [p.customerProfile],
    language: [p.language, p.region],
    advisorStatus: [p.advisorStatus],
    stage: [p.lifecycleStage],
    state: [p.state.startsWith("Warming station") ? "Warming" : p.state, p.state],
    reasonCode: [p.reasonCode],
    calendar: calendarValues(now),
    touchHistory: [touchBand(p.touchesLast30d)],
    executor: [p.assignedVendor],
    insurer: [INSURER_NAME],
  };
}

/** Numeric facts used by above, below, between and "within N days of" conditions. */
export interface PolicyNumbers {
  ticketSize: number;
  policyYear: number;
  daysToDue: number;
  touches: number;
}

export function policyNumbers(p: Policy, now: Date = NOW): PolicyNumbers {
  return { ticketSize: p.annualisedPremium, policyYear: p.policyYear, daysToDue: diffDays(fromIso(p.dueDate), now), touches: p.touchesLast30d };
}

function numberFor(dim: DimensionKey, nums: PolicyNumbers): number | null {
  if (dim === "ticketBand") return nums.ticketSize;
  if (dim === "policyYear") return nums.policyYear;
  if (dim === "touchHistory") return nums.touches;
  if (dim === "calendar") return nums.daysToDue;
  return null;
}

/** One condition row. Numeric operators need the policy numbers; without them they never match. */
export function conditionMatches(row: ConditionRow, dims: Record<DimensionKey, string[]>, nums?: PolicyNumbers): boolean {
  const have = dims[row.dim] ?? [];
  switch (row.op) {
    case "is":
    case "is any of":
      return row.values.length === 0 || have.some((v) => row.values.includes(v));
    case "is not":
      return !have.some((v) => row.values.includes(v));
    case "within N days of": {
      if (!nums || row.n === undefined) return false;
      return nums.daysToDue >= 0 && nums.daysToDue <= row.n;
    }
    default: {
      if (!nums || row.n === undefined) return false;
      const x = numberFor(row.dim, nums);
      if (x === null) return false;
      if (row.op === "above") return x > row.n;
      if (row.op === "below") return x < row.n;
      return x >= row.n && x <= (row.n2 ?? row.n);
    }
  }
}

function groupMatches(group: ConditionRow[], dims: Record<DimensionKey, string[]>, nums?: PolicyNumbers): boolean {
  return group.every((row) => conditionMatches(row, dims, nums));
}

export function ruleMatches(rule: Rule, dims: Record<DimensionKey, string[]>, nums?: PolicyNumbers): boolean {
  const whenOk = (Object.entries(rule.when) as [DimensionKey, string[]][]).every(
    ([k, vals]) => !vals || vals.length === 0 || dims[k].some((v) => vals.includes(v)),
  );
  if (!whenOk) return false;
  if (!rule.conds || rule.conds.length === 0) return true;
  return rule.conds.some((g) => groupMatches(g, dims, nums));
}

export function dimensionCount(rule: Rule): number {
  const keys = new Set(Object.entries(rule.when).filter(([, v]) => v && v.length > 0).map(([k]) => k));
  if (rule.conds?.length) {
    const most = Math.max(0, ...rule.conds.map((g) => new Set(g.map((r) => r.dim)).size));
    return keys.size + most;
  }
  return keys.size;
}

/** Only Active rules decide; Draft, In review and Retired rules are listed but never fire. */
export function isLive(rule: Rule): boolean {
  return (rule.status ?? "Active") === "Active";
}

function compareRules(a: Rule, b: Rule): number {
  return (
    LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
    dimensionCount(b) - dimensionCount(a) ||
    a.priority - b.priority
  );
}

const NON_PAYMENT_WORKFLOWS = new Set(["X1", "X2", "L3", "S3"]);

/**
 * Deterministic decision for one policy.
 * Precedence: guardrails > insurer defaults > most dimensions matched > priority number.
 */
export function evaluate(p: Policy, rules: Rule[], ctx: EngineContext): Decision {
  const now = ctx.now ?? NOW;
  const dims = policyDimensions(p, ctx);
  const nums = policyNumbers(p, now);
  const matched = rules.filter((r) => isLive(r) && ruleMatches(r, dims, nums)).sort(compareRules);
  const best = matched[0];
  if (!best) {
    return {
      policyId: p.policyId,
      ruleId: "none",
      ruleName: "No rule matched",
      level: "rule",
      matchedDimensions: {},
      action: "Watch only",
      workflowId: "",
      executor: "None",
      scheduledAt: now.toISOString(),
      frozen: false,
    };
  }
  const conflicts = matched
    .filter((r) => r !== best && compareRules(r, best) === 0)
    .map((r) => r.id);
  const matchedDimensions: Partial<Record<DimensionKey, string>> = {};
  for (const [k, vals] of Object.entries(best.when) as [DimensionKey, string[]][]) {
    if (!vals?.length) continue;
    const hit = dims[k].find((v) => vals.includes(v));
    if (hit !== undefined) matchedDimensions[k] = hit;
  }
  const group = best.conds?.find((g) => g.every((row) => conditionMatches(row, dims, nums)));
  for (const row of group ?? []) {
    if (row.op === "within N days of") matchedDimensions[row.dim] = `${nums.daysToDue} days to due`;
    else if (row.op === "above" || row.op === "below" || row.op === "between") {
      const x = row.dim === "ticketBand" ? inr(nums.ticketSize) : row.dim === "policyYear" ? `Year ${nums.policyYear}` : String(nums.touches);
      matchedDimensions[row.dim] = x;
    } else matchedDimensions[row.dim] = dims[row.dim].find((v) => row.op === "is not" || row.values.includes(v)) ?? dims[row.dim][0] ?? "";
  }
  const decision: Decision = {
    policyId: p.policyId,
    ruleId: best.id,
    ruleName: best.name,
    level: best.level,
    matchedDimensions,
    action: best.then.action,
    workflowId: best.then.workflowId,
    executor: best.then.executor,
    scheduledAt: new Date(now.getTime() + best.then.delayHours * 3_600_000).toISOString(),
    frozen: !!best.then.freeze,
    conflictWith: conflicts.length ? conflicts : undefined,
  };
  if (!decision.frozen) {
    if (ctx.killSwitchGlobal || ctx.killedWorkflows.has(decision.workflowId)) decision.cancelledReason = "Kill switch on";
    else if (ctx.staleWorkflows.has(decision.workflowId)) decision.cancelledReason = "Stale input";
    else if (!NON_PAYMENT_WORKFLOWS.has(decision.workflowId) && ctx.receipts.has(p.policyId) && p.state !== "Paid" && p.state !== "Revived")
      decision.cancelledReason = "Paid since the list";
  }
  return decision;
}

export interface EventResult {
  patch: Partial<Policy>;
  addReceipt: boolean;
  timeline: TimelineEvent;
}

/** Moves the per-policy state machine for a simulated event. */
export function applyEvent(p: Policy, event: SimulatedEvent, at: Date = NOW): EventResult {
  const stamp = at.toISOString();
  const lapsed = p.lifecycleStage === "Early lapse" || p.lifecycleStage === "Late lapse";
  switch (event) {
    case "Payment received":
      return {
        patch: lapsed
          ? { state: "Revived", revivedOn: toIso(at), reasonCode: "None" }
          : {
              state: "Paid",
              reasonCode: "None",
              monthDue: p.monthDue ? { ...p.monthDue, status: "paid", paidOn: toIso(at) } : undefined,
            },
        addReceipt: true,
        timeline: { at: stamp, kind: "event", title: lapsed ? "Revival premium received" : "Payment received", detail: "Receipt matched in receipts file" },
      };
    case "Bounce":
      return {
        patch: { state: "Grace", lifecycleStage: lapsed ? p.lifecycleStage : "Renewal window", reasonCode: "Mandate bounce" },
        addReceipt: false,
        timeline: { at: stamp, kind: "event", title: "Mandate bounce returned", detail: "Bounce code: insufficient funds" },
      };
    case "Mandate failed":
      return {
        patch: {
          reasonCode: "Mandate failed",
          ...(p.lifecycleStage === "Renewal window" ? { state: "Grace" as const } : {}),
        },
        addReceipt: false,
        timeline: { at: stamp, kind: "event", title: "Mandate registration failed", detail: "Mandate status file: rejected by bank" },
      };
    case "Customer says wants out":
      return {
        patch: { state: "Surrender-intent", reasonCode: "Wants to surrender" },
        addReceipt: false,
        timeline: { at: stamp, kind: "event", title: "Customer says they want out", detail: "Routed to surrender retention" },
      };
    case "Complaint raised":
      return {
        patch: { state: "Complaint-hold" },
        addReceipt: false,
        timeline: { at: stamp, kind: "event", title: "Complaint raised", detail: "All outreach frozen until complaint is closed" },
      };
    case "Bereavement":
      return {
        patch: { state: "Bereavement-hold" },
        addReceipt: false,
        timeline: { at: stamp, kind: "event", title: "Bereavement reported", detail: "All outreach frozen; claims team informed" },
      };
  }
}

/** Deterministic history for a policy, built from its seeded fields. */
export function baseTimeline(p: Policy): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  const issue = fromIso(p.issueDate);
  out.push({ at: issue.toISOString(), kind: "event", title: "Policy issued", detail: `${p.product}, ${p.paymentMode}, via ${p.channel}` });
  if (p.state !== "Welcome pending") {
    out.push({ at: addDays(issue, 3).toISOString(), kind: "touch", title: "Welcome call completed", channel: "Voice" });
  }
  const years = Math.floor(p.monthsSinceIssue / 12);
  const paidYears = p.lapseMonth !== undefined ? Math.floor((p.lapseMonth - 1) / 12) : years;
  for (let y = Math.max(1, paidYears - 2); y <= paidYears; y++) {
    const at = new Date(Date.UTC(issue.getUTCFullYear() + y, issue.getUTCMonth(), issue.getUTCDate()));
    if (at < NOW) out.push({ at: at.toISOString(), kind: "event", title: `Year ${y + 1} renewal premium received` });
  }
  if (p.warmingStation) {
    const s = WARMING_STATIONS[p.warmingStation - 1]!;
    const at = addDays(fromIso(p.dueDate), s.dayOffset);
    if (at <= NOW) out.push({ at: at.toISOString(), kind: "touch", title: `Station ${s.n} sent: ${s.label}`, detail: s.content, channel: s.channel });
  }
  if (p.lapseDate) {
    out.push({ at: fromIso(p.dueDate).toISOString(), kind: "event", title: "Premium due, not paid" });
    out.push({ at: fromIso(p.lapseDate).toISOString(), kind: "state", title: "Grace ended, policy lapsed" });
  }
  if (p.monthDue?.status === "paid" && p.monthDue.paidOn) {
    out.push({ at: fromIso(p.monthDue.paidOn).toISOString(), kind: "event", title: "Instalment received", detail: p.monthDue.branchPayment ? "Paid at bank branch" : undefined });
  }
  if (p.lastTouch && p.lastTouchChannel) {
    const outcome =
      p.state === "Promised" ? "Customer promised to pay" : p.reasonCode === "Not reached" ? "Not reached" : p.reasonCode !== "None" ? `Reason given: ${p.reasonCode}` : "Message delivered";
    out.push({ at: fromIso(p.lastTouch).toISOString(), kind: "touch", title: `${p.lastTouchChannel}: ${outcome}`, channel: p.lastTouchChannel });
  }
  if (p.revivedOn) out.push({ at: fromIso(p.revivedOn).toISOString(), kind: "state", title: "Policy revived" });
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function daysToDue(p: Policy, now: Date = NOW): number {
  return diffDays(fromIso(p.dueDate), now);
}
