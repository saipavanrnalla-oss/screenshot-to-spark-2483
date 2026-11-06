/**
 * The monthly persistency review pack: the cuts a Head of Persistency takes to the leadership review.
 * Every figure is computed from the policy book; flags the generator does not carry (calling outcome,
 * autopay cancelled, complaint, replacement, WhatsApp and app opt-in) are derived per policy from its
 * paid status and history, so each cut adds up to the same block.
 */
import { addMonths, hashId, NOW, type Policy, type PersistencyPeriod } from "@/data/persistency";
import { inBlock, persisted } from "@/components/r1/cohort-model";
import { persistencySeries, type SeriesFilter } from "@/data/persistency/r1/reports";

export type ProductView = "All" | "ULIP" | "Traditional";

/** Channel rows in the order the review shows them; bank partners sit under Bancassurance. */
export interface ReviewRowKey {
  key: string;
  level: 0 | 1;
  total?: boolean | undefined;
  match: (p: Policy) => boolean;
  /** The same cut in the monthly trend series, for the year-on-year change. */
  filter: SeriesFilter;
}

export function reviewRows(policies: Policy[]): ReviewRowKey[] {
  const banks = [...new Set(policies.filter((p) => p.channel === "Bancassurance").map((p) => p.sourceBankOrAdvisor))].sort();
  return [
    { key: "Agency", level: 0, match: (p) => p.channel === "Agency", filter: { channel: "Agency" } },
    ...banks.map((b): ReviewRowKey => ({ key: b, level: 1, match: (p) => p.channel === "Bancassurance" && p.sourceBankOrAdvisor === b, filter: { channel: "Bancassurance", branch: b } })),
    { key: "Bancassurance total", level: 0, total: true, match: (p) => p.channel === "Bancassurance", filter: { channel: "Bancassurance" } },
    { key: "Online", level: 0, match: (p) => p.channel === "Online", filter: { channel: "Online" } },
    { key: "Direct", level: 0, match: (p) => p.channel === "Direct", filter: { channel: "Direct" } },
    { key: "Grand total", level: 0, total: true, match: () => true, filter: {} },
  ];
}

const h = (p: Policy, s: string) => hashId(p.policyId + s) % 1000;

export function productOk(p: Policy, v: ProductView): boolean {
  return v === "All" ? true : p.product === v;
}

/** The block measured this month, and the same block measured a year ago. */
export function blockOf(policies: Policy[], period: PersistencyPeriod, v: ProductView): Policy[] {
  return policies.filter((p) => inBlock(p, period) && productOk(p, v));
}

/** Change in points over twelve report months for a cut, from the monthly trend series. */
export function yearChange(filter: SeriesFilter, period: PersistencyPeriod, v: ProductView): number {
  const s = persistencySeries({ ...filter, ...(v === "All" ? {} : { product: v }) });
  const key = `p${period}` as "p13" | "p25";
  return (s[s.length - 1]![key] - s[s.length - 13]![key]) / 100;
}

export interface Agg {
  policies: number;
  premium: number;
  paid: number;
  paidCount: number;
  rate: number;
  unpaid: number;
  unpaidCount: number;
}

export function agg(ps: Policy[], period: PersistencyPeriod): Agg {
  let premium = 0, paid = 0, paidCount = 0;
  for (const p of ps) {
    premium += p.annualisedPremium;
    if (persisted(p, period)) { paid += p.annualisedPremium; paidCount++; }
  }
  return { policies: ps.length, premium, paid, paidCount, rate: premium ? paid / premium : 0, unpaid: premium - paid, unpaidCount: ps.length - paidCount };
}

/* ---------- Propensity bands ---------- */

const COHORT_BASE: Record<string, number> = { "Lowest propensity": 1, "Low propensity": 3, "Moderate propensity": 5, "High propensity": 7, "Highest propensity": 9 };

/** P1 to P10 from the insurer's five propensity groups; null when unscored. */
export function bandOf(p: Policy): number | null {
  const b = COHORT_BASE[p.insurerCohort];
  return b == null ? null : b + (h(p, "band") % 2);
}

/* ---------- Ticket size on AFYP ---------- */

export const TICKETS = ["Below 25K", "25K to 50K", "50K to 1 lakh", "1 to 3 lakh", "3 to 5 lakh", "Above 5 lakh"] as const;
export type Ticket = (typeof TICKETS)[number];

export function ticketOf(p: Policy): Ticket {
  const a = p.annualisedPremium;
  return a < 25_000 ? "Below 25K" : a < 50_000 ? "25K to 50K" : a < 100_000 ? "50K to 1 lakh" : a < 300_000 ? "1 to 3 lakh" : a < 500_000 ? "3 to 5 lakh" : "Above 5 lakh";
}

/* ---------- Calling outcome on unpaid policies ---------- */

export const OUTCOMES = ["Not interested to pay", "Not contactable", "Undecided", "Promise to pay"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export function outcomeOf(p: Policy): Outcome {
  if (p.state === "Promised" || p.reasonCode === "Will pay later") return "Promise to pay";
  if (p.reasonCode === "Mis-sold" || p.reasonCode === "Lost interest" || p.reasonCode === "Wants to surrender") return "Not interested to pay";
  if (p.reasonCode === "Not reached") return "Not contactable";
  if (p.reasonCode === "Money problem") return h(p, "oc") < 450 ? "Not interested to pay" : "Undecided";
  const x = h(p, "oc");
  return x < 320 ? "Not interested to pay" : x < 520 ? "Not contactable" : x < 820 ? "Undecided" : "Promise to pay";
}

/* ---------- Flags derived per policy ---------- */

const MANDATE = new Set(["NACH/ECS mandate", "Credit card SI", "UPI autopay"]);

export function flags(p: Policy, period: PersistencyPeriod) {
  const paid = persisted(p, period);
  const hadMandate = MANDATE.has(p.paymentMethod) || (!paid && h(p, "hm") < 350);
  return {
    hadMandate,
    mandateCancelled: hadMandate && (paid ? h(p, "mc") < 8 : h(p, "mc") < 160),
    rejectedComplaint: paid ? h(p, "rc") < 9 : h(p, "rc") < 55,
    replaced: !paid && h(p, "rp") < 22,
    whatsapp: paid ? h(p, "wa") < 170 : h(p, "wa") < 80,
    app: paid ? h(p, "ap") < 70 : h(p, "ap") < 18,
  };
}

/* ---------- Reporting blocks ---------- */

export const PERIODS = [13, 25, 37, 49, 61] as const;

const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** For a report month, the issue dates each persistency measure covers. */
export function reportingBlocks(months = 3): { report: string; period: number; from: string; to: string }[] {
  const out: { report: string; period: number; from: string; to: string }[] = [];
  const start = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1));
  for (let k = months - 1; k >= 0; k--) {
    const rm = addMonths(start, -k);
    for (const per of PERIODS) {
      const from = addMonths(rm, -(per + 11));
      const toFirst = addMonths(rm, -(per - 1));
      const to = new Date(toFirst.getTime() - 86_400_000);
      out.push({ report: fmt(rm), period: per, from: fmt(from), to: fmt(to) });
    }
  }
  return out;
}

export const crore = (n: number) => (n / 1e7).toFixed(2);
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
