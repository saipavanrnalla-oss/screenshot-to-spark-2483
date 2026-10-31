import { ticketBand, policyYearBand } from "@/engine/persistency";
import type { Policy } from "@/data/persistency";
import type { CohortGroup } from "@/store/persistency";

export const BUILDER_DIMS: { key: string; label: string; values: string[]; get: (p: Policy) => string }[] = [
  { key: "product", label: "Product", values: ["ULIP", "Traditional", "Term"], get: (p) => p.product },
  { key: "policyYear", label: "Policy year", values: ["1", "2", "3", "4-5", "6+"], get: (p) => policyYearBand(p.policyYear) },
  { key: "paymentMode", label: "Payment mode", values: ["Monthly", "Quarterly", "Half-yearly", "Annual"], get: (p) => p.paymentMode },
  { key: "paymentMethod", label: "Payment method", values: ["NACH/ECS mandate", "Credit card SI", "Cash/cheque", "UPI autopay", "Bank branch"], get: (p) => p.paymentMethod },
  { key: "ticketBand", label: "Ticket size", values: ["Under ₹25,000", "₹25,000 to ₹1,00,000", "₹1,00,000 to ₹5,00,000", "₹5,00,000 and above"], get: (p) => ticketBand(p.annualisedPremium) },
  { key: "advisorStatus", label: "Advisor status", values: ["Active", "Inactive", "Left"], get: (p) => p.advisorStatus },
  { key: "region", label: "Region", values: ["North", "South", "East", "West"], get: (p) => p.region },
  { key: "channel", label: "Channel", values: ["Agency", "Bancassurance", "Online", "Direct"], get: (p) => p.channel },
  { key: "customerProfile", label: "Customer profile", values: ["Salaried", "Self-employed", "Senior", "HNI", "NRI"], get: (p) => p.customerProfile },
  { key: "priorLate", label: "Prior late payments", values: ["0", "1", "2", "3+"], get: (p) => (p.priorLatePayments >= 3 ? "3+" : String(p.priorLatePayments)) },
];

const BY_KEY = new Map(BUILDER_DIMS.map((d) => [d.key, d]));

export function groupMatches(p: Policy, g: CohortGroup): boolean {
  const active = g.conditions.filter((c) => c.values.length > 0);
  if (active.length === 0) return true;
  const test = (c: (typeof active)[number]) => {
    const d = BY_KEY.get(c.dim);
    return d ? c.values.includes(d.get(p)) : true;
  };
  return g.op === "AND" ? active.every(test) : active.some(test);
}

export function cohortMatches(p: Policy, groups: CohortGroup[], op: "AND" | "OR"): boolean {
  const active = groups.filter((g) => g.conditions.some((c) => c.values.length > 0));
  if (active.length === 0) return false;
  return op === "AND" ? active.every((g) => groupMatches(p, g)) : active.some((g) => groupMatches(p, g));
}

export function describeGroups(groups: CohortGroup[], op: "AND" | "OR"): string {
  return groups
    .map((g) => {
      const parts = g.conditions.filter((c) => c.values.length).map((c) => `${BY_KEY.get(c.dim)?.label ?? c.dim} is ${c.values.join(" or ")}`);
      return parts.length > 1 ? `(${parts.join(` ${g.op} `)})` : parts[0] ?? "";
    })
    .filter(Boolean)
    .join(` ${op} `);
}
