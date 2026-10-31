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
  landsOn: string;
  panels: string[];
  primaryAction: string;
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
  { id: "cxo", label: "CXO", landsOn: "Executive view", panels: ["Premium-weighted persistency 13-61M", "Collection vs plan", "Month-end gap", "Risk flags", "Vendor spend vs collected"], primaryAction: "Open war room", nav: ["queues", "control-tower", "war-room", "measurement", "where-we-sit"] },
  { id: "head", label: "Head of Persistency", landsOn: "Control Tower", panels: ["Lifecycle map", "Run-rate", "Cohort performance", "Approvals waiting", "Guardrail breaches"], primaryAction: "Approve or change a rule", nav: ALL_NAV },
  { id: "regional", label: "Regional / GM lead", landsOn: "Month-end war room", panels: ["Collection by team", "Gap to plan", "Recommended reallocations", "Pending approvals"], primaryAction: "Reassign a cohort", nav: ["queues", "war-room", "control-tower", "lifecycle", "workflows", "measurement"] },
  { id: "team-lead", label: "Team lead (telecalling)", landsOn: "Team board", panels: ["Agents' queues", "Promised vs paid", "Calls pending", "Vendor split"], primaryAction: "Reassign calls", nav: ["queues", "lifecycle", "workflows", "war-room"] },
  { id: "agent", label: "Telecaller / agent", landsOn: "Handoff screen", panels: ["Customer card", "Why this call, why now", "Script", "Last touches", "Outcome buttons"], primaryAction: "Log outcome", nav: ["queues"] },
  { id: "sales-officer", label: "Sales officer / branch head", landsOn: "Visit list", panels: ["Cheque and cash payers due", "Route order", "Paid meanwhile flags"], primaryAction: "Mark visited", nav: ["queues", "lifecycle"] },
  { id: "zonal", label: "Zonal manager", landsOn: "Zone view", panels: ["Branch comparison", "Backlog", "Visit completion"], primaryAction: "Escalate", nav: ["queues", "lifecycle", "war-room", "measurement"] },
  { id: "bank-partner", label: "Bank partner manager", landsOn: "Bank view", panels: ["Policies by bank branch", "RM list", "Branch-level persistency", "Nudges sent to RMs"], primaryAction: "Send RM nudge", nav: ["queues", "lifecycle", "measurement"] },
  { id: "hni", label: "HNI desk", landsOn: "HNI list", panels: ["High-ticket policies", "Relationship notes", "Outreach drafts"], primaryAction: "Approve outreach", nav: ["queues", "lifecycle"] },
  { id: "retention", label: "Surrender retention", landsOn: "Wants-out queue", panels: ["Customers asking to surrender", "Reason", "Retention offers", "Next step"], primaryAction: "Offer alternative", nav: ["queues", "lifecycle", "workflows"] },
  { id: "underwriting", label: "Underwriting", landsOn: "Revival medicals", panels: ["Late-lapse revivals needing declaration or medicals", "Status"], primaryAction: "Clear or refer", nav: ["queues", "lifecycle", "workflows"] },
  { id: "ops", label: "Remittance / ops", landsOn: "Mandates and bounces", panels: ["Mandate status", "Bounce returns", "Re-presentation", "Failed autopay retries"], primaryAction: "Retry batch", nav: ["queues", "data", "workflows", "lifecycle"] },
  { id: "mis", label: "MIS / analytics", landsOn: "Files and cohorts", panels: ["File freshness", "Row counts and rejects", "Cohort uploads", "Drift", "Holdout"], primaryAction: "Upload cohort file", nav: ["queues", "data", "cohorts", "measurement", "configuration", "lifecycle", "setup"] },
  { id: "compliance", label: "Compliance / quality", landsOn: "Guardrails and audit", panels: ["Contact-rule breaches", "Consent", "Call QA samples", "Kill switch", "Audit log"], primaryAction: "Pause a workflow", nav: ["queues", "guardrails", "configuration", "workflows", "lifecycle"] },
];

export const DEFAULT_PERSONA = "head";

export function personaById(id: string | undefined): PersonaConfig {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS.find((p) => p.id === DEFAULT_PERSONA)!;
}
