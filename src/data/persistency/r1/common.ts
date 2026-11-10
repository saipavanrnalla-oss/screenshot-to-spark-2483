import { hashId, bankBranch } from "../derived";
import type { Policy } from "../types";

/** Servicing branch: the bank branch for bank-sourced policies, else a branch in the customer's city. */
const SUFFIX = ["Main", "Central", "North", "South"] as const;
export function branchOf(p: Policy): string {
  return bankBranch(p) ?? `${p.city} ${SUFFIX[hashId(p.policyId + "br") % SUFFIX.length]}`;
}

export const HOLD_REASONS = ["Complaint", "Bereavement", "Stop-calling request", "Other"] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export const DISPOSITIONS = [
  "Will pay (link requested)",
  "Promise to pay with date",
  "Already paid",
  "Mandate problem",
  "Short of cash",
  "Unhappy with the policy",
  "Wants to surrender",
  "Complaint or mis-selling",
  "Asked for a person",
  "Wrong person",
  "Callback requested",
  "Not reachable",
  "Do not call",
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

/** Payment method filter adds "None" for customers with no mandate or autopay. */
export function hasMandate(p: Policy): boolean {
  return p.paymentMethod === "NACH/ECS mandate" || p.paymentMethod === "UPI autopay" || p.paymentMethod === "Credit card SI";
}

export function ticketLabel(premium: number): string {
  return premium < 200_000 ? "Below ₹2 lakh" : premium < 500_000 ? "₹2 lakh to ₹5 lakh" : "₹5 lakh and above";
}

export const TICKET_LABELS = ["Below ₹2 lakh", "₹2 lakh to ₹5 lakh", "₹5 lakh and above"] as const;

/** Deterministic pick from a list using a policy id and a salt. */
export function pickBy<T>(id: string, salt: string, list: readonly T[]): T {
  return list[hashId(id + salt) % list.length]!;
}

/** The insurer's propensity groups, shown everywhere as Low, Medium or High; null when unscored. */
export function propensityOf(p: Policy): "Low" | "Medium" | "High" | null {
  switch (p.insurerCohort) {
    case "Lowest propensity":
    case "Low propensity":
      return "Low";
    case "Moderate propensity":
      return "Medium";
    case "High propensity":
    case "Highest propensity":
      return "High";
    default:
      return null;
  }
}

export const propensityLabel = (p: Policy): string => {
  const x = propensityOf(p);
  return x ? `${x} propensity` : "Not scored";
};
