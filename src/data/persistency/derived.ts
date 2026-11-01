import { Rng } from "./rng";
import { NOW, NOW_ISO, addDays, toIso } from "./dates";
import { BANK_PARTNERS, CITIES, FIRST_NAMES, LAST_NAMES } from "./reference";
import type { InsurerCohort, Policy, RulesCohort, StarterBand } from "./types";
import type { Person } from "./people";

/** Stable 32-bit hash of a policy id, so groupings never change between loads. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 15% random holdout, fixed by policy id. */
export function isHoldout(p: Pick<Policy, "policyId">): boolean {
  return hashId(p.policyId) % 100 < 15;
}

/* ---------- Cohort drift: last month's labels ---------- */

const INS: InsurerCohort[] = ["A1", "A2", "A3", "A4", "A5"];
const RUL: RulesCohort[] = ["Low", "Medium", "High"];

export function lastMonthInsurer(p: Policy): InsurerCohort {
  if (p.insurerCohort === "Unscored") return hashId(p.policyId + "u") % 100 < 70 ? "Unscored" : "A3";
  const h = hashId(p.policyId + "lm");
  if (h % 100 >= 9) return p.insurerCohort;
  const i = INS.indexOf(p.insurerCohort);
  // Last month the book sat slightly lower risk: shifts go down more often than up.
  const j = Math.max(0, Math.min(4, i + (h % 3 === 0 ? 1 : -1)));
  return INS[j]!;
}

export function lastMonthRules(p: Policy): RulesCohort {
  if (p.rulesCohort === "Unscored") return "Unscored";
  const h = hashId(p.policyId + "lr");
  if (h % 100 >= 5) return p.rulesCohort;
  const i = RUL.indexOf(p.rulesCohort);
  return RUL[Math.max(0, Math.min(2, i + (h % 2 === 0 ? 1 : -1)))]!;
}

export function lastMonthBand(p: Policy): StarterBand | null {
  if (p.starterBand === null) return null;
  const h = hashId(p.policyId + "lb");
  if (h % 100 >= 6) return p.starterBand;
  return Math.max(1, Math.min(5, p.starterBand + (h % 2 === 0 ? 1 : -1))) as StarterBand;
}

export function isLapsed(p: Pick<Policy, "lifecycleStage">): boolean {
  return p.lifecycleStage === "Early lapse" || p.lifecycleStage === "Late lapse";
}

/* ---------- Insurer cohort file (risk_cohorts_2026-10.csv) ---------- */

export interface CohortFileStats {
  fileName: string;
  rows: number;
  matched: number;
  unmatched: number;
  duplicates: number;
  unscoredOnBook: number;
  columns: string[];
  sample: Record<string, string>[];
}

export function cohortFileStats(policies: Policy[]): CohortFileStats {
  const scored = policies.filter((p) => p.insurerCohort !== "Unscored");
  const rng = new Rng(1010);
  const unmatched = Math.round(scored.length * 0.003) + rng.int(0, 4);
  const duplicates = Math.round(scored.length * 0.0012) + rng.int(0, 3);
  const sample = scored.slice(0, 5).map((p) => ({
    policy_no: p.policyId,
    risk_cohort: p.insurerCohort,
    risk_score: String(400 + (hashId(p.policyId) % 450)),
    scored_on: "2026-10-03",
  }));
  return {
    fileName: "risk_cohorts_2026-10.csv",
    rows: scored.length + unmatched + duplicates,
    matched: scored.length,
    unmatched,
    duplicates,
    unscoredOnBook: policies.length - scored.length,
    columns: ["policy_no", "risk_cohort", "risk_score", "scored_on"],
    sample,
  };
}

/* ---------- Teams, branches and bank partners ---------- */

export function teamIndex(p: Pick<Policy, "policyId">, teams = 12): number {
  return hashId(p.policyId + "team") % teams;
}

export function agentIndex(p: Pick<Policy, "policyId">, agents = 60): number {
  return hashId(p.policyId + "agent") % agents;
}

export const ZONES = ["North 1", "North 2", "East", "West 1", "West 2", "South 1", "South 2", "South 3"] as const;

export function zoneForCity(city: string): string {
  const i = CITIES.findIndex((c) => c.city === city);
  const c = CITIES[i];
  if (!c) return "North 1";
  const sameRegion = CITIES.filter((x) => x.region === c.region);
  const pos = sameRegion.findIndex((x) => x.city === city);
  if (c.region === "North") return pos < 2 ? "North 1" : "North 2";
  if (c.region === "East") return "East";
  if (c.region === "West") return pos < 2 ? "West 1" : "West 2";
  return pos < 3 ? "South 1" : pos < 5 ? "South 2" : "South 3";
}

