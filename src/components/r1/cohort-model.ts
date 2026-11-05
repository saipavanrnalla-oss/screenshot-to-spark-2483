import { addMonths, hashId, NOW, requiredInstalment, type Policy, type PersistencyPeriod } from "@/data/persistency";
import { branchOf, hasMandate } from "@/data/persistency/r1/common";

/** Targets the Head of Persistency is measured on. Plan values, not results. */
export const TARGETS: Record<13 | 25, number> = { 13: 0.88, 25: 0.8 };

export const DRILL_ORDER = ["Channel", "Product", "Ticket size", "Region", "Branch", "Seller"] as const;
export const CUTS = [...DRILL_ORDER, "Propensity band", "Payment mode", "Autopay", "Customer profile", "Language"] as const;
export type Cut = (typeof CUTS)[number];

const FLS = ["Rohit", "Sneha", "Arjun", "Pooja", "Vikas", "Neha", "Sandeep", "Priya", "Manish", "Kavya", "Amit", "Divya"];
const FLS_LAST = ["Sharma", "Iyer", "Das", "Patil", "Singh", "Rao", "Gupta", "Nair", "Khan", "Mehta"];

export function ticketOf(p: Policy): string {
  return p.annualisedPremium < 200_000 ? "Below Rs 2 lakh" : p.annualisedPremium < 500_000 ? "Rs 2 lakh to 5 lakh" : "Rs 5 lakh and above";
}

/** The person who sold the policy: the advisor in agency, a front-line seller in the bank branch. */
export function sellerOf(p: Policy): string {
  if (p.channel === "Agency") return p.sourceBankOrAdvisor.replace(/^Advisor /, "");
  if (p.channel === "Bancassurance") {
    // Five front-line sellers per bank branch.
    const b = hashId(branchOf(p));
    const k = hashId(p.policyId) % 5;
    return `${FLS[(b + k * 5) % FLS.length]} ${FLS_LAST[((b >>> 3) + k * 3) % FLS_LAST.length]} (FLS)`;
  }
  return p.channel === "Online" ? "Website" : "Direct sales team";
}

export function cutValue(p: Policy, c: Cut): string {
  switch (c) {
    case "Channel": return p.channel;
    case "Product": return p.product;
    case "Ticket size": return ticketOf(p);
    case "Region": return p.region;
    case "Branch": return branchOf(p);
    case "Seller": return sellerOf(p);
    case "Propensity band": return p.insurerCohort;
    case "Payment mode": return p.paymentMode;
    case "Autopay": return hasMandate(p) ? "On autopay" : "Not on autopay";
    case "Customer profile": return p.customerProfile;
    case "Language": return p.language;
  }
}

export function inBlock(p: Policy, period: PersistencyPeriod): boolean {
  return p.monthsSinceIssue >= period - 1 && p.monthsSinceIssue < period + 11;
}

export function persisted(p: Policy, period: PersistencyPeriod): boolean {
  return p.instalmentsPaid >= requiredInstalment(period, p.paymentMode);
}

/** "Issued Oct 2024 to Sep 2025": the rolling 12-month block measured this month. */
export function blockLabel(period: PersistencyPeriod): string {
  const fmt = (d: Date) => d.toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  return `issued ${fmt(addMonths(NOW, -(period + 10)))} to ${fmt(addMonths(NOW, -(period - 1)))}`;
}

export interface SliceRow {
  key: string;
  policies: number;
  premium: number;
  persisted: number;
  premiumPersisted: number;
  rate: number;
  countRate: number;
  atRisk: number;
}

export function slice(policies: Policy[], period: PersistencyPeriod, cut: Cut): SliceRow[] {
  const m = new Map<string, SliceRow>();
  for (const p of policies) {
    if (!inBlock(p, period)) continue;
    const k = cutValue(p, cut);
    const r = m.get(k) ?? { key: k, policies: 0, premium: 0, persisted: 0, premiumPersisted: 0, rate: 0, countRate: 0, atRisk: 0 };
    r.policies++;
    r.premium += p.annualisedPremium;
    if (persisted(p, period)) {
      r.persisted++;
      r.premiumPersisted += p.annualisedPremium;
    } else r.atRisk += p.annualisedPremium;
    m.set(k, r);
  }
  return [...m.values()].map((r) => ({ ...r, rate: r.premium ? r.premiumPersisted / r.premium : 0, countRate: r.policies ? r.persisted / r.policies : 0 }));
}

