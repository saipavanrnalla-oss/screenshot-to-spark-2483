import type { ActionKind, ChangeKey, PanelId } from "./panels";
import { PANEL_META } from "./panels";

export type NavKey =
  | "control-tower"
  | "lifecycle"
  | "cohorts"
  | "workflows"
  | "configuration"
  | "queues"
  | "war-room"
  | "where-we-sit"
  | "data"
  | "guardrails"
  | "measurement"
  | "setup";

export interface PersonaConfig {
  id: string;
  label: string;
  /** Role in the seeded people list; the first person of this role is "you". */
  role: string;
  landsOn: string;
  panels: PanelId[];
  primaryAction: { label: string; kind: ActionKind };
  changes: ChangeKey[];
  nav: NavKey[];
}

const ALL_NAV: NavKey[] = [
  "control-tower",
  "lifecycle",
  "cohorts",
  "workflows",
  "configuration",
  "queues",
  "war-room",
  "where-we-sit",
  "data",
  "guardrails",
  "measurement",
  "setup",
];

/** Adding a persona is data, not code. */
export const PERSONAS: PersonaConfig[] = [
  { id: "cxo", label: "CXO", role: "CXO", landsOn: "Executive view", panels: ["persistency-13-61", "collection-vs-plan", "month-end-gap", "risk-flags", "vendor-spend"], primaryAction: { label: "Open war room", kind: "open-war-room" }, changes: ["paidToday", "lapsedYesterday", "revivedToday", "newHolds"], nav: ["queues", "control-tower", "war-room", "measurement", "where-we-sit"] },
  { id: "head", label: "Head of Persistency", role: "Head of Persistency", landsOn: "Control Tower", panels: ["lifecycle-map", "run-rate", "cohort-performance", "approvals", "guardrail-breaches"], primaryAction: { label: "Approve or change a rule", kind: "approve-rule" }, changes: ["paidToday", "enteredGrace", "lapsedYesterday", "newWantsOut"], nav: ALL_NAV },
  { id: "regional", label: "Regional / GM lead", role: "Regional lead", landsOn: "Month-end war room", panels: ["team-collection", "month-end-gap", "reallocations", "approvals"], primaryAction: { label: "Reassign a cohort", kind: "reassign-cohort" }, changes: ["paidToday", "enteredGrace", "newPromises"], nav: ["queues", "war-room", "control-tower", "lifecycle", "workflows", "measurement"] },
  { id: "team-lead", label: "Team lead (telecalling)", role: "Team lead", landsOn: "Team board", panels: ["agent-queues", "promised-vs-paid", "calls-pending", "vendor-split"], primaryAction: { label: "Reassign calls", kind: "reassign-calls" }, changes: ["newPromises", "enteredGrace", "paidToday"], nav: ["queues", "lifecycle", "workflows", "war-room"] },
  { id: "agent", label: "Telecaller / agent", role: "Agent", landsOn: "Handoff screen", panels: ["handoff"], primaryAction: { label: "Log outcome", kind: "log-outcome" }, changes: ["newPromises", "paidToday"], nav: ["queues"] },
  { id: "sales-officer", label: "Sales officer / branch head", role: "Sales officer", landsOn: "Visit list", panels: ["visit-list", "paid-meanwhile-flags"], primaryAction: { label: "Mark next visited", kind: "mark-visited" }, changes: ["branchPaid", "enteredGrace", "paidToday"], nav: ["queues", "lifecycle"] },
  { id: "zonal", label: "Zonal manager", role: "Zonal manager", landsOn: "Zone view", panels: ["branch-comparison", "backlog", "visit-completion"], primaryAction: { label: "Escalate the largest backlog", kind: "escalate" }, changes: ["enteredGrace", "lapsedYesterday", "paidToday"], nav: ["queues", "lifecycle", "war-room", "measurement"] },
  { id: "bank-partner", label: "Bank partner manager", role: "Bank partner manager", landsOn: "Bank view", panels: ["bank-branches", "rm-list", "rm-nudges"], primaryAction: { label: "Send RM nudge", kind: "send-rm-nudge" }, changes: ["paidToday", "enteredGrace", "branchPaid"], nav: ["queues", "lifecycle", "measurement"] },
  { id: "hni", label: "High-value desk", role: "High-value desk", landsOn: "HNI list", panels: ["hni-list", "relationship-notes", "outreach-drafts"], primaryAction: { label: "Approve next outreach", kind: "approve-outreach" }, changes: ["paidToday", "newPromises"], nav: ["queues", "lifecycle"] },
  { id: "retention", label: "Surrender retention", role: "Surrender retention", landsOn: "Wants-out queue", panels: ["wants-out-queue", "retention-offers"], primaryAction: { label: "Offer alternative to next", kind: "offer-alternative" }, changes: ["newWantsOut", "newHolds"], nav: ["queues", "lifecycle", "workflows"] },
  { id: "underwriting", label: "Underwriting", role: "Underwriter", landsOn: "Revival medicals", panels: ["revival-medicals"], primaryAction: { label: "Clear next declaration", kind: "clear-refer" }, changes: ["revivedToday", "lapsedYesterday"], nav: ["queues", "lifecycle", "workflows"] },
  { id: "ops", label: "Remittance / ops", role: "Ops / remittance", landsOn: "Mandates and bounces", panels: ["mandate-status", "bounce-returns"], primaryAction: { label: "Retry batch", kind: "retry-batch" }, changes: ["bounces", "paidToday"], nav: ["queues", "data", "workflows", "lifecycle"] },
  { id: "mis", label: "MIS / analytics", role: "MIS / analytics", landsOn: "Files and cohorts", panels: ["file-freshness", "cohort-uploads", "drift", "holdout"], primaryAction: { label: "Upload cohort file", kind: "upload-cohort" }, changes: ["paidToday", "branchPaid"], nav: ["queues", "data", "cohorts", "measurement", "configuration", "lifecycle", "setup"] },
  { id: "compliance", label: "Compliance / quality", role: "Compliance / quality", landsOn: "Guardrails and audit", panels: ["contact-breaches", "consent", "qa-samples", "kill-switch", "audit-log"], primaryAction: { label: "Pause a workflow", kind: "pause-workflow" }, changes: ["newHolds", "newWantsOut"], nav: ["queues", "guardrails", "configuration", "workflows", "lifecycle"] },
];

export const DEFAULT_PERSONA = "head";

export function personaById(id: string | undefined): PersonaConfig {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS.find((p) => p.id === DEFAULT_PERSONA)!;
}

export function panelTitles(p: PersonaConfig): string[] {
  return p.panels.map((id) => PANEL_META[id].title);
}
