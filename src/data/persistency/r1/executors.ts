export type ExecMode = "Observe" | "Direct" | "Replace in slice";
export const EXEC_MODES: ExecMode[] = ["Observe", "Direct", "Replace in slice"];

export type ExecType = "Agent" | "In-house team" | "Vendor" | "Bank relationship manager" | "Field staff";

export interface Executor {
  id: string;
  name: string;
  type: ExecType;
  payout: "Fixed" | "Variable";
  receives: "File" | "Screen";
  status: "Active" | "Paused";
  contactLimit: number;
  costs: { call: number; message: number; task: number };
  /** Mode per workflow code. */
  modes: Record<string, ExecMode>;
  /** Share of eligible volume per workflow code, in percent. */
  shares: Record<string, number>;
  /** Replace in slice is allowed only for these two agents. */
  replaceAllowed: boolean;
}

export const EXECUTORS: Executor[] = [
  { id: "renewal-voice", name: "Premium Renewal Voice Agent", type: "Agent", payout: "Variable", receives: "Screen", status: "Active", contactLimit: 4, costs: { call: 7.5, message: 0, task: 7.5 }, modes: { R1: "Observe", R2: "Replace in slice" }, shares: { R1: 0, R2: 15 }, replaceAllowed: true },
  { id: "message", name: "WhatsApp message agent", type: "Agent", payout: "Variable", receives: "Screen", status: "Active", contactLimit: 8, costs: { call: 0, message: 1.2, task: 1.2 }, modes: { R1: "Replace in slice", R3: "Direct", W1: "Direct", R4: "Direct", L1: "Direct" }, shares: { R1: 40, R3: 60, W1: 70, R4: 20, L1: 40 }, replaceAllowed: true },
  { id: "payment-assist", name: "Payment Link Dispatcher", type: "Agent", payout: "Variable", receives: "Screen", status: "Active", contactLimit: 4, costs: { call: 0, message: 2.1, task: 2.1 }, modes: { R4: "Direct" }, shares: { R4: 40 }, replaceAllowed: false },
  { id: "cc-fixed", name: "Call-centre vendor (fixed payout)", type: "Vendor", payout: "Fixed", receives: "File", status: "Active", contactLimit: 6, costs: { call: 38, message: 0, task: 38 }, modes: { R1: "Observe", R2: "Direct" }, shares: { R1: 10, R2: 50 }, replaceAllowed: false },
  { id: "cc-variable", name: "Call-centre vendor (variable payout)", type: "Vendor", payout: "Variable", receives: "File", status: "Active", contactLimit: 6, costs: { call: 45, message: 0, task: 45 }, modes: { R2: "Direct", L1: "Direct" }, shares: { R2: 10, L1: 60 }, replaceAllowed: false },
  { id: "wa-vendor", name: "WhatsApp vendor", type: "Vendor", payout: "Variable", receives: "File", status: "Active", contactLimit: 8, costs: { call: 0, message: 1, task: 1 }, modes: { R1: "Direct", R3: "Direct", W1: "Direct" }, shares: { R1: 20, R3: 40, W1: 30 }, replaceAllowed: false },
  { id: "voice-bot", name: "Voice bot vendor", type: "Vendor", payout: "Variable", receives: "File", status: "Active", contactLimit: 4, costs: { call: 6, message: 0, task: 6 }, modes: { R2: "Observe", R4: "Direct" }, shares: { R2: 25, R4: 40 }, replaceAllowed: false },
  { id: "bank-rm", name: "Bank relationship manager", type: "Bank relationship manager", payout: "Fixed", receives: "File", status: "Active", contactLimit: 3, costs: { call: 0, message: 0, task: 25 }, modes: { R6: "Direct" }, shares: { R6: 100 }, replaceAllowed: false },
  { id: "sales-officer", name: "Sales officer", type: "Field staff", payout: "Fixed", receives: "Screen", status: "Active", contactLimit: 2, costs: { call: 0, message: 0, task: 180 }, modes: { R5: "Direct", R1: "Observe" }, shares: { R5: 100, R1: 0 }, replaceAllowed: false },
  { id: "hv-desk", name: "High-value desk", type: "In-house team", payout: "Fixed", receives: "Screen", status: "Active", contactLimit: 3, costs: { call: 120, message: 0, task: 120 }, modes: { R7: "Direct" }, shares: { R7: 100 }, replaceAllowed: false },
  { id: "retention", name: "Retention desk", type: "In-house team", payout: "Fixed", receives: "Screen", status: "Active", contactLimit: 3, costs: { call: 90, message: 0, task: 90 }, modes: { L3: "Direct" }, shares: { L3: 100 }, replaceAllowed: false },
];

export const REPLACE_ONLY_NOTE = "Available for voice and WhatsApp only";

/** Shares across executors for one workflow cannot exceed 100. */
export function shareTotal(executors: Executor[], workflow: string): number {
  return executors.reduce((s, e) => s + (e.shares[workflow] ?? 0), 0);
}

/** A share change above 20 points needs approval. */
export function shareNeedsApproval(before: number, after: number): boolean {
  return Math.abs(after - before) > 20;
}

export function canReplaceInSlice(e: Pick<Executor, "replaceAllowed">): boolean {
  return e.replaceAllowed;
}
