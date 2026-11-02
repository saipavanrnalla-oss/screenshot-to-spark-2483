import { WARMING_STATIONS } from "../reference";
import { DAY_MS, NOW, fromIso, diffDays } from "../dates";
import type { Policy, Product, Stage } from "../types";
import type { Version } from "./types";

export interface Station {
  id: string;
  offset: number;
  channel: "WhatsApp" | "Voice" | "SMS";
  template: string;
  language: string;
}

export interface StageSettings {
  warmingStart: number;
  windowOpens: number;
  graceMonthly: number;
  graceOther: number;
  lapseBoundary: number;
  stations: Station[];
  activeByProduct: Record<Product, Stage[]>;
  interrupts: { event: string; next: string }[];
  revivalYears: Record<Product, number>;
}

export const STAGE_LIST: Stage[] = ["Sourcing", "Warming", "Renewal window", "Early lapse", "Late lapse"];

export const INTERRUPT_NEXT = ["Hold (X1)", "Surrender retention (L3)", "Claims team", "Grievance team", "Back to the open journey"] as const;

export const DEFAULT_STAGE_SETTINGS: StageSettings = {
  warmingStart: 365,
  windowOpens: 90,
  graceMonthly: 15,
  graceOther: 30,
  lapseBoundary: 180,
  stations: WARMING_STATIONS.map((s) => ({
    id: `st${s.n}`,
    offset: s.dayOffset,
    channel: s.channel === "Voice" ? "Voice" : "WhatsApp",
    template: s.label,
    language: "Customer language",
  })),
  activeByProduct: {
    ULIP: [...STAGE_LIST],
    Traditional: [...STAGE_LIST],
    Term: [...STAGE_LIST],
  },
  interrupts: [
    { event: "Complaint", next: "Hold (X1)" },
    { event: "Bereavement", next: "Claims team" },
    { event: "Stop-calling request", next: "Hold (X1)" },
    { event: "Surrender request", next: "Surrender retention (L3)" },
    { event: "Legal threat", next: "Grievance team" },
  ],
  revivalYears: { ULIP: 3, Traditional: 5, Term: 5 },
};

export function seedStageVersions(): Version<StageSettings>[] {
  return [
    { no: 1, status: "Retired", author: "MIS and analytics", at: "2026-04-01T05:00:00.000Z", note: "First release", approver: "Head of Persistency", approvedAt: "2026-04-02T05:00:00.000Z", data: { ...DEFAULT_STAGE_SETTINGS, windowOpens: 60 } },
    { no: 2, status: "Active", author: "MIS and analytics", at: "2026-07-01T05:00:00.000Z", note: "Window opens at 90 days", approver: "Head of Persistency", approvedAt: "2026-07-02T05:00:00.000Z", data: DEFAULT_STAGE_SETTINGS },
  ];
}

function rawStage(p: Policy, s: StageSettings, now: Date): Stage {
  if (p.lifecycleStage === "Sourcing") return "Sourcing";
  if (p.lapseDate) {
    const lapsedDays = diffDays(now, fromIso(p.lapseDate));
    return lapsedDays <= s.lapseBoundary ? "Early lapse" : "Late lapse";
  }
  const d = diffDays(fromIso(p.dueDate), now);
  const grace = p.paymentMode === "Monthly" ? s.graceMonthly : s.graceOther;
  if (d > s.windowOpens) return "Warming";
  if (d >= -grace) return "Renewal window";
  return "Early lapse";
}

/**
 * Stage under the given settings. Policies whose stage would be the same under the
 * default settings keep their seeded stage, so the default always matches the book.
 */
export function stageUnder(p: Policy, s: StageSettings, now: Date = NOW): Stage {
  if (s === DEFAULT_STAGE_SETTINGS) return p.lifecycleStage;
  const a = rawStage(p, DEFAULT_STAGE_SETTINGS, now);
  const b = rawStage(p, s, now);
  return a === b ? p.lifecycleStage : b;
}

export function stageValidation(s: StageSettings): string[] {
  const out: string[] = [];
  if (s.windowOpens >= s.warmingStart) out.push("The window must open after warming starts (window days below warming days).");
  if (s.windowOpens <= 0) out.push("The window must open before the due date.");
  if (s.graceMonthly <= 0 || s.graceOther <= 0) out.push("Grace must be at least one day.");
  if (s.lapseBoundary <= Math.max(s.graceMonthly, s.graceOther)) out.push("The lapse boundary must be later than the end of grace.");
  for (const st of s.stations) {
    if (st.offset < -s.warmingStart || st.offset > 0) out.push(`Station at T${st.offset} falls outside the warming stage (T-${s.warmingStart} to T).`);
  }
  return out;
}

export const SECOND_APPROVER_LIMIT = 5_000;
export { DAY_MS };
