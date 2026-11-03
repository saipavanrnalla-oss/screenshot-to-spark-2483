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
  { id: "S1", name: "High-Risk New Business Flag", stage: "Sourcing", products: ALL, trigger: "New policy scored in top cohort", executor: "Desible", tier: "live-engine", hasCanvas: true },
  { id: "S2", name: "PIVC and Welcome Call", stage: "Sourcing", products: ALL, trigger: "Policy issued", executor: "Desible voice", tier: "live-channels", hasCanvas: true },
  { id: "S3", name: "Free-Look and NTU Watch", stage: "Sourcing", products: ALL, trigger: "Free-look period open", executor: "Desible", tier: "live-engine", hasCanvas: true },
  { id: "W1", name: "Nine-Station Pre-Renewal Warming", stage: "Warming", products: ALL, trigger: "Station date reached", executor: "WhatsApp vendor", tier: "live-channels", hasCanvas: true },
  { id: "W2", name: "First-Year ULIP Protect", stage: "Warming", products: ["ULIP"], trigger: "ULIP in policy year 1", executor: "Desible voice", tier: "live-channels", hasCanvas: true },
  { id: "W3", name: "e-NACH Mandate Readiness", stage: "Warming", products: ["ULIP", "Traditional"], trigger: "No active mandate before window", executor: "Desible", tier: "simulated", hasCanvas: true },
  { id: "R1", name: "13th Month Persistency", stage: "Renewal window", products: ALL, trigger: "90 days before the 13th-month due date", executor: "WhatsApp vendor", tier: "live-channels", hasCanvas: true },
  { id: "R2", name: "Grace-Period Recovery", stage: "Renewal window", products: ALL, trigger: "Due date passed, unpaid", executor: "Call-centre vendor (fixed payout)", tier: "live-engine", hasCanvas: true },
  { id: "R3", name: "Promise-to-Pay Follow-up", stage: "Renewal window", products: ALL, trigger: "Customer promised a date", executor: "WhatsApp vendor", tier: "live-engine", hasCanvas: true },
  { id: "R4", name: "Failed Autopay and ECS Bounce Recovery", stage: "Renewal window", products: ALL, trigger: "Bounce or mandate failure in file", executor: "Voice bot vendor", tier: "simulated", hasCanvas: true },
  { id: "R5", name: "Cheque and Cash Payer Field Visit", stage: "Renewal window", products: ["Traditional", "ULIP"], trigger: "Cash or cheque payer unpaid at due", executor: "Sales officer", tier: "live-engine", hasCanvas: true },
  { id: "R6", name: "Bancassurance RM Nudge", stage: "Renewal window", products: ALL, trigger: "Bank-sourced policy in window", executor: "Bank relationship manager", tier: "live-engine", hasCanvas: true },
  { id: "R7", name: "HNI Personal Outreach", stage: "Renewal window", products: ["ULIP", "Traditional"], trigger: "Premium ₹5,00,000 or more", executor: "High-value desk", tier: "live-engine", hasCanvas: true },
  { id: "L1", name: "Lapse Revival Campaign", stage: "Lapse and revival", products: ALL, trigger: "Lapsed 180 days or less", executor: "Call-centre vendor (variable payout)", tier: "live-engine", hasCanvas: true },
  { id: "L2", name: "Deep Lapse Revival with Health Declaration", stage: "Lapse and revival", products: ALL, trigger: "Lapsed over 180 days", executor: "Call-centre vendor (fixed payout) + Underwriting", tier: "live-engine", hasCanvas: true },
  { id: "L3", name: "ULIP Surrender Prevention", stage: "Lapse and revival", products: ALL, trigger: "Customer says wants out", executor: "Retention desk", tier: "live-engine", hasCanvas: true },
  { id: "X1", name: "Complaint, Bereavement and Do-Not-Call Freeze", stage: "Cross-cutting", products: ALL, trigger: "Complaint, bereavement or DND", executor: "None (freeze)", tier: "live-engine", hasCanvas: true },
  { id: "X2", name: "Paid-Meanwhile Reconciliation", stage: "Cross-cutting", products: ALL, trigger: "Receipt arrives before action", executor: "Desible", tier: "live-engine", hasCanvas: true },
];

export function workflowById(id: string): WorkflowDef | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}
