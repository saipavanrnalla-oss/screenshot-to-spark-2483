import { DIMENSION_LABEL, WORKFLOWS, type DimensionKey, type Policy, type Rule } from "@/data/persistency";
import { LEVEL_RANK, dimensionCount, isLive, policyDimensions, policyNumbers, ruleMatches, type EngineContext } from "@/engine/persistency";
import { ruleConditionText } from "./rule-text";

export const EXECUTOR_OPTIONS = [
  "Message agent",
  "Renewal voice agent",
  "Payment assist agent",
  "Call-centre vendor (fixed payout)",
  "Call-centre vendor (variable payout)",
  "WhatsApp vendor",
  "Voice bot vendor",
  "Bank relationship manager",
  "Sales officer",
  "High-value desk",
  "Retention desk",
  "Underwriting",
  "None",
];

export const ACTION_TYPES = [
  "Start a workflow",
  "Set treatment steps",
  "Choose executor",
  "Select script version",
  "Allow or block offers",
  "Set approval",
  "Route handoff",
  "Set target",
  "Exclude",
] as const;

export function workflowOptions(extra: { code: string; name: string }[] = []): { code: string; label: string }[] {
  return [...WORKFLOWS.map((w) => ({ code: w.id, label: `${w.id} ${w.name}` })), ...extra.map((w) => ({ code: w.code, label: `${w.code} ${w.name}` }))];
}

/** Guardrail rows shown locked at the top of the rule list. */
export const GUARDRAIL_LINES = [
  "Registered number only",
  "Policyholder only",
  "Calling hours 9 am to 7 pm",
  "Stop-calling requests honoured",
  "Complaint and bereavement stop all contact",
  "No contact after a completed surrender",
  "Calls only from the 1600 and 1400 number series",
  "Every call recorded",
];

const GUARD_STATES = new Set(["Complaint-hold", "Bereavement-hold", "Do-not-contact", "Paid", "Revived", "Surrender-intent"]);

/** A rule that sends outreach to held, paid or surrendering policies contradicts a guardrail. */
export function guardrailConflict(rule: Rule): string | null {
  if (rule.then.freeze) return null;
  const states = [...(rule.when.state ?? []), ...(rule.conds ?? []).flat().filter((r) => r.dim === "state" && r.op !== "is not").flatMap((r) => r.values)];
  const hit = states.filter((s) => GUARD_STATES.has(s));
  return hit.length ? `Sends outreach to ${hit.join(", ")} policies, which the guardrails stop.` : null;
}

function dimKeys(rule: Rule): string {
  const keys = new Set<string>(Object.entries(rule.when).filter(([, v]) => v && v.length).map(([k]) => k));
  for (const g of rule.conds ?? []) for (const r of g) keys.add(r.dim);
  return [...keys].sort().join(",");
}

/** Two Active rules with the same dimensions and priority cannot coexist. */
export function sameDimsConflict(rule: Rule, rules: Rule[]): Rule | undefined {
  const k = dimKeys(rule);
  return rules.find((r) => r.id !== rule.id && isLive(r) && r.level === rule.level && r.priority === rule.priority && dimKeys(r) === k);
}

export function hasConditions(rule: Rule): boolean {
  return dimensionCount(rule) > 0;
}

export function nextRuleId(rules: Rule[]): string {
  const nums = rules.map((r) => Number(r.id.replace(/\D/g, ""))).filter((n) => !Number.isNaN(n));
  return `R${String(Math.max(16, ...nums) + 1).padStart(2, "0")}`;
}

export function ruleDiff(a: Rule | undefined, b: Rule): string[] {
  if (!a) return ["New rule", `When: ${ruleConditionText(b)}`, `Then: ${b.then.action} by ${b.then.executor}`, `Priority ${b.priority}`];
  const out: string[] = [];
  if (a.name !== b.name) out.push(`Name: ${a.name} → ${b.name}`);
  const ca = ruleConditionText(a);
  const cb = ruleConditionText(b);
  if (ca !== cb) out.push(`When: ${ca} → ${cb}`);
  if (a.then.action !== b.then.action) out.push(`Action: ${a.then.action} → ${b.then.action}`);
  if (a.then.executor !== b.then.executor) out.push(`Executor: ${a.then.executor} → ${b.then.executor}`);
  if (a.then.workflowId !== b.then.workflowId) out.push(`Workflow: ${a.then.workflowId} → ${b.then.workflowId}`);
  if (a.priority !== b.priority) out.push(`Priority: ${a.priority} → ${b.priority}`);
  for (const k of ["script", "offer", "approvals", "handoff", "target", "exclusions"] as const) if ((a.then[k] ?? "") !== (b.then[k] ?? "")) out.push(`${k[0]!.toUpperCase()}${k.slice(1)}: ${a.then[k] ?? "none"} → ${b.then[k] ?? "none"}`);
  if ((a.effectiveFrom ?? "") !== (b.effectiveFrom ?? "")) out.push(`Effective from: ${a.effectiveFrom} → ${b.effectiveFrom}`);
  if ((a.description ?? "") !== (b.description ?? "")) out.push("Description changed");
  return out.length ? out : ["No changes"];
}

export interface TraceRow {
  rule: Rule;
  matched: boolean;
  values: Partial<Record<DimensionKey, string>>;
  dims: number;
}

export interface Trace {
  rows: TraceRow[];
  winner?: Rule | undefined;
  reason: string;
}

/** Every rule considered for one policy, with matched values, the winner and why it won. */
export function decisionTrace(p: Policy, rules: Rule[], ctx: EngineContext): Trace {
  const dims = policyDimensions(p, ctx);
  const nums = policyNumbers(p, ctx.now);
  const rows: TraceRow[] = rules.filter(isLive).map((r) => {
    const matched = ruleMatches(r, dims, nums);
    const values: Partial<Record<DimensionKey, string>> = {};
    for (const k of Object.keys(r.when) as DimensionKey[]) values[k] = dims[k].join(", ");
    for (const g of r.conds ?? []) for (const row of g) values[row.dim] = row.op === "within N days of" ? `${nums.daysToDue} days to due` : row.dim === "ticketBand" ? `₹${p.annualisedPremium}` : dims[row.dim].join(", ");
    return { rule: r, matched, values, dims: dimensionCount(r) };
  });
  const m = rows.filter((r) => r.matched).sort((a, b) => LEVEL_RANK[a.rule.level] - LEVEL_RANK[b.rule.level] || b.dims - a.dims || a.rule.priority - b.rule.priority);
  const w = m[0];
  const second = m[1];
  let reason = "No rule matched.";
  if (w) {
    if (!second) reason = "Only matching rule.";
    else if (LEVEL_RANK[w.rule.level] < LEVEL_RANK[second.rule.level]) reason = w.rule.level === "guardrail" ? "Won as a guardrail." : "Won as an insurer default.";
    else if (w.dims !== second.dims) reason = `Won on dimensions matched, ${w.dims} against ${second.dims}.`;
    else if (w.rule.priority !== second.rule.priority) reason = `Won on priority, ${w.rule.priority} against ${second.rule.priority}.`;
    else reason = `Tied with ${second.rule.id} on dimensions and priority.`;
  }
  return { rows: [...m, ...rows.filter((r) => !r.matched)], winner: w?.rule, reason };
}

export function dimLabel(k: string): string {
  return DIMENSION_LABEL[k as DimensionKey] ?? k;
}
