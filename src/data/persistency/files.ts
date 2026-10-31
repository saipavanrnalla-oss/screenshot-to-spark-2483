import type { Policy } from "./types";

export interface FileAdapter {
  id: string;
  name: string;
  direction: "Inbound" | "Outbound";
  schedule: string;
  expectedBy: string;
  lastReceived: string;
  rows: number;
  rejects: number;
  optional?: boolean | undefined;
  enabled: boolean;
  /** Workflows that pause when this file is stale. */
  feeds: string[];
  stale: boolean;
}

/** Row counts come from the seeded policies so every page agrees. */
export function buildAdapters(policies: Policy[]): FileAdapter[] {
  const dueSoon = policies.filter((p) => p.lifecycleStage === "Renewal window" || p.monthDue).length;
  const receipts = policies.filter((p) => p.monthDue?.status === "paid").length;
  const bounces = policies.filter((p) => p.reasonCode === "Mandate bounce" || p.reasonCode === "Mandate failed").length;
  const mandates = policies.filter((p) => p.paymentMethod === "NACH/ECS mandate" || p.paymentMethod === "UPI autopay").length;
  const advisors = new Set(policies.filter((p) => p.channel === "Agency").map((p) => p.sourceBankOrAdvisor)).size;
  const dispositions = policies.filter((p) => p.touchesLast30d > 0 && p.lastTouch).length;
  const scored = policies.filter((p) => p.insurerCohort !== "Unscored").length;
  return [
    { id: "due_list", name: "due_list", direction: "Inbound", schedule: "Daily 06:00", expectedBy: "28 Oct 2026 06:30", lastReceived: "28 Oct 2026 06:02", rows: dueSoon, rejects: 4, enabled: true, feeds: ["R1", "R2", "R3"], stale: false },
    { id: "receipts", name: "receipts", direction: "Inbound", schedule: "Daily 07:00", expectedBy: "28 Oct 2026 07:30", lastReceived: "28 Oct 2026 07:05", rows: receipts, rejects: 2, enabled: true, feeds: ["X2"], stale: false },
    { id: "bounce_returns", name: "bounce_returns", direction: "Inbound", schedule: "Daily 07:00", expectedBy: "28 Oct 2026 07:30", lastReceived: "26 Oct 2026 22:10", rows: bounces, rejects: 0, enabled: true, feeds: ["R4"], stale: true },
    { id: "mandate_status", name: "mandate_status", direction: "Inbound", schedule: "Daily 05:30", expectedBy: "28 Oct 2026 06:00", lastReceived: "28 Oct 2026 05:41", rows: mandates, rejects: 11, enabled: true, feeds: ["W3", "R4"], stale: false },
    { id: "advisor_master", name: "advisor_master", direction: "Inbound", schedule: "Weekly Mon 04:00", expectedBy: "26 Oct 2026 05:00", lastReceived: "26 Oct 2026 04:12", rows: advisors, rejects: 0, enabled: true, feeds: ["R1"], stale: false },
    { id: "vendor_dispositions", name: "vendor_dispositions", direction: "Inbound", schedule: "Daily 08:00", expectedBy: "28 Oct 2026 08:30", lastReceived: "28 Oct 2026 08:06", rows: dispositions, rejects: 37, enabled: true, feeds: ["R2", "L1"], stale: false },
    { id: "risk_cohorts", name: "risk_cohorts_2026-10.csv", direction: "Inbound", schedule: "Monthly", expectedBy: "05 Oct 2026", lastReceived: "03 Oct 2026 11:20", rows: scored, rejects: 0, optional: true, enabled: true, feeds: [], stale: false },
    { id: "bureau_fields", name: "bureau_fields", direction: "Inbound", schedule: "Not set", expectedBy: "Not set", lastReceived: "Never", rows: 0, rejects: 0, optional: true, enabled: false, feeds: [], stale: false },
  ];
}
