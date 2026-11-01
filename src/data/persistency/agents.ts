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
  { id: "message", name: "Message agent", type: "Messaging", status: "Active", version: 6, does: "Sends WhatsApp and SMS reminders, payment links and station messages in the customer's language.", workflows: ["W1", "W2", "R1", "R2", "R4", "L1"] },
  { id: "renewal-voice", name: "Renewal voice agent", type: "Voice", status: "Active", version: 4, does: "Calls customers about the premium due, answers questions from the script and records what the customer says.", workflows: ["R1", "R2", "R3", "L1"] },
  { id: "reason-classifier", name: "Reason classifier", type: "Classifier", status: "Active", version: 3, does: "Reads call and message outcomes and tags the reason for non-payment.", workflows: ["R2", "R3", "L1", "L2"] },
  { id: "payment-assist", name: "Payment assist agent", type: "Payments", status: "Active", version: 2, does: "Sends the payment link or autopay set-up and follows the payment until it lands.", workflows: ["R2", "R4", "R5"] },
  { id: "handoff-summariser", name: "Handoff summariser", type: "Summary", status: "Active", version: 2, does: "Writes the six-field packet when a case moves to a person or another agent.", workflows: ["R2", "R6", "X1", "X2"] },
  { id: "quality", name: "Quality agent", type: "Quality", status: "Active", version: 3, does: "Checks calls and messages against the contact policy and the script.", workflows: ["R1", "R2", "R3", "L1"] },
  { id: "welcome", name: "Welcome and verification", type: "Voice", status: "Not enabled", version: 1, does: "Welcome call and verification after issuance.", workflows: ["S1", "S2"] },
  { id: "revival", name: "Revival", type: "Voice", status: "Not enabled", version: 1, does: "Revival conversations for lapsed policies.", workflows: ["L2", "L3"] },
  { id: "retention", name: "Retention", type: "Voice", status: "Not enabled", version: 1, does: "Conversations with customers who ask to surrender.", workflows: ["X1"] },
  { id: "relationship-brief", name: "Relationship brief", type: "Summary", status: "Not enabled", version: 1, does: "Briefs for bank relationship managers and the high-value desk.", workflows: ["R6"] },
  { id: "learning", name: "Learning", type: "Learning", status: "Not enabled", version: 1, does: "Proposes rule changes from treated and untreated outcomes.", workflows: [] },
];