export function total(rows: SliceRow[]): SliceRow {
  const t = rows.reduce((a, r) => ({ ...a, policies: a.policies + r.policies, premium: a.premium + r.premium, persisted: a.persisted + r.persisted, premiumPersisted: a.premiumPersisted + r.premiumPersisted, atRisk: a.atRisk + r.atRisk }), { key: "All", policies: 0, premium: 0, persisted: 0, premiumPersisted: 0, rate: 0, countRate: 0, atRisk: 0 });
  return { ...t, rate: t.premium ? t.premiumPersisted / t.premium : 0, countRate: t.policies ? t.persisted / t.policies : 0 };
}

/* ---------- M1 to M12 collection waterfall ---------- */

/**
 * Month after the due date in which the 13th-month premium arrived (1 = the due month), or null if
 * it has not arrived. Derived from the policy's paid status and its payment history.
 */
export function paidInMonth(p: Policy, period: PersistencyPeriod): number | null {
  if (!persisted(p, period)) return null;
  const x = hashId(p.policyId + "wf") % 100;
  const late = p.priorLatePayments;
  const dueMonth = addMonths(fromIssue(p), period - 1).getUTCMonth();
  const dec = dueMonth === 11 ? 8 : 0; // December: high volume, same-month collection dips
  const m1 = (hasMandate(p) ? 70 : 52) - late * 9 - dec;
  if (x < m1) return 1;
  if (x < m1 + 18) return 2;
  if (x < m1 + 26) return 3;
  if (x < m1 + 31) return 4;
  return 5 + (x % 8);
}

function fromIssue(p: Policy): Date {
  return new Date(`${p.issueDate}T00:00:00Z`);
}

export interface WaterfallRow {
  month: string;
  due: number;
  dueCount: number;
  cumulative: (number | null)[];
}

/** Due months of the last 12 months, M1 to M12 cumulative share of premium collected. */
export function waterfall(policies: Policy[], period: PersistencyPeriod): WaterfallRow[] {
  const rows: WaterfallRow[] = [];
  for (let k = 11; k >= 0; k--) {
    const monthStart = addMonths(new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1)), -k);
    const key = `${monthStart.getUTCFullYear()}-${monthStart.getUTCMonth()}`;
    const due = policies.filter((p) => {
      const d = addMonths(fromIssue(p), period - 1);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}` === key;
    });
    const prem = due.reduce((a, p) => a + p.annualisedPremium, 0);
    const elapsed = k + 1;
    const cumulative = Array.from({ length: 12 }, (_, i) => {
      if (i + 1 > elapsed) return null;
      const got = due.filter((p) => {
        const m = paidInMonth(p, period);
        return m != null && m <= i + 1;
      }).reduce((a, p) => a + p.annualisedPremium, 0);
      return prem ? got / prem : 0;
    });
    rows.push({ month: monthStart.toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), due: prem, dueCount: due.length, cumulative });
  }
  return rows;
}

/* ---------- This month's due book, in bulk ---------- */

export const BOOK_STEPS = ["Due this month", "Message delivered", "Message read", "Reached on a call", "Promise to pay", "Paid"] as const;
/** Paid counts payments from any route, so it can exceed the call steps: many pay straight from the WhatsApp link. */

export function bookFunnel(p: Policy): Record<(typeof BOOK_STEPS)[number], boolean> {
  const h = (s: string) => hashId(p.policyId + s) % 100;
  const paid = p.monthDue?.status === "paid";
  const delivered = paid || h("dl") < 93;
  const read = delivered && (paid || h("rd") < 68);
  const reached = p.touchesLast30d > 0 && h("rc") < 64;
  const promise = p.monthDue?.status === "promised" || (reached && h("pp") < 70);
  return { "Due this month": true, "Message delivered": delivered, "Message read": read, "Reached on a call": reached, "Promise to pay": promise, Paid: paid };
}
