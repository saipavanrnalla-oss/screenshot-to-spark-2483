import type { Tier } from "@/data/persistency/workflows";

/** Every panel a persona home can show. Persona configs list these ids; adding a persona is data. */
export const PANEL_META = {
  "persistency-13-61": { title: "Premium-weighted persistency 13M to 61M", tiers: ["live-engine"] },
  "collection-vs-plan": { title: "Collection vs plan", tiers: ["live-engine", "simulated"] },
  "month-end-gap": { title: "Month-end gap", tiers: ["live-engine"] },
  "risk-flags": { title: "Risk flags", tiers: ["live-engine"] },
  "vendor-spend": { title: "Vendor spend vs collected", tiers: ["simulated"] },
  "lifecycle-map": { title: "Lifecycle map", tiers: ["live-engine"] },
  "run-rate": { title: "Run-rate", tiers: ["live-engine", "simulated"] },
  "cohort-performance": { title: "Cohort performance", tiers: ["live-engine"] },
  approvals: { title: "Approvals waiting", tiers: ["live-engine"] },
  "guardrail-breaches": { title: "Guardrail breaches", tiers: ["live-engine"] },
  "team-collection": { title: "Collection by team", tiers: ["live-engine"] },
  reallocations: { title: "Recommended reallocations", tiers: ["live-engine"] },
  "agent-queues": { title: "Agents' queues", tiers: ["live-engine"] },
  "promised-vs-paid": { title: "Promised vs paid", tiers: ["live-engine", "simulated"] },
  "calls-pending": { title: "Calls pending", tiers: ["live-engine"] },
  "vendor-split": { title: "Vendor split", tiers: ["live-engine"] },
  handoff: { title: "Handoff screen", tiers: ["live-engine", "live-channels"] },
  "visit-list": { title: "Visit list in route order", tiers: ["live-engine"] },
  "paid-meanwhile-flags": { title: "Paid meanwhile flags", tiers: ["simulated"] },
  "branch-comparison": { title: "Branch comparison", tiers: ["live-engine"] },
  backlog: { title: "Backlog", tiers: ["live-engine"] },
  "visit-completion": { title: "Visit completion", tiers: ["live-engine"] },
  "bank-branches": { title: "Policies by bank branch", tiers: ["live-engine"] },
  "rm-list": { title: "RM list", tiers: ["live-engine"] },
  "rm-nudges": { title: "Nudges sent to RMs", tiers: ["live-channels", "simulated"] },
  "hni-list": { title: "High-ticket policies", tiers: ["live-engine"] },
  "relationship-notes": { title: "Relationship notes", tiers: ["live-engine"] },
  "outreach-drafts": { title: "Personalised outreach drafts", tiers: ["live-engine"] },
  "wants-out-queue": { title: "Customers asking to surrender", tiers: ["live-engine"] },
  "retention-offers": { title: "Retention offers by product", tiers: ["live-engine"] },
  "revival-medicals": { title: "Late-lapse revivals needing declaration or medicals", tiers: ["live-engine", "simulated"] },
  "mandate-status": { title: "Mandate status", tiers: ["simulated"] },
  "bounce-returns": { title: "Bounce returns and re-presentation", tiers: ["simulated"] },
  "file-freshness": { title: "File freshness, rows and rejects", tiers: ["simulated"] },
  "cohort-uploads": { title: "Cohort uploads", tiers: ["simulated"] },
  drift: { title: "Cohort drift", tiers: ["simulated"] },
  holdout: { title: "Holdout", tiers: ["live-engine"] },
  "contact-breaches": { title: "Contact-rule breaches", tiers: ["live-engine"] },
  consent: { title: "Consent and DND", tiers: ["live-engine"] },
  "qa-samples": { title: "Call QA samples", tiers: ["simulated"] },
  "kill-switch": { title: "Kill switch", tiers: ["live-engine"] },
  "audit-log": { title: "Audit log", tiers: ["live-engine"] },
} as const satisfies Record<string, { title: string; tiers: Tier[] }>;

export type PanelId = keyof typeof PANEL_META;

export type ChangeKey = "paidToday" | "lapsedYesterday" | "newPromises" | "newWantsOut" | "newHolds" | "branchPaid" | "enteredGrace" | "revivedToday" | "bounces";

export const CHANGE_LABEL: Record<ChangeKey, string> = {
  paidToday: "Payments received since yesterday",
  lapsedYesterday: "Policies lapsed since yesterday",
  newPromises: "New promises to pay",
  newWantsOut: "New wants-out requests",
  newHolds: "New holds (complaint, bereavement, DND)",
  branchPaid: "Branch payments (receipt arrives a day late)",
  enteredGrace: "Entered grace",
  revivedToday: "Revived since yesterday",
  bounces: "New mandate bounces",
};

export type ActionKind =
  | "open-war-room"
  | "approve-rule"
  | "reassign-cohort"
  | "reassign-calls"
  | "log-outcome"
  | "mark-visited"
  | "escalate"
  | "send-rm-nudge"
  | "approve-outreach"
  | "offer-alternative"
  | "clear-refer"
  | "retry-batch"
  | "upload-cohort"
  | "pause-workflow";