export function bankBranch(p: Policy): string | null {
  if (p.channel !== "Bancassurance") return null;
  return `${p.sourceBankOrAdvisor}, ${p.city}`;
}

export function rmName(branch: string): string {
  const h = hashId(branch);
  return `${FIRST_NAMES[h % FIRST_NAMES.length]} ${LAST_NAMES[(h >>> 8) % LAST_NAMES.length]}`;
}

export { BANK_PARTNERS };

/* ---------- Day-by-day collection for the month ---------- */

export interface DayCollection {
  day: number;
  label: string;
  collected: number;
  cumulative: number;
  planCumulative: number;
}

/** Daily collection (scaled to the insurer book) from paid-on dates in the seeded month. */
export function dailyCollection(policies: Policy[], scale: number, planCr: number): DayCollection[] {
  const byDay = new Array<number>(32).fill(0);
  for (const p of policies) {
    const d = p.monthDue;
    if (d?.status !== "paid" || !d.paidOn) continue;
    if (!d.paidOn.startsWith("2026-10")) continue;
    const day = Number(d.paidOn.slice(8, 10));
    byDay[day] = (byDay[day] ?? 0) + d.amount * scale;
  }
  const today = Number(NOW_ISO.slice(8, 10));
  const out: DayCollection[] = [];
  let cum = 0;
  for (let day = 1; day <= 31; day++) {
    const v = day <= today ? (byDay[day] ?? 0) / 1e7 : 0;
    cum += v;
    out.push({
      day,
      label: `${String(day).padStart(2, "0")} Oct`,
      collected: day <= today ? v : 0,
      cumulative: cum,
      planCumulative: (planCr * day) / 31,
    });
  }
  return out;
}

/* ---------- Call QA samples (conduct checks) ---------- */

export const CONDUCT_CHECKS = [
  "No threat or pressure",
  "No false promise",
  "No mis-selling language",
  "Language matches customer",
  "Call purpose disclosed",
] as const;
export type ConductCheck = (typeof CONDUCT_CHECKS)[number];

export interface QaSample {
  id: string;
  policyId: string;
  at: string;
  executor: string;
  channel: string;
  results: Record<ConductCheck, boolean>;
  note: string;
}

export function qaSamples(policies: Policy[]): QaSample[] {
  const rng = new Rng(5150);
  const pool = policies.filter((p) => p.lastTouchChannel === "Telecall" || p.lastTouchChannel === "Voice bot");
  const out: QaSample[] = [];
  for (let i = 0; i < 30 && pool.length; i++) {
    const p = pool[Math.floor(rng.next() * pool.length)]!;
    const results = Object.fromEntries(CONDUCT_CHECKS.map((c) => [c, !rng.chance(c === "Language matches customer" ? 0.08 : 0.03)])) as Record<ConductCheck, boolean>;
    const failed = CONDUCT_CHECKS.filter((c) => !results[c]);
    out.push({
      id: `QA-${String(1201 + i)}`,
      policyId: p.policyId,
      at: addDays(NOW, -(i % 6)).toISOString(),
      executor: p.lastTouchChannel === "Voice bot" ? "Voice bot vendor" : p.assignedVendor === "WhatsApp vendor" ? "Call-centre vendor (fixed payout)" : p.assignedVendor,
      channel: p.lastTouchChannel ?? "Telecall",
      results,
      note: failed.length === 0 ? "All checks passed" : `Failed: ${failed.join(", ")}. Sent to vendor quality lead.`,
    });
  }
  return out;
}

/* ---------- What changed since yesterday ---------- */

export const YESTERDAY_ISO = toIso(addDays(NOW, -1));

export interface ChangeItem {
  label: string;
  value: number;
  tone: "healthy" | "attention" | "failed" | "live";
}

