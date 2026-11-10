import { propensityOf } from "@/data/persistency/r1/common";
import { hashId } from "../derived";
import type { ConditionRow, Policy, Rule } from "../types";
import { BASE_POLICIES } from "../index";
import { persistency } from "../metrics";

export const PERIODS = [13, 25, 37, 49, 61] as const;
export type Period = (typeof PERIODS)[number];

/**
 * The series ends on the persistency measured from the policies themselves, so the latest month on
 * every chart equals what Cohorts and Reports compute from the book. Earlier months trend into it.
 */
const pctOf = (ps: Policy[]): Record<Period, number> =>
  Object.fromEntries(persistency(ps).map((r) => [r.period, +(r.premiumWeighted * 100).toFixed(1)])) as Record<Period, number>;
const BOOK = pctOf(BASE_POLICIES);
const BASE: Record<Period, number> = BOOK;
const off = (pred: (p: Policy) => boolean) => +(pctOf(BASE_POLICIES.filter(pred))[13] - BOOK[13]).toFixed(1);
const ticketOf = (p: Policy) => (p.annualisedPremium < 200_000 ? "Below ₹2 lakh" : p.annualisedPremium < 500_000 ? "₹2 lakh to ₹5 lakh" : "₹5 lakh and above");

export const OFFSETS = {
  channel: Object.fromEntries(["Agency", "Bancassurance", "Online", "Direct"].map((c) => [c, off((p) => p.channel === c)])) as Record<string, number>,
  product: Object.fromEntries(["ULIP", "Traditional", "Term"].map((c) => [c, off((p) => p.product === c)])) as Record<string, number>,
  ticket: Object.fromEntries(["Below ₹2 lakh", "₹2 lakh to ₹5 lakh", "₹5 lakh and above"].map((c) => [c, off((p) => ticketOf(p) === c)])) as Record<string, number>,
  region: Object.fromEntries(["North", "South", "East", "West"].map((c) => [c, off((p) => p.region === c)])) as Record<string, number>,
  cohort: {
    ...Object.fromEntries(["Highest propensity", "High propensity", "Moderate propensity", "Low propensity", "Lowest propensity"].map((c) => [c, off((p) => p.insurerCohort === c)])),
    // Low, Medium and High as screens show them; these keys win over the insurer's raw "Low propensity".
    ...Object.fromEntries((["Low", "Medium", "High"] as const).map((b) => [`${b} propensity`, off((p) => propensityOf(p) === b)])),
  } as Record<string, number>,
};

