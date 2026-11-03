/** Agents that run workflow steps. Six are active in release 1; five are listed as not enabled. */
export type AgentStatus = "Active" | "Paused" | "Not enabled";

export interface AgentDef {
  id: string;
  name: string;
  type: "Messaging" | "Voice" | "Classifier" | "Payments" | "Summary" | "Quality" | "Learning";
  status: AgentStatus;
  version: number;
  does: string;
  /** Workflow codes from workflows.ts that use this agent. */
  workflows: string[];
}

export const AGENTS: AgentDef[] = [
  { id: "message", name: "Renewal Reminder Agent", type: "Messaging", status: "Active", version: 6, does: "Sends WhatsApp and SMS reminders, payment links and station messages in the customer's language.", workflows: ["W1", "W2", "R1", "R2", "R4", "L1"] },
  { id: "renewal-voice", name: "Premium Renewal Voice Agent", type: "Voice", status: "Active", version: 4, does: "Calls customers about the premium due, answers questions from the script and records what the customer says.", workflows: ["R1", "R2", "R3", "L1"] },
  { id: "reason-classifier", name: "Lapse Reason Classifier", type: "Classifier", status: "Active", version: 3, does: "Reads call and message outcomes and tags the reason for non-payment.", workflows: ["R2", "R3", "L1", "L2"] },
  { id: "payment-assist", name: "Payment Link Dispatcher", type: "Payments", status: "Active", version: 2, does: "Sends the payment link or autopay set-up and follows the payment until it lands.", workflows: ["R2", "R4", "R5"] },
  { id: "handoff-summariser", name: "Advisor Callback Brief Agent", type: "Summary", status: "Active", version: 2, does: "Writes the six-field packet when a case moves to a person or another agent.", workflows: ["R2", "R7", "L2", "L3"] },
  { id: "quality", name: "Compliance Guard", type: "Quality", status: "Active", version: 3, does: "Checks calls and messages against the contact policy and the script.", workflows: ["R1", "R2", "R3", "L1"] },
  { id: "welcome", name: "Welcome and PIVC Agent", type: "Voice", status: "Not enabled", version: 1, does: "Welcome call and verification after issuance.", workflows: ["S1", "S2"] },
  { id: "revival", name: "Lapse Revival Agent", type: "Voice", status: "Not enabled", version: 1, does: "Revival conversations for lapsed policies.", workflows: ["L1", "L2"] },
  { id: "retention", name: "Surrender Retention Agent", type: "Voice", status: "Not enabled", version: 1, does: "Conversations with customers who ask to surrender.", workflows: ["L3"] },
  { id: "relationship-brief", name: "Bancassurance RM Brief Agent", type: "Summary", status: "Not enabled", version: 1, does: "Briefs for bank relationship managers and the high-value desk.", workflows: ["R6", "R7"] },
  { id: "mandate-recovery", name: "e-NACH Mandate Recovery Agent", type: "Payments", status: "Not enabled", version: 1, does: "Re-registers a failed or expired e-NACH mandate and confirms the next debit date with the customer.", workflows: ["W3", "R4"] },
  { id: "fatigue-guard", name: "Contact Fatigue Guard", type: "Quality", status: "Not enabled", version: 1, does: "Stops a customer being contacted again when the weekly contact limit or a recent complaint says to wait.", workflows: ["X1"] },
  { id: "financial-stress", name: "Financial Stress Agent", type: "Voice", status: "Not enabled", version: 1, does: "Speaks to customers who say they cannot pay and offers a mode change or a premium holiday for approval.", workflows: ["R2", "R3"] },
  { id: "reinstatement", name: "Reinstatement Checker", type: "Classifier", status: "Not enabled", version: 1, does: "Checks whether a lapsed policy can be reinstated, and whether a health declaration is needed.", workflows: ["L1", "L2"] },
  { id: "learning", name: "Rule Learning Agent", type: "Learning", status: "Not enabled", version: 1, does: "Proposes rule changes from treated and untreated outcomes.", workflows: [] },
];