export function sinceYesterday(policies: Policy[]): Record<string, number> {
  let paidToday = 0, lapsedYesterday = 0, newPromises = 0, newWantsOut = 0, newHolds = 0, branchPaid = 0, enteredGrace = 0, revivedToday = 0, bounces = 0;
  for (const p of policies) {
    if (p.monthDue?.paidOn === NOW_ISO || p.monthDue?.paidOn === YESTERDAY_ISO) {
      paidToday++;
      if (p.monthDue.branchPayment) branchPaid++;
    }
    if (p.lapseDate === YESTERDAY_ISO || p.lapseDate === NOW_ISO) lapsedYesterday++;
    const touchedRecently = p.lastTouch === NOW_ISO || p.lastTouch === YESTERDAY_ISO;
    if (p.state === "Promised" && touchedRecently) newPromises++;
    if (p.state === "Surrender-intent" && touchedRecently) newWantsOut++;
    if ((p.state === "Complaint-hold" || p.state === "Bereavement-hold" || p.state === "Do-not-contact") && touchedRecently) newHolds++;
    if (p.state === "Grace") {
      const due = p.dueDate;
      if (due === YESTERDAY_ISO || due === NOW_ISO) enteredGrace++;
    }
    if (p.revivedOn === NOW_ISO || p.revivedOn === YESTERDAY_ISO) revivedToday++;
    if (p.reasonCode === "Mandate bounce" && touchedRecently) bounces++;
  }
  return { paidToday, lapsedYesterday, newPromises, newWantsOut, newHolds, branchPaid, enteredGrace, revivedToday, bounces };
}

export function peopleByRole(people: Person[], role: Person["role"]): Person[] {
  return people.filter((p) => p.role === role);
}

/* ---------- Illustrative unit costs (labelled illustrative wherever shown) ---------- */

export const UNIT_COSTS: Record<string, { unit: string; cost: number }> = {
  "Call-centre vendor (fixed payout)": { unit: "per call", cost: 38 },
  "Call-centre vendor (variable payout)": { unit: "per call", cost: 45 },
  "WhatsApp vendor": { unit: "per message", cost: 1 },
  "Voice bot vendor": { unit: "per call", cost: 6 },
  Desible: { unit: "per action", cost: 12 },
};

/* ---------- Seeded queue details for persona screens ---------- */

const WANTS_OUT_REASONS = ["Needs the money now", "Unhappy with fund returns", "Found a cheaper policy", "Advisor left, feels unserviced", "Premium too high after salary change"] as const;
export function wantsOutReason(p: Policy): string {
  return WANTS_OUT_REASONS[hashId(p.policyId + "wo") % WANTS_OUT_REASONS.length]!;
}

export const RETENTION_OFFERS: Record<Policy["product"], string[]> = {
  ULIP: ["Partial withdrawal instead of surrender", "Premium holiday after lock-in", "Switch to a lower-risk fund"],
  Traditional: ["Reduced paid-up policy", "Change to monthly mode", "Policy loan against surrender value"],
  Term: ["Change to monthly mode", "Reduce cover to lower the premium"],
};

export function revivalRequirement(p: Policy): "Good-health declaration" | "Medicals" {
  const daysLapsed = p.lapseDate ? Math.round((NOW.getTime() - new Date(`${p.lapseDate}T00:00:00Z`).getTime()) / 86_400_000) : 0;
  return p.annualisedPremium >= 300_000 || daysLapsed > 540 ? "Medicals" : "Good-health declaration";
}

export function revivalStatus(p: Policy): "Declaration received" | "Awaiting medicals" | "Medical reports in" | "Awaiting declaration" {
  const h = hashId(p.policyId + "uw") % 4;
  if (revivalRequirement(p) === "Medicals") return h < 2 ? "Awaiting medicals" : "Medical reports in";
  return h < 3 ? "Declaration received" : "Awaiting declaration";
}

export type MandateState = "Active" | "Pending registration" | "Rejected by bank" | "Cancelled by customer";
export function mandateState(p: Policy): MandateState | null {
  if (p.paymentMethod !== "NACH/ECS mandate" && p.paymentMethod !== "UPI autopay") return null;
  if (p.reasonCode === "Mandate failed") return "Rejected by bank";
  const h = hashId(p.policyId + "md") % 100;
  if (p.lifecycleStage === "Sourcing" && h < 40) return "Pending registration";
  if (h < 2) return "Cancelled by customer";
  if (h < 5) return "Pending registration";
  return "Active";
}

export function bounceStage(p: Policy): "Re-presentation scheduled" | "Re-presented, awaiting result" | "Failed again" {
  const h = hashId(p.policyId + "bn") % 3;
  return h === 0 ? "Re-presentation scheduled" : h === 1 ? "Re-presented, awaiting result" : "Failed again";
}
