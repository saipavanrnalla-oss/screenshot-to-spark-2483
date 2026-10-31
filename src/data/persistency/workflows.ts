import type { Product, StageColumn } from "./types";

export type Tier = "live-engine" | "live-channels" | "simulated";

export interface WorkflowDef {
  id: string;
  name: string;
  stage: StageColumn | "Cross-cutting";
  products: Product[];
  trigger: string;
  executor: string;
  tier: Tier;
  hasCanvas: boolean;
}

const ALL: Product[] = ["ULIP", "Traditional", "Term"];

export const WORKFLOWS: WorkflowDef[] = [
  { id: "S1", name: "High-risk flag", stage: "Sourcing", products: ALL, trigger: "New policy scored in top cohort", executor: "Desible", tier: "live-engine", hasCanvas: false },
  { id: "S2", name: "PIVC and welcome call", stage: "Sourcing", products: ALL, trigger: "Policy issued", executor: "Desible voice", tier: "live-channels", hasCanvas: false },
  { id: "S3", name: "Free-look and NTU watch", stage: "Sourcing", products: ALL, trigger: "Free-look period open", executor: "Desible", tier: "live-engine", hasCanvas: false },
  { id: "W1", name: "Nine-station warming", stage: "Warming", products: ALL, trigger: "Station date reached", executor: "Paylocal WhatsApp", tier: "live-channels", hasCanvas: true },
  { id: "W2", name: "First-year protect", stage: "Warming", products: ["ULIP"], trigger: "ULIP in policy year 1", executor: "Desible voice", tier: "live-channels", hasCanvas: false },
  { id: "W3", name: "Mandate readiness check", stage: "Warming", products: ["ULIP", "Traditional"], trigger: "No active mandate before window", executor: "Desible", tier: "simulated", hasCanvas: false },
  { id: "R1", name: "Pre-due reminders", stage: "Renewal window", products: ALL, trigger: "T-90 to T", executor: "Paylocal WhatsApp", tier: "live-channels", hasCanvas: false },
  { id: "R2", name: "Due-date collection", stage: "Renewal window", products: ALL, trigger: "Due date passed, unpaid", executor: "Pace Setters", tier: "live-engine", hasCanvas: true },
  { id: "R3", name: "Promise-to-pay follow-up", stage: "Renewal window", products: ALL, trigger: "Customer promised a date", executor: "Paylocal WhatsApp", tier: "live-engine", hasCanvas: false },
  { id: "R4", name: "Failed autopay and bounce recovery", stage: "Renewal window", products: ALL, trigger: "Bounce or mandate failure in file", executor: "Ubona voice bot", tier: "simulated", hasCanvas: true },
  { id: "R5", name: "Field visit for cheque/cash", stage: "Renewal window", products: ["Traditional", "ULIP"], trigger: "Cash or cheque payer unpaid at due", executor: "Sales officer", tier: "live-engine", hasCanvas: false },
  { id: "R6", name: "Bancassurance RM nudge", stage: "Renewal window", products: ALL, trigger: "Bank-sourced policy in window", executor: "Bank RM", tier: "live-engine", hasCanvas: false },
  { id: "R7", name: "HNI personal outreach", stage: "Renewal window", products: ["ULIP", "Traditional"], trigger: "Premium ₹5,00,000 or more", executor: "HNI desk", tier: "live-engine", hasCanvas: false },
  { id: "L1", name: "Early-lapse recovery", stage: "Lapse and revival", products: ALL, trigger: "Lapsed 180 days or less", executor: "ATS", tier: "live-engine", hasCanvas: false },
  { id: "L2", name: "Late-lapse revival with health declaration", stage: "Lapse and revival", products: ALL, trigger: "Lapsed over 180 days", executor: "Pace Setters + Underwriting", tier: "live-engine", hasCanvas: true },
  { id: "L3", name: "Surrender retention", stage: "Lapse and revival", products: ALL, trigger: "Customer says wants out", executor: "Retention desk", tier: "live-engine", hasCanvas: true },
  { id: "X1", name: "Complaint, bereavement and stop-calling freeze", stage: "Cross-cutting", products: ALL, trigger: "Complaint, bereavement or DND", executor: "None (freeze)", tier: "live-engine", hasCanvas: true },
  { id: "X2", name: "Paid-meanwhile reconciliation", stage: "Cross-cutting", products: ALL, trigger: "Receipt arrives before action", executor: "Desible", tier: "live-engine", hasCanvas: false },
];

export function workflowById(id: string): WorkflowDef | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}
