import { INSTALMENTS_PER_YEAR, HOLD_STATES, type Policy, type ProductFilter, type Stage, type StageColumn, STAGE_COLUMNS, stageColumn } from "./types";
import { MONTH_PLAN_CR } from "./reference";
import { NOW_ISO } from "./dates";

export const PERSISTENCY_PERIODS = [13, 25, 37, 49, 61] as const;
export type PersistencyPeriod = (typeof PERSISTENCY_PERIODS)[number];

export function filterByProduct<T extends { product: string }>(policies: T[], product: ProductFilter): T[] {
  return product === "All" ? policies : policies.filter((p) => p.product === product);
}

export interface PersistencyRow {
  period: PersistencyPeriod;
  eligible: number;
  persisted: number;
  premiumEligible: number;
  premiumPersisted: number;
  premiumWeighted: number;
  countBased: number;
}

/**
 * Premium-weighted persistency. A policy counts for period P (13, 25 ... months)
 * only if its P-month instalment fell due in the last 12 months. It persisted if the
 * instalment required by its payment mode was paid: Monthly the 13th, Quarterly the
 * 5th, Half-yearly the 3rd, Annual the 2nd (scaled per year for later periods).
 */
export function requiredInstalment(period: PersistencyPeriod, mode: Policy["paymentMode"]): number {
  const years = (period - 1) / 12;
  return years * INSTALMENTS_PER_YEAR[mode] + 1;
}

export function persistency(policies: Policy[]): PersistencyRow[] {
  return PERSISTENCY_PERIODS.map((period) => {
    const start = period - 1;
    let eligible = 0, persisted = 0, premiumEligible = 0, premiumPersisted = 0;
    for (const p of policies) {
      if (p.monthsSinceIssue < start || p.monthsSinceIssue >= start + 12) continue;
      eligible++;
      premiumEligible += p.annualisedPremium;
      if (p.instalmentsPaid >= requiredInstalment(period, p.paymentMode)) {
        persisted++;
        premiumPersisted += p.annualisedPremium;
      }
    }
    return {
      period,
      eligible,
      persisted,
      premiumEligible,
      premiumPersisted,
      premiumWeighted: premiumEligible ? premiumPersisted / premiumEligible : 0,
      countBased: eligible ? persisted / eligible : 0,
    };
  });
}

export interface CollectionSummary {
  planCr: number;
  collectedCr: number;
  dueCount: number;
  paidCount: number;
  promisedCount: number;
  unpaidCount: number;
  upcomingCount: number;
  dueAmount: number;
  paidAmount: number;
  /** Book-scaling factor: insurer plan divided by the seeded sample's due amount. */
  scale: number;
}

/** Plan comes from the insurer (₹182 Cr for the month); collection rate comes from the seeded policies. */
export function collection(all: Policy[], product: ProductFilter): CollectionSummary {
  let dueAll = 0;
  for (const p of all) if (p.monthDue) dueAll += p.monthDue.amount;
  const scale = (MONTH_PLAN_CR * 1e7) / Math.max(dueAll, 1);
  const subset = filterByProduct(all, product);
  let dueAmount = 0, paidAmount = 0, dueCount = 0, paidCount = 0, promisedCount = 0, unpaidCount = 0, upcomingCount = 0;
  for (const p of subset) {
    const d = p.monthDue;
    if (!d) continue;
    dueCount++;
    dueAmount += d.amount;
    if (d.status === "paid") { paidCount++; paidAmount += d.amount; }
    else if (d.status === "promised") promisedCount++;
    else if (d.status === "unpaid") unpaidCount++;
    else upcomingCount++;
  }
  return {
    planCr: (dueAmount * scale) / 1e7,
    collectedCr: (paidAmount * scale) / 1e7,
    dueCount, paidCount, promisedCount, unpaidCount, upcomingCount, dueAmount, paidAmount, scale,
  };
}

export function isHeld(p: Pick<Policy, "state">): boolean {
  return (HOLD_STATES as readonly string[]).includes(p.state);
}

export interface StageSummary {
  column: StageColumn;
  count: number;
  premium: number;
}

export function stageSummary(policies: Policy[]): StageSummary[] {
  const map = new Map<StageColumn, StageSummary>(STAGE_COLUMNS.map((c) => [c, { column: c, count: 0, premium: 0 }]));
  for (const p of policies) {
    const s = map.get(stageColumn(p.lifecycleStage))!;
    s.count++;
    s.premium += p.annualisedPremium;
  }
  return [...map.values()];
}

export function countByStage(policies: Policy[]): Record<Stage, number> {
  const out = { Sourcing: 0, Warming: 0, "Renewal window": 0, "Early lapse": 0, "Late lapse": 0 } as Record<Stage, number>;
  for (const p of policies) out[p.lifecycleStage]++;
  return out;
}

export function revivalRateMtd(policies: Policy[]): { revived: number; base: number; rate: number } {
  let revived = 0, base = 0;
  for (const p of policies) {
    if (p.lifecycleStage !== "Early lapse" && p.lifecycleStage !== "Late lapse") continue;
    base++;
    if (p.state === "Revived" && p.revivedOn && p.revivedOn.slice(0, 7) === NOW_ISO.slice(0, 7)) revived++;
  }
  return { revived, base, rate: base ? revived / base : 0 };
}

export interface HeadlineStats {
  inFlight: number;
  dueThisMonth: number;
  inGrace: number;
  promisedNotPaid: number;
  held: number;
  surrenderIntent: number;
}

export function headline(policies: Policy[]): HeadlineStats {
  let inFlight = 0, dueThisMonth = 0, inGrace = 0, promisedNotPaid = 0, held = 0, surrenderIntent = 0;
  for (const p of policies) {
    if (p.state !== "Revived" && p.state !== "Paid") inFlight++;
    if (p.monthDue) dueThisMonth++;
    if (p.state === "Grace") inGrace++;
    if (p.state === "Promised") promisedNotPaid++;
    if (isHeld(p)) held++;
    if (p.state === "Surrender-intent") surrenderIntent++;
  }
  return { inFlight, dueThisMonth, inGrace, promisedNotPaid, held, surrenderIntent };
}