export interface SeriesFilter {
  channel?: string | undefined;
  product?: string | undefined;
  ticket?: string | undefined;
  region?: string | undefined;
  branch?: string | undefined;
  cohort?: string | undefined;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 36 months, November 2023 to October 2026. */
export const SERIES_MONTHS: { key: string; label: string }[] = Array.from({ length: 36 }, (_, i) => {
  const m = (10 + i) % 12;
  const y = 2023 + Math.floor((10 + i) / 12);
  return { key: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${MONTHS[m]} ${String(y).slice(2)}` };
});

function offsetFor(f: SeriesFilter): number {
  let o = 0;
  if (f.channel) o += OFFSETS.channel[f.channel] ?? 0;
  if (f.product) o += OFFSETS.product[f.product] ?? 0;
  if (f.ticket) o += OFFSETS.ticket[f.ticket] ?? 0;
  if (f.region) o += OFFSETS.region[f.region] ?? 0;
  if (f.branch) o += ((hashId(f.branch) % 70) - 35) / 10;
  if (f.cohort) o += OFFSETS.cohort[f.cohort] ?? 0;
  return o;
}

export interface SeriesPoint {
  key: string;
  label: string;
  p13: number;
  p25: number;
  p37: number;
  p49: number;
  p61: number;
}

/** Seeded monthly persistency, premium-weighted, for a filter combination. */
export function persistencySeries(f: SeriesFilter = {}): SeriesPoint[] {
  const o = offsetFor(f);
  const salt = JSON.stringify(f);
  return SERIES_MONTHS.map((m, i) => {
    const lastPoint = i === SERIES_MONTHS.length - 1;
    const trend = (i - 35) * 0.035;
    const pt = { key: m.key, label: m.label } as SeriesPoint;
    for (const p of PERIODS) {
      const noise = lastPoint ? 0 : ((hashId(`${salt}${m.key}${p}`) % 100) - 50) / 90;
      const scale = p === 13 ? 1 : 0.8;
      (pt as unknown as Record<string, number>)[`p${p}`] = +Math.min(98, Math.max(20, BASE[p] + o * scale + trend + noise)).toFixed(1);
    }
    return pt;
  });
}

/* ---------- Experiments ---------- */

export type ExperimentMethod = "Random untreated holdout" | "Staggered start by region or branch" | "Same period last year";
export type ExperimentStatus = "Draft" | "In review" | "Scheduled" | "Running" | "Finished";

export interface Experiment {
  id: string;
  name: string;
  method: ExperimentMethod;
  status: ExperimentStatus;
  share: number;
  cohorts: string[];
  products: string[];
  start: string;
  end: string;
  excludeSpecialCare: boolean;
  treated: number;
  untreated: number;
  result?: {
    persistency: [number, number];
    collection: [number, number];
    contacts: [number, number];
    costToCollect: [number, number];
  } | undefined;
}

export const SEED_EXPERIMENTS: Experiment[] = [
  {
    id: "EXP-07",
    name: "WhatsApp first, then call, for agency policies without e-NACH",
    method: "Random untreated holdout",
    status: "Finished",
    share: 15,
    cohorts: ["Low propensity"],
    products: ["ULIP", "Traditional"],
    start: "2026-07-01",
    end: "2026-09-30",
    excludeSpecialCare: true,
    treated: 2_310,
    untreated: 408,
    result: { persistency: [71.0, 64.0], collection: [68.4, 61.9], contacts: [3.1, 1.2], costToCollect: [1.9, 1.1] },
  },
  {
    id: "EXP-08",
    name: "Early renewal call for Low propensity at 90 days to due",
    method: "Staggered start by region or branch",
    status: "Finished",
    share: 50,
    cohorts: ["Low propensity"],
    products: ["ULIP", "Traditional", "Term"],
    start: "2026-06-01",
    end: "2026-08-31",
    excludeSpecialCare: true,
    treated: 1_240,
    untreated: 1_198,
    result: { persistency: [66.8, 62.5], collection: [63.1, 59.7], contacts: [2.6, 1.4], costToCollect: [2.4, 1.6] },
  },
  {
    id: "EXP-09",
    name: "Bank balance check before auto-debit",
    method: "Random untreated holdout",
    status: "Draft",
    share: 10,
    cohorts: ["Medium propensity", "Low propensity"],
    products: ["ULIP", "Traditional"],
    start: "2026-12-01",
    end: "2027-02-28",
    excludeSpecialCare: true,
    treated: 0,
    untreated: 0,
  },
];

export const MIN_GROUP = 500;

/* ---------- Proposed changes ---------- */

export interface Proposal {
  id: string;
  title: string;
  evidence: string;
  experimentId: string;
  cohort: string;
  rule: Pick<Rule, "name" | "description" | "stage" | "priority" | "then"> & { when: Rule["when"]; conds?: ConditionRow[][] | undefined };
}

export const PROPOSALS: Proposal[] = [
  {
    id: "PR-1",
    title: "WhatsApp first, then call, for agency policies without e-NACH",
    evidence: "Treated 71 percent against 64 percent untreated, 2,310 policies, from experiment EXP-07.",
    experimentId: "EXP-07",
    cohort: "Low propensity",
    rule: { name: "Agency, no e-NACH: WhatsApp first, then call", description: "From experiment EXP-07.", stage: "Renewal window", priority: 38, when: { channel: ["Agency"], cohort: ["Low propensity", "Lowest propensity"] }, conds: [[{ dim: "paymentMethod", op: "is not", values: ["NACH/ECS mandate"] }]], then: { workflowId: "R1", action: "WhatsApp first, call two days later", executor: "Renewal Reminder Agent", delayHours: 4 } },
  },
  {
    id: "PR-2",
    title: "Early renewal call for Low propensity at 90 days to due",
    evidence: "Treated 66.8 percent against 62.5 percent, 2,438 policies, from experiment EXP-08.",
    experimentId: "EXP-08",
    cohort: "Low propensity",
    rule: { name: "Low propensity early renewal call", description: "From experiment EXP-08.", stage: "Renewal window", priority: 26, when: { cohort: ["Lowest propensity"] }, conds: [[{ dim: "calendar", op: "within N days of", values: ["due date"], n: 90 }]], then: { workflowId: "R1", action: "Early renewal call", executor: "Premium Renewal Voice Agent", delayHours: 6 } },
  },
  {
    id: "PR-3",
    title: "Monthly-mode offer on the first call for short-of-cash customers",
    evidence: "Promises kept 58 percent against 47 percent in the comparison period, 1,120 calls, same period last year.",
    experimentId: "EXP-08",
    cohort: "Medium propensity, Low propensity",
    rule: { name: "Short of cash: monthly mode offer", description: "Same period last year comparison.", stage: "Renewal window", priority: 34, when: { reasonCode: ["Money problem"] }, then: { workflowId: "R2", action: "Offer monthly mode on the call", executor: "Premium Renewal Voice Agent", delayHours: 6, offer: "Mode change to monthly (needs approval)" } },
  },
  {
    id: "PR-4",
    title: "Skip the voice call for Term customers who read the reminder",
    evidence: "Treated 79 percent against 78 percent, 640 policies, from experiment EXP-07. Difference within noise.",
    experimentId: "EXP-07",
    cohort: "High propensity",
    rule: { name: "Term, reminder read: no call", description: "From experiment EXP-07.", stage: "Renewal window", priority: 44, when: { product: ["Term"], cohort: ["Highest propensity", "High propensity"] }, then: { workflowId: "R1", action: "Reminder message only", executor: "Renewal Reminder Agent", delayHours: 6 } },
  },
];

export const PACK_SECTIONS = ["Persistency by period and channel", "Collection against plan", "Reasons by product and cohort"] as const;
