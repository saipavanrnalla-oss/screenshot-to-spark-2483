import { propensityLabel } from "@/data/persistency/r1/common";
import type { Policy } from "@/data/persistency";
import { branchOf } from "@/data/persistency/r1/common";
import type { SeriesFilter } from "@/data/persistency/r1/reports";

export const DRILL_LEVELS = ["channel", "product", "ticket", "region", "branch"] as const;
export type DrillLevel = (typeof DRILL_LEVELS)[number];
export const LEVEL_LABEL: Record<DrillLevel, string> = { channel: "Channel", product: "Product", ticket: "Ticket size", region: "Region", branch: "Branch" };
export const TICKETS = ["Below ₹2 lakh", "₹2 lakh to ₹5 lakh", "₹5 lakh and above"] as const;

export function ticketOf(p: Policy): string {
  return p.annualisedPremium < 200_000 ? TICKETS[0] : p.annualisedPremium < 500_000 ? TICKETS[1] : TICKETS[2];
}

export function levelValue(p: Policy, l: DrillLevel): string {
  if (l === "channel") return p.channel;
  if (l === "product") return p.product;
  if (l === "ticket") return ticketOf(p);
  if (l === "region") return p.region;
  return branchOf(p);
}

export function matchesPath(p: Policy, f: SeriesFilter): boolean {
  return (!f.channel || p.channel === f.channel) && (!f.product || p.product === f.product) && (!f.ticket || ticketOf(p) === f.ticket) && (!f.region || p.region === f.region) && (!f.branch || branchOf(p) === f.branch) && (!f.cohort || propensityLabel(p) === f.cohort || p.insurerCohort === f.cohort);
}

const AT_RISK = new Set(["Renewal window open", "Grace", "Promised", "Early lapse", "Lapsed"]);

/** Premium at risk: the instalment of every unpaid policy that is due, in grace or recently lapsed. */
export function premiumAtRisk(p: Policy): number {
  return AT_RISK.has(p.state) && p.monthDue?.status !== "paid" ? p.instalmentAmount : 0;
}

export function isSpecialCare(p: Policy): boolean {
  return p.state === "Complaint-hold" || p.state === "Bereavement-hold" || String(p.customerProfile).toLowerCase().includes("senior");
}
