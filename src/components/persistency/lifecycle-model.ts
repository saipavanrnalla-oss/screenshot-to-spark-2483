import { HOLD_STATES, WARMING_STATIONS, type CohortSet, type Policy, type Product, type StageColumn, stageColumn } from "@/data/persistency";
import { cohortLabel, daysToDue } from "@/engine/persistency";

/** Station on the nine-dot warming track (1-6 in Warming, 7-9 inside the renewal window). */
export function trackStation(p: Policy): number | null {
  if (p.lifecycleStage === "Warming") return p.warmingStation ?? null;
  if (p.lifecycleStage === "Renewal window" && (p.state === "Renewal window open" || p.state === "Promised")) {
    const d = daysToDue(p);
    if (d < 0) return null;
    let station = 7;
    for (const s of WARMING_STATIONS) if (-d >= s.dayOffset) station = Math.max(station, s.n);
    return station;
  }
  return null;
}

const HIGH_RISK = new Set(["Lowest propensity", "High", "Band 5"]);

export interface SubStep {
  key: string;
  label: string;
  hint?: string;
}

export const SUB_STEPS: Record<StageColumn, SubStep[]> = {
  Sourcing: [
    { key: "high-risk", label: "High-risk flag", hint: "Top cohort of the active set" },
    { key: "pivc", label: "PIVC", hint: "Pre-issuance verification call pending" },
    { key: "welcome", label: "Welcome call", hint: "Welcome call pending" },
    { key: "free-look", label: "Free-look and NTU watch", hint: "Free-look period open" },
  ],
  Warming: WARMING_STATIONS.map((s) => ({ key: `station-${s.n}`, label: `Station ${s.n}`, hint: `T${s.dayOffset}` })),
  "Renewal window": [
    { key: "window-open", label: "Window open", hint: "T-90 to due date" },
    { key: "promised", label: "Promised", hint: "Customer gave a date" },
    { key: "paid", label: "Paid", hint: "Paid inside the window" },
    { key: "grace", label: "Grace", hint: "15 days Monthly, 30 days others" },
  ],
  "Lapse and revival": [
    { key: "early", label: "Early lapse", hint: "180 days or less: premium plus late fee" },
    { key: "late", label: "Late lapse", hint: "Over 180 days: good-health declaration or medicals" },
    { key: "revival-offered", label: "Revival offered" },
    { key: "revived", label: "Revived" },
  ],
};

export function matchesSub(p: Policy, sub: string, activeCohortSet: Record<Product, CohortSet>): boolean {
  if (!sub) return true;
  if (sub.startsWith("stage:")) return stageColumn(p.lifecycleStage) === sub.slice(6);
  if (sub.startsWith("station-")) return trackStation(p) === Number(sub.slice(8));
  switch (sub) {
    case "high-risk":
      return p.lifecycleStage === "Sourcing" && HIGH_RISK.has(cohortLabel(p, activeCohortSet[p.product]));
    case "pivc":
      return p.state === "PIVC pending";
    case "welcome":
      return p.state === "Welcome pending";
    case "free-look":
      return p.state === "Free-look open";
    case "window-open":
      return p.state === "Renewal window open";
    case "promised":
      return p.state === "Promised";
    case "paid":
      return p.lifecycleStage === "Renewal window" && p.state === "Paid";
    case "grace":
      return p.state === "Grace";
    case "early":
      return p.lifecycleStage === "Early lapse";
    case "late":
      return p.lifecycleStage === "Late lapse";
    case "revival-offered":
      return p.state === "Revival offered";
    case "revived":
      return p.state === "Revived";
    case "wants-out":
      return p.state === "Surrender-intent";
    case "holds":
      return (HOLD_STATES as readonly string[]).includes(p.state);
    default:
      return true;
  }
}

export function subLabel(sub: string): string {
  if (!sub) return "All policies";
  if (sub.startsWith("stage:")) return sub.slice(6);
  if (sub === "wants-out") return "Wants out";
  if (sub === "holds") return "Complaint, bereavement or stop-calling";
  for (const steps of Object.values(SUB_STEPS)) {
    const hit = steps.find((s) => s.key === sub);
    if (hit) return hit.label;
  }
  return sub;
}
