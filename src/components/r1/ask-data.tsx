import { TARGETS, blockLabel, inBlock, persisted, slice, total } from "@/components/r1/cohort-model";
import { OUTCOMES, flags, outcomeOf, yearChange } from "@/components/r1/review-model";
import type { Policy } from "@/data/persistency";
import { propensityOf } from "@/data/persistency/r1/common";

/**
 * Ask the data, demo version: four set questions a Head of Persistency asks first, answered from the
 * same policy book the dashboard uses. Free text is matched to the nearest question. The assistant that
 * shows the answers is in ask-desible.tsx.
 */

export type QId = "level" | "where" | "why" | "act";

export const QUESTIONS: { id: QId; text: string }[] = [
  { id: "level", text: "What is my 13th month persistency?" },
  { id: "where", text: "Where is 13th month persistency falling?" },
  { id: "why", text: "Why are customers not paying?" },
  { id: "act", text: "What should we do this month?" },
];

export interface Answer {
  lead: string;
  rows?: { label: string; value: string; note?: string | undefined }[] | undefined;
  link?: { to: string; label: string } | undefined;
}

const p1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const p0 = (x: number) => `${Math.round(x * 100)}%`;
const cr = (n: number) => `Rs ${(n / 1e7).toFixed(2)} Cr`;

export function match(text: string): QId | null {
  const t = text.toLowerCase();
  if (/(what should|do this|action|fix|recommend|plan|next)/.test(t)) return "act";
  if (/(why|reason|not paying|cause)/.test(t)) return "why";
  if (/(where|which|falling|drop|worst|channel|product|branch|bank)/.test(t)) return "where";
  if (/(persistency|what is|how are we|13|25|number)/.test(t)) return "level";
  return null;
}

export function answer(id: QId, book: Policy[]): Answer {
  const block = book.filter((p) => inBlock(p, 13));
  const all = total(slice(book, 13, "Channel"));
  const unpaid = block.filter((p) => !persisted(p, 13));
  const unpaidPrem = unpaid.reduce((a, p) => a + p.annualisedPremium, 0);
  switch (id) {
    case "level": {
      const p25 = total(slice(book, 25, "Channel"));
      const ch = yearChange({}, 13, "All");
      return {
        lead: `13th month persistency is ${p1(all.rate)} for policies ${blockLabel(13)}, ${Math.abs((all.rate - TARGETS[13]) * 100).toFixed(1)} points ${all.rate >= TARGETS[13] ? "above" : "below"} the ${p0(TARGETS[13])} target and ${ch >= 0 ? "up" : "down"} ${Math.abs(ch * 100).toFixed(1)} points on a year ago.`,
        rows: [
          { label: "13th month", value: p1(all.rate), note: `${cr(all.premium - all.premiumPersisted)} unpaid` },
          { label: "25th month", value: p1(p25.rate), note: `${((all.rate - p25.rate) * 100).toFixed(1)} points below the 13th` },
          { label: "Gap to target", value: cr(Math.max(0, TARGETS[13] * all.premium - all.premiumPersisted)), note: "Premium to collect to reach 88%" },
        ],
        link: { to: "/persistency/cohort", label: "Open Cohorts" },
      };
    }
    case "where": {
      const cells: { key: string; rate: number; premium: number; loss: number }[] = [];
      for (const c of slice(book, 13, "Channel")) {
        const ps = block.filter((p) => p.channel === c.key);
        for (const pr of slice(ps, 13, "Product")) cells.push({ key: `${c.key}, ${pr.key}`, rate: pr.rate, premium: pr.premium, loss: (all.rate - pr.rate) * pr.premium });
      }
      const worst = cells.filter((c) => c.loss > 0).sort((a, b) => b.loss - a.loss).slice(0, 3);
      return {
        lead: worst.length ? `${worst[0]!.key} pulls the number down most: ${p1(worst[0]!.rate)} against ${p1(all.rate)} for the book.` : "No channel and product is below the book this month.",
        rows: worst.map((w) => ({ label: w.key, value: p1(w.rate), note: `${((w.rate - all.rate) * 100).toFixed(1)} points vs book · ${cr(w.premium)} block` })),
        link: { to: "/persistency/cohort", label: "Drill down in Cohorts" },
      };
    }
    case "why": {
      const by = OUTCOMES.map((o) => ({ o, prem: unpaid.filter((p) => outcomeOf(p) === o).reduce((a, p) => a + p.annualisedPremium, 0) })).sort((a, b) => b.prem - a.prem);
      const low = unpaid.filter((p) => propensityOf(p) === "Low").reduce((a, p) => a + p.annualisedPremium, 0);
      const cancelled = unpaid.filter((p) => flags(p, 13).mandateCancelled).length;
      return {
        lead: `${cr(unpaidPrem)} is unpaid in the 13th month block. ${by[0]!.o} is the largest group at ${p0(by[0]!.prem / Math.max(1, unpaidPrem))} of it.`,
        rows: [
          ...by.map((b) => ({ label: b.o, value: p0(b.prem / Math.max(1, unpaidPrem)), note: cr(b.prem) })),
          { label: "Low propensity", value: p0(low / Math.max(1, unpaidPrem)), note: "of unpaid premium" },
          { label: "Autopay cancelled", value: `${cancelled}`, note: "unpaid policies whose mandate was cancelled" },
        ],
        link: { to: "/persistency/review", label: "Open the Monthly review" },
      };
    }
    case "act": {
      const nc = unpaid.filter((p) => outcomeOf(p) === "Not contactable").length;
      const lowCount = block.filter((p) => propensityOf(p) === "Low" && !persisted(p, 13)).length;
      const cancelled = unpaid.filter((p) => flags(p, 13).mandateCancelled).length;
      return {
        lead: "Three actions cover most of the unpaid premium this month:",
        rows: [
          { label: "Call Low propensity from T-90", value: `${lowCount}`, note: "unpaid Low propensity policies; start the renewal call journey" },
          { label: "Reach the unreachable", value: `${nc}`, note: "not contactable: WhatsApp, alternate number, then a field visit" },
          { label: "Re-register autopay", value: `${cancelled}`, note: "cancelled mandates: send the re-registration link before the next debit" },
        ],
        link: { to: "/persistency/cohort", label: "Raise an action plan" },
      };
    }
  }
}

