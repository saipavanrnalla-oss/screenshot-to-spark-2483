import type { Version } from "./types";
import { DISPOSITIONS } from "./common";

/* ---------- Palette ---------- */

export type NodeGroup = "Triggers" | "Checks" | "Decisions" | "Agents" | "Vendors and files" | "People" | "Wait" | "Outcomes";

export interface PaletteItem {
  type: string;
  label: string;
  group: NodeGroup;
  /** Calls or messages the customer: gets the three automatic checks and returns dispositions. */
  outreach?: boolean | undefined;
  /** Can never be added (agents not enabled in release 1). */
  disabled?: boolean | undefined;
  executor?: string | undefined;
  agentId?: string | undefined;
  reads: string[];
  returns: string[];
  does: string;
  cost?: number | undefined;
}

const P = (type: string, label: string, group: NodeGroup, does: string, reads: string[], returns: string[], extra: Partial<PaletteItem> = {}): PaletteItem => ({ type, label, group, does, reads, returns, ...extra });

export const PALETTE: PaletteItem[] = [
  P("trigger.due", "Due list at T minus N", "Triggers", "Starts when a policy reaches N days before its due date in the due list.", ["Due list"], ["Policy"]),
  P("trigger.station", "Station date reached", "Triggers", "Starts on a warming station's date.", ["Stage settings: stations"], ["Policy"]),
  P("trigger.bounce", "Bounce or mandate failure in file", "Triggers", "Starts when the bounce file lists the policy.", ["Bounce file"], ["Policy", "Bounce reason"]),
  P("trigger.receipt", "Receipt arrives", "Triggers", "Starts when a receipt matches the policy.", ["Payment file"], ["Policy", "Receipt"]),
  P("trigger.event", "Event", "Triggers", "Complaint, bereavement, surrender request or do-not-call.", ["Events"], ["Policy", "Event"]),
  P("trigger.timer", "Timer", "Triggers", "Starts on a schedule.", [], ["Policy"]),
  P("trigger.manual", "Manual start", "Triggers", "Started by a person from the policy page.", [], ["Policy"]),
  P("check.paid", "Paid since the list", "Checks", "Stops the path if a receipt arrived after the list was cut.", ["Payment file"], ["Paid", "Not paid"]),
  P("check.hold", "On hold", "Checks", "Stops the path if the policy is on hold.", ["Policy status"], ["On hold", "Clear"]),
  P("check.contact", "Contact policy", "Checks", "Calling hours, contact caps, number series and consent.", ["Contact policy"], ["Allowed", "Blocked"]),
  P("check.household", "Household check", "Checks", "Avoids contacting two policies in one household on the same day.", ["Policy facts"], ["Clear", "Wait"]),
  P("check.approval", "Approval needed", "Checks", "Waits for a named approver.", ["Approvals"], ["Approved", "Returned"]),
  P("decision.rule", "Rule", "Decisions", "Cites a rule from Rules and follows its action.", ["Rules"], ["Matched", "Not matched"]),
  P("decision.disposition", "Branch on disposition", "Decisions", "One edge per disposition.", ["Disposition"], [...DISPOSITIONS]),
  P("decision.cohort", "Branch on cohort", "Decisions", "One edge per cohort.", ["Cohort"], ["Highest propensity", "High propensity", "Moderate propensity", "Low propensity", "Lowest propensity"]),
  P("decision.product", "Branch on product", "Decisions", "One edge per product.", ["Product"], ["ULIP", "Traditional", "Term"]),
  P("decision.field", "Branch on a field", "Decisions", "Branches on a policy field with a condition.", ["Policy facts"], ["Yes", "No"]),
  P("agent.message", "Renewal Reminder Agent", "Agents", "Sends an approved template in the customer's language.", ["Template", "Policy facts"], [...DISPOSITIONS], { outreach: true, executor: "Renewal Reminder Agent", agentId: "message", cost: 1.2 }),
  P("agent.voice", "Premium Renewal Voice Agent", "Agents", "Calls the customer with the approved script and records what they say.", ["Script", "Task packet"], [...DISPOSITIONS], { outreach: true, executor: "Premium Renewal Voice Agent", agentId: "renewal-voice", cost: 7.5 }),
  P("agent.classifier", "Lapse Reason Classifier", "Agents", "Tags the reason for non-payment.", ["Transcript or message"], ["Reason", "Low confidence"], { executor: "Lapse Reason Classifier", agentId: "reason-classifier", cost: 0.4 }),
  P("agent.payment", "Payment Link Dispatcher", "Agents", "Sends the payment link or autopay set-up and follows the payment.", ["Policy facts", "Mandate state"], ["Paid", "Not paid", "Mandate problem"], { outreach: true, executor: "Payment Link Dispatcher", agentId: "payment-assist", cost: 2.1 }),
  P("agent.summariser", "Advisor Callback Brief Agent", "Agents", "Writes the six-field packet when a case moves.", ["Activity", "Transcript"], ["Packet"], { executor: "Advisor Callback Brief Agent", agentId: "handoff-summariser", cost: 0.6 }),
  P("agent.quality", "Compliance Guard", "Agents", "Checks conduct on calls and messages.", ["Transcript", "Contact policy"], ["Pass", "Breach"], { executor: "Compliance Guard", agentId: "quality", cost: 0.5 }),
  P("agent.welcome", "Welcome and PIVC Agent", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("agent.revival", "Lapse Revival Agent", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("agent.retention", "Surrender Retention Agent", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("agent.brief", "Bancassurance RM Brief Agent", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("agent.learning", "Rule Learning Agent", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("vendor.send", "Send work list to vendor", "Vendors and files", "Adds the policy to the vendor's work list.", ["Executors: shares"], ["Sent"], { outreach: true, executor: "Call-centre vendor (fixed payout)", cost: 38 }),
  P("vendor.read", "Read vendor results", "Vendors and files", "Reads the vendor's results file.", ["Call results file"], [...DISPOSITIONS]),
  P("vendor.visit", "Send visit list", "Vendors and files", "Adds the policy to a visit list for field staff.", ["Executors"], ["Sent"], { outreach: true, executor: "Sales officer", cost: 180 }),
  P("file.payment", "Read payment file", "Vendors and files", "Reads receipts.", ["Payment file"], ["Paid", "Not paid"]),
  P("file.bounce", "Read bounce file", "Vendors and files", "Reads bounces.", ["Bounce file"], ["Bounced", "Clear"]),
  P("people.telecaller", "Task for telecaller", "People", "A telecaller calls with the packet.", ["Handoff packet"], [...DISPOSITIONS], { outreach: true, executor: "Telecaller", cost: 30 }),
  P("people.sales", "Task for sales or branch", "People", "Sales or branch staff act on the policy.", ["Handoff packet"], ["Done", "Not done"], { executor: "Sales officer", cost: 180 }),
  P("people.hv", "Task for high-value desk", "People", "Personal outreach by the high-value desk.", ["Handoff packet"], ["Done", "Not done"], { executor: "High-value desk", cost: 120 }),
  P("people.retention", "Task for surrender retention", "People", "Retention desk speaks with the customer.", ["Handoff packet"], ["Retained", "Surrender"], { executor: "Retention desk", cost: 90 }),
  P("people.underwriting", "Task for underwriting", "People", "Underwriting reviews a declaration.", ["Declaration"], ["Cleared", "Referred"], { executor: "Underwriting", cost: 150 }),
  P("people.remittance", "Task for remittance", "People", "Remittance fixes a mandate or matches a receipt.", ["Mandate state"], ["Fixed", "Not fixed"], { executor: "Remittance and operations", cost: 40 }),
  P("people.lead", "Task for team lead", "People", "Team lead reviews the case.", ["Handoff packet"], ["Done"], { executor: "Team lead", cost: 60 }),
  P("wait.days", "Wait N days", "Wait", "Waits a set number of days.", [], ["Done"]),
  P("wait.until", "Wait until date", "Wait", "Waits until a date.", [], ["Done"]),
  P("wait.payment", "Wait for payment file", "Wait", "Waits for the next payment file.", ["Payment file"], ["Paid", "Not paid"]),
  P("outcome.paid", "Paid", "Outcomes", "Path ends: the premium is paid.", [], []),
  P("outcome.routed", "Routed out", "Outcomes", "Path ends: the case moved to another workflow.", [], []),
  P("outcome.handoff", "Human handoff", "Outcomes", "Path ends: a person owns the case.", [], []),
  P("outcome.excluded", "Excluded", "Outcomes", "Path ends: the policy is excluded.", [], []),
  P("outcome.bau", "Business as usual", "Outcomes", "Path ends: no change.", [], []),
];

export const PALETTE_BY_TYPE: Record<string, PaletteItem> = Object.fromEntries(PALETTE.map((p) => [p.type, p]));
export const AUTO_CHECKS = ["Paid since the list", "On hold", "Contact policy"] as const;

/* ---------- Graph ---------- */

export interface WfNodeConfig {
  description?: string | undefined;
  executor?: string | undefined;
  script?: string | undefined;
  language?: string | undefined;
  offers?: string[] | undefined;
  retries?: number | undefined;
  gapDays?: number | undefined;
  deadlineHours?: number | undefined;
  onTimeout?: "Retry" | "Move to another executor" | "Send to team lead" | undefined;
  days?: number | undefined;
  share?: number | undefined;
  ruleId?: string | undefined;
  condition?: string | undefined;
  /** Routed-out outcomes: the workflow the policy moves to. */
  workflow?: string | undefined;
  /** Dispositions this node returns (outreach nodes). */
  dispositions?: string[] | undefined;
}

export interface WfNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config: WfNodeConfig;
}

export interface WfEdge {
  id: string;
  from: string;
  to: string;
  label?: string | undefined;
}

export interface WfGraph {
  nodes: WfNode[];
  edges: WfEdge[];
}

/* ---------- Seed graphs ---------- */

type NodeSpec = [id: string, type: string, label?: string, config?: WfNodeConfig];
type EdgeSpec = [from: string, to: string, label?: string | undefined];

function build(nodes: NodeSpec[], edges: EdgeSpec[]): WfGraph {
  return {
    nodes: nodes.map(([id, type, label, config]) => {
      const item = PALETTE_BY_TYPE[type];
      return { id, type, label: label ?? item?.label ?? type, x: 0, y: 0, config: { executor: item?.executor, ...(item?.outreach ? { dispositions: defaultDisps(type) } : {}), ...config } };
    }),
    edges: edges.map(([from, to, label], i) => ({ id: `e${i + 1}`, from, to, label })),
  };
}

/** Outreach nodes in the seeds return a short list; Branch on disposition handles the rest. */
function defaultDisps(type: string): string[] {
  if (type === "agent.payment") return ["Paid", "Not paid", "Mandate problem"];
  if (type === "vendor.send" || type === "vendor.visit") return ["Sent"];
  return ["Default"];
}

const W1 = build(
  [
    ["t", "trigger.station", "Station date reached"],
    ["hold", "check.hold"],
    ["prod", "decision.product"],
    ["m1", "agent.message", "Station message (ULIP: fund value)", { script: "Station templates", language: "Customer language" }],
    ["m2", "agent.message", "Station message (Traditional: mandate readiness)", { script: "Station templates" }],
    ["m3", "agent.message", "Station message (Term: short)", { script: "Station templates" }],
    ["v", "agent.voice", "Station 4 and 8 check-in call", { script: "Check-in script", dispositions: ["Will pay (link requested)", "Mandate problem", "Default"] }],
    ["pay", "agent.payment", "Autopay set-up"],
    ["rem", "people.remittance", "Fix mandate"],
    ["w", "wait.until", "Wait until next station"],
    ["o1", "outcome.bau", "Next station"],
    ["o2", "outcome.routed", "Hold (X1)"],
    ["o3", "outcome.paid"],
  ],
  [["t", "hold"], ["hold", "o2", "On hold"], ["hold", "prod", "Clear"], ["prod", "m1", "ULIP"], ["prod", "m2", "Traditional"], ["prod", "m3", "Term"], ["m1", "v", "Default"], ["m2", "v", "Default"], ["m3", "w", "Default"], ["v", "pay", "Will pay (link requested)"], ["v", "rem", "Mandate problem"], ["v", "w", "Default"], ["pay", "o3", "Paid"], ["pay", "w", "Not paid"], ["pay", "rem", "Mandate problem"], ["rem", "w", "Fixed"], ["w", "o1", "Done"]],
);

/** Grace-Period Recovery: guards, propensity route, WhatsApp or call, then reason-led branches. */
const R2 = build(
  [
    ["t", "trigger.due", "Overdue Premium: due date passed, unpaid", { days: 0 }],
    ["hold", "check.hold"],
    ["paid", "check.paid"],
    ["cont", "check.contact"],
    ["hh", "check.household"],
    ["w1", "wait.days", "Wait for the next calling window", { days: 1 }],
    ["cohort", "decision.cohort", "Branch on renewal propensity"],
    ["wa", "agent.message", "Grace Period reminder on WhatsApp", { script: "Grace reminder", language: "Customer language" }],
    ["w2", "wait.days", "Wait 2 days", { days: 2 }],
    ["paid2", "check.paid", "Paid since the reminder"],
    ["bot", "vendor.send", "Voice bot vendor list", { executor: "Voice bot vendor" }],
    ["voice", "agent.voice", "Collection call", { script: "Due-date collection", retries: 2, gapDays: 1, deadlineHours: 48, onTimeout: "Move to another executor" }],
    ["vendor", "vendor.send", "Call-centre vendor list", { executor: "Call-centre vendor (fixed payout)" }],
    ["read", "vendor.read", "Read vendor results"],
    ["disp", "decision.disposition", "Branch on disposition"],
    ["pay", "agent.payment", "Send payment link"],
    ["apr", "check.approval", "Approval for monthly mode offer"],
    ["mode", "agent.message", "Monthly mode offer with payment link", { script: "Mode change offer" }],
    ["cls", "agent.classifier", "Tag the lapse reason"],
    ["sum", "agent.summariser", "Write handoff packet"],
    ["tc", "people.telecaller", "Telecaller call back"],
    ["w3", "wait.days", "Wait 1 day", { days: 1 }],
    ["oPaid", "outcome.paid"],
    ["oR3", "outcome.routed", "Promise-to-Pay Follow-up (R3)"],
    ["oR4", "outcome.routed", "Failed Autopay and ECS Bounce Recovery (R4)"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oL3", "outcome.routed", "ULIP Surrender Prevention (L3)"],
    ["oH", "outcome.handoff", "Telecaller owns the case"],
    ["oL1", "outcome.routed", "Lapse Revival Campaign (L1)"],
  ],
  [
    ["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "paid", "Clear"], ["paid", "oPaid", "Paid"], ["paid", "cont", "Not paid"],
    ["cont", "hh", "Allowed"], ["cont", "w1", "Blocked"], ["w1", "hh", "Done"], ["hh", "cohort", "Clear"], ["hh", "w1", "Wait"],
    ["cohort", "wa", "Highest propensity"], ["cohort", "wa", "High propensity"], ["cohort", "voice", "Moderate propensity"], ["cohort", "vendor", "Low propensity"], ["cohort", "bot", "Lowest propensity"],
    ["wa", "w2", "Default"], ["w2", "paid2", "Done"], ["paid2", "oPaid", "Paid"], ["paid2", "voice", "Not paid"],
    ["bot", "read", "Sent"], ["vendor", "read", "Sent"], ["voice", "disp", "Default"], ["read", "disp", "Default"],
    ["disp", "pay", "Will pay (link requested)"], ["disp", "oR3", "Promise to pay with date"], ["disp", "oPaid", "Already paid"], ["disp", "oR4", "Mandate problem"],
    ["disp", "apr", "Short of cash"], ["disp", "oHold", "Complaint or mis-selling"], ["disp", "oL3", "Wants to surrender"], ["disp", "sum", "Asked for a person"],
    ["disp", "cls", "Unhappy with the policy"], ["disp", "w3", "Not reachable"], ["disp", "w3", "Default"],
    ["apr", "mode", "Approved"], ["apr", "sum", "Returned"], ["mode", "w3", "Default"],
    ["cls", "sum", "Reason"], ["cls", "sum", "Low confidence"], ["sum", "tc", "Packet"], ["tc", "oH", "Default"],
    ["pay", "oPaid", "Paid"], ["pay", "w3", "Not paid"], ["pay", "oR4", "Mandate problem"], ["w3", "oL1", "Done"],
  ],
);

/** Failed Autopay and ECS Bounce Recovery: reason of the bounce decides the first message. */
const R4 = build(
  [
    ["t", "trigger.bounce", "Bounce or mandate failure in file"],
    ["hold", "check.hold"],
    ["paid", "check.paid", "Paid since the file"],
    ["cont", "check.contact"],
    ["w1", "wait.days", "Wait for the next calling window", { days: 1 }],
    ["field", "decision.field", "Bounce reason is insufficient funds", { condition: "Bounce reason is Insufficient funds" }],
    ["msgIF", "agent.message", "Debit failed: keep balance, we will re-present", { script: "Bounce template" }],
    ["msgM", "agent.message", "Mandate rejected: new e-NACH link", { script: "e-NACH set-up" }],
    ["pay", "agent.payment", "Payment link or new e-NACH mandate"],
    ["w2", "wait.days", "Wait 2 days", { days: 2 }],
    ["paid2", "check.paid", "Paid since the message"],
    ["voice", "agent.voice", "Bounce recovery call", { script: "Bounce script", retries: 1, dispositions: ["Will pay (link requested)", "Promise to pay with date", "Mandate problem", "Asked for a person", "Default"] }],
    ["rem", "people.remittance", "Re-present the debit or fix the mandate"],
    ["wp", "wait.payment", "Wait for payment file"],
    ["grace", "decision.field", "Still inside the Grace Period", { condition: "Policy is inside the Grace Period" }],
    ["cls", "agent.classifier", "Tag the lapse reason"],
    ["hvf", "decision.field", "Premium above the high-value limit", { condition: "Annualised premium is above the high-value limit" }],
    ["hv", "people.hv", "Personal call by high-value desk"],
    ["sum", "agent.summariser", "Write handoff packet"],
    ["tc", "people.telecaller", "Telecaller call back"],
    ["oPaid", "outcome.paid"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oR3", "outcome.routed", "Promise-to-Pay Follow-up (R3)"],
    ["oL1", "outcome.routed", "Lapse Revival Campaign (L1)"],
    ["oHV", "outcome.handoff", "High-value desk owns the case"],
    ["oTc", "outcome.handoff", "Telecaller owns the case"],
  ],
  [
    ["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "paid", "Clear"], ["paid", "oPaid", "Paid"], ["paid", "cont", "Not paid"],
    ["cont", "field", "Allowed"], ["cont", "w1", "Blocked"], ["w1", "field", "Done"],
    ["field", "msgIF", "Yes"], ["field", "msgM", "No"], ["msgIF", "pay", "Default"], ["msgM", "rem", "Default"],
    ["pay", "oPaid", "Paid"], ["pay", "w2", "Not paid"], ["pay", "rem", "Mandate problem"],
    ["w2", "paid2", "Done"], ["paid2", "oPaid", "Paid"], ["paid2", "voice", "Not paid"],
    ["voice", "pay", "Will pay (link requested)"], ["voice", "oR3", "Promise to pay with date"], ["voice", "rem", "Mandate problem"], ["voice", "sum", "Asked for a person"], ["voice", "wp", "Default"],
    ["rem", "wp", "Fixed"], ["rem", "wp", "Not fixed"], ["wp", "oPaid", "Paid"], ["wp", "grace", "Not paid"],
    ["grace", "cls", "Yes"], ["grace", "oL1", "No"], ["cls", "hvf", "Reason"], ["cls", "hvf", "Low confidence"],
    ["hvf", "hv", "Yes"], ["hvf", "sum", "No"], ["hv", "oHV", "Done"], ["hv", "oL1", "Not done"],
    ["sum", "tc", "Packet"], ["tc", "oTc", "Default"],
  ],
);

/** Promise-to-Pay Follow-up: remind, wait for the promised date, check, call, then act on what the customer says. */
const R3_FULL = build(
  [
    ["t", "trigger.timer", "Promise date tomorrow"],
    ["hold", "check.hold"],
    ["paid", "check.paid"],
    ["msg", "agent.message", "Promise reminder with payment link", { script: "Promise reminder" }],
    ["w", "wait.until", "Wait until the promised date"],
    ["paid2", "check.paid", "Paid on the promised date"],
    ["voice", "agent.voice", "Promise check call", { script: "Promise follow-up", dispositions: ["Will pay (link requested)", "Promise to pay with date", "Short of cash", "Asked for a person", "Not reachable", "Default"] }],
    ["disp", "decision.disposition", "Branch on disposition"],
    ["second", "decision.field", "Second promise for this premium", { condition: "This is the second promise" }],
    ["pay", "agent.payment", "Send payment link"],
    ["cls", "agent.classifier", "Tag the lapse reason"],
    ["sum", "agent.summariser", "Write handoff packet"],
    ["tc", "people.telecaller", "Telecaller call back"],
    ["oPaid", "outcome.paid"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oR2", "outcome.routed", "Grace-Period Recovery (R2)"],
    ["oR4", "outcome.routed", "Failed Autopay and ECS Bounce Recovery (R4)"],
    ["oL3", "outcome.routed", "ULIP Surrender Prevention (L3)"],
    ["oH", "outcome.handoff", "Telecaller owns the case"],
  ],
  [
    ["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "paid", "Clear"], ["paid", "oPaid", "Paid"], ["paid", "msg", "Not paid"],
    ["msg", "w", "Default"], ["w", "paid2", "Done"], ["paid2", "oPaid", "Paid"], ["paid2", "voice", "Not paid"], ["voice", "disp", "Default"],
    ["disp", "pay", "Will pay (link requested)"], ["disp", "second", "Promise to pay with date"], ["disp", "oPaid", "Already paid"], ["disp", "cls", "Short of cash"],
    ["disp", "oHold", "Complaint or mis-selling"], ["disp", "oL3", "Wants to surrender"], ["disp", "sum", "Asked for a person"], ["disp", "oR2", "Not reachable"], ["disp", "oR2", "Default"],
    ["second", "sum", "Yes"], ["second", "msg", "No"], ["cls", "sum", "Reason"], ["cls", "sum", "Low confidence"],
    ["sum", "tc", "Packet"], ["tc", "oH", "Default"],
    ["pay", "oPaid", "Paid"], ["pay", "oR2", "Not paid"], ["pay", "oR4", "Mandate problem"],
  ],
);

/** e-NACH Mandate Readiness: get autopay in place before the renewal window opens. */
const W3_FULL = build(
  [
    ["t", "trigger.timer", "No active mandate before window"],
    ["hold", "check.hold"],
    ["cont", "check.contact"],
    ["msg", "agent.message", "e-NACH set-up link", { script: "e-NACH set-up" }],
    ["w", "wait.days", "Wait 2 days", { days: 2 }],
    ["mand", "decision.field", "Mandate registered", { condition: "An e-NACH mandate is now active" }],
    ["voice", "agent.voice", "Mandate help call", { script: "Mandate help", dispositions: ["Will pay (link requested)", "Mandate problem", "Not reachable", "Default"] }],
    ["disp", "decision.disposition", "Branch on disposition"],
    ["pay", "agent.payment", "Autopay set-up"],
    ["rem", "people.remittance", "Fix the mandate"],
    ["w2", "wait.days", "Wait 3 days", { days: 3 }],
    ["oReady", "outcome.bau", "Autopay active"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oR1", "outcome.routed", "13th Month Persistency (R1)"],
  ],
  [
    ["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "cont", "Clear"], ["cont", "msg", "Allowed"], ["cont", "w2", "Blocked"],
    ["msg", "w", "Default"], ["w", "mand", "Done"], ["mand", "oReady", "Yes"], ["mand", "voice", "No"], ["voice", "disp", "Default"],
    ["disp", "pay", "Will pay (link requested)"], ["disp", "rem", "Mandate problem"], ["disp", "oHold", "Complaint or mis-selling"], ["disp", "w2", "Not reachable"], ["disp", "w2", "Default"],
    ["pay", "oReady", "Paid"], ["pay", "w2", "Not paid"], ["pay", "rem", "Mandate problem"],
    ["rem", "oReady", "Fixed"], ["rem", "w2", "Not fixed"], ["w2", "oR1", "Done"],
  ],
);

/** PIVC and Welcome Calling: confirm the policy and the Free Look Period, and catch early dissatisfaction. */
const S2_FULL = build(
  [
    ["t", "trigger.event", "Policy issued"],
    ["cont", "check.contact"],
    ["msg", "agent.message", "Welcome message: Free Look Period and Nomination", { script: "Welcome message" }],
    ["w", "wait.days", "Wait 2 days", { days: 2 }],
    ["tc", "people.telecaller", "PIVC and Welcome Calling", { script: "Welcome Calling" }],
    ["disp", "decision.disposition", "Branch on disposition"],
    ["cls", "agent.classifier", "Tag the concern"],
    ["sum", "agent.summariser", "Write handoff packet"],
    ["lead", "people.lead", "Team lead reviews the case"],
    ["oW1", "outcome.routed", "Nine-Station Pre-Renewal Warming (W1)"],
    ["oS3", "outcome.routed", "Free-Look and NTU Watch (S3)"],
    ["oHold", "outcome.routed", "Hold (X1)"],
  ],
  [
    ["t", "cont"], ["cont", "msg", "Allowed"], ["cont", "w", "Blocked"], ["msg", "w", "Default"], ["w", "tc", "Done"], ["tc", "disp", "Default"],
    ["disp", "oW1", "Default"], ["disp", "oW1", "Already paid"], ["disp", "oHold", "Complaint or mis-selling"], ["disp", "oS3", "Wants to surrender"], ["disp", "cls", "Unhappy with the policy"],
    ["disp", "sum", "Asked for a person"], ["disp", "w", "Not reachable"], ["disp", "w", "Wrong person"],
    ["cls", "sum", "Reason"], ["cls", "sum", "Low confidence"], ["sum", "lead", "Packet"], ["lead", "oS3", "Done"],
  ],
);

/** Deep Lapse Revival: eligibility, revival offer, health declaration and Revival / Reinstatement. */
const L2_FULL = build(
  [
    ["t", "trigger.timer", "Lapsed over 180 days"],
    ["hold", "check.hold"],
    ["cont", "check.contact"],
    ["elig", "decision.field", "Eligible for Revival / Reinstatement", { condition: "Policy is within the revival window" }],
    ["v", "vendor.send", "Revival offer call list", { executor: "Call-centre vendor (fixed payout)" }],
    ["read", "vendor.read", "Read vendor results"],
    ["disp", "decision.disposition", "Branch on disposition"],
    ["hd", "people.underwriting", "Health declaration review"],
    ["pay", "agent.payment", "Revival premium link"],
    ["sum", "agent.summariser", "Write handoff packet"],
    ["tc", "people.telecaller", "Telecaller call back"],
    ["oRev", "outcome.paid", "Revived"],
    ["oRef", "outcome.handoff", "Referred to underwriting"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oLapsed", "outcome.bau", "Stays lapsed"],
    ["oTc", "outcome.handoff", "Telecaller owns the case"],
  ],
  [
    ["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "cont", "Clear"], ["cont", "elig", "Allowed"], ["cont", "oLapsed", "Blocked"],
    ["elig", "v", "Yes"], ["elig", "oLapsed", "No"], ["v", "read", "Sent"], ["read", "disp", "Default"],
    ["disp", "hd", "Will pay (link requested)"], ["disp", "hd", "Promise to pay with date"], ["disp", "oRev", "Already paid"], ["disp", "oHold", "Complaint or mis-selling"],
    ["disp", "sum", "Asked for a person"], ["disp", "sum", "Unhappy with the policy"], ["disp", "oLapsed", "Not reachable"], ["disp", "oLapsed", "Default"],
    ["hd", "pay", "Cleared"], ["hd", "oRef", "Referred"], ["pay", "oRev", "Paid"], ["pay", "oLapsed", "Not paid"], ["pay", "oLapsed", "Mandate problem"],
    ["sum", "tc", "Packet"], ["tc", "oTc", "Default"],
  ],
);

/** Complaint, Bereavement and Do-Not-Call Freeze: events that stop outreach everywhere. */
const X1_FULL = build(
  [
    ["t", "trigger.event", "Complaint, Death Intimation or do-not-call"],
    ["ev1", "decision.field", "Event is a Death Intimation", { condition: "Event is a Death Intimation" }],
    ["ev2", "decision.field", "Event is a complaint", { condition: "Event is a complaint" }],
    ["claims", "people.lead", "Claims team takes the Death Intimation"],
    ["grv", "people.lead", "Grievance team takes the complaint"],
    ["dnc", "people.lead", "Contact policy owner updates the do-not-call register"],
    ["oFreeze", "outcome.excluded", "Outreach frozen"],
  ],
  [
    ["t", "ev1"], ["ev1", "claims", "Yes"], ["ev1", "ev2", "No"], ["ev2", "grv", "Yes"], ["ev2", "dnc", "No"],
    ["claims", "oFreeze", "Done"], ["grv", "oFreeze", "Done"], ["dnc", "oFreeze", "Done"],
  ],
);

/** 13th Month Persistency: forks on renewal propensity, so a high-propensity policy gets WhatsApp and a low one gets a call. */
const R1_FULL = build(
  [
    ["t", "trigger.due", "Due list at T minus 90", { days: 90 }],
    ["hold", "check.hold"],
    ["cohort", "decision.cohort", "Branch on renewal propensity"],
    ["wa", "agent.message", "WhatsApp renewal reminder with payment link", { script: "13th month reminder", language: "Customer language" }],
    ["w1", "wait.days", "Wait 3 days", { days: 3 }],
    ["paid", "check.paid", "Paid since the reminder"],
    ["call", "agent.voice", "Early renewal call", { script: "13th month renewal call", retries: 2, gapDays: 2, deadlineHours: 72, onTimeout: "Send to team lead", dispositions: ["Will pay (link requested)", "Promise to pay with date", "Wants to surrender", "Complaint or mis-selling", "Default"] }],
    ["pay", "agent.payment", "Send payment link"],
    ["w2", "wait.days", "Wait 2 days", { days: 2 }],
    ["paid2", "check.paid", "Paid since the call"],
    ["cls", "agent.classifier", "Tag the reason for non-payment"],
    ["sum", "agent.summariser", "Write handoff packet"],
    ["tc", "people.telecaller", "Telecaller call back"],
    ["rem", "people.remittance", "Fix mandate"],
    ["oPaid", "outcome.paid"],
    ["oR3", "outcome.routed", "Promise follow-up (R3)"],
    ["oL3", "outcome.routed", "ULIP Surrender Prevention (L3)"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oH", "outcome.handoff", "Telecaller owns the case"],
    ["oBau", "outcome.bau", "Back to the renewal window"],
  ],
  [
    ["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "cohort", "Clear"],
    ["cohort", "wa", "Highest propensity"], ["cohort", "wa", "High propensity"], ["cohort", "wa", "Moderate propensity"],
    ["cohort", "call", "Low propensity"], ["cohort", "call", "Lowest propensity"],
    ["wa", "w1", "Default"], ["w1", "paid", "Done"], ["paid", "oPaid", "Paid"], ["paid", "call", "Not paid"],
    ["call", "pay", "Will pay (link requested)"], ["call", "oR3", "Promise to pay with date"], ["call", "oL3", "Wants to surrender"], ["call", "oHold", "Complaint or mis-selling"], ["call", "w2", "Default"],
    ["w2", "paid2", "Done"], ["paid2", "oPaid", "Paid"], ["paid2", "cls", "Not paid"],
    ["pay", "oPaid", "Paid"], ["pay", "cls", "Not paid"], ["pay", "rem", "Mandate problem"],
    ["rem", "oBau", "Fixed"], ["rem", "oBau", "Not fixed"],
    ["cls", "sum", "Reason"], ["cls", "sum", "Low confidence"], ["sum", "tc", "Packet"], ["tc", "oH", "Default"],
  ],
);

/** Lapse Revival Campaign. */
const L1_FULL = build(
  [
    ["t", "trigger.timer", "Policy lapsed 180 days or fewer"],
    ["hold", "check.hold"],
    ["paid", "check.paid", "Revived since the list"],
    ["wa", "agent.message", "Revival link on WhatsApp", { script: "Revival link" }],
    ["w1", "wait.days", "Wait 3 days", { days: 3 }],
    ["paid2", "check.paid", "Revived since the message"],
    ["call", "agent.voice", "Revival call", { script: "Revival call", retries: 2, gapDays: 3, dispositions: ["Will pay (link requested)", "Promise to pay with date", "Complaint or mis-selling", "Default"] }],
    ["pay", "agent.payment", "Send revival payment link"],
    ["vendor", "vendor.send", "Recovery call list", { executor: "Call-centre vendor (variable payout)" }],
    ["oRev", "outcome.paid", "Policy revived"],
    ["oR3", "outcome.routed", "Promise follow-up (R3)"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oL2", "outcome.routed", "Deep Lapse Revival (L2)"],
    ["oBau", "outcome.bau", "Stays lapsed"],
  ],
  [
    ["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "paid", "Clear"], ["paid", "oRev", "Paid"], ["paid", "wa", "Not paid"],
    ["wa", "w1", "Default"], ["w1", "paid2", "Done"], ["paid2", "oRev", "Paid"], ["paid2", "call", "Not paid"],
    ["call", "pay", "Will pay (link requested)"], ["call", "oR3", "Promise to pay with date"], ["call", "oHold", "Complaint or mis-selling"], ["call", "vendor", "Default"],
    ["pay", "oRev", "Paid"], ["pay", "vendor", "Not paid"], ["pay", "vendor", "Mandate problem"],
    ["vendor", "oL2", "Sent"],
  ],
);

/** ULIP Surrender Prevention. */
const L3_FULL = build(
  [
    ["t", "trigger.event", "Customer asks to surrender"],
    ["hold", "check.hold"],
    ["cls", "agent.classifier", "Tag the surrender reason"],
    ["sum", "agent.summariser", "Write handoff packet"],
    ["fv", "decision.field", "Fund value above premiums paid", { condition: "Fund value is above premiums paid" }],
    ["ret", "people.retention", "Retention desk call"],
    ["call", "agent.voice", "Product explanation call", { script: "Product explanation", dispositions: ["Will pay (link requested)", "Wants to surrender", "Default"] }],
    ["oKept", "outcome.bau", "Policy retained"],
    ["oSur", "outcome.handoff", "Surrender processed"],
    ["oHold", "outcome.routed", "Hold (X1)"],
  ],
  [
    ["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "cls", "Clear"], ["cls", "sum", "Reason"], ["cls", "sum", "Low confidence"], ["sum", "fv", "Packet"],
    ["fv", "ret", "Yes"], ["fv", "call", "No"],
    ["ret", "oKept", "Retained"], ["ret", "oSur", "Surrender"],
    ["call", "ret", "Will pay (link requested)"], ["call", "oSur", "Wants to surrender"], ["call", "ret", "Default"],
  ],
);

function r1Graph(v: number): WfGraph {
  const nodes: NodeSpec[] = [
    ["t", "trigger.due", "Due list at T minus 15", { days: 15 }],
    ["m", "agent.message", "Pre-due reminder", { script: "Pre-due reminder", language: "Customer language" }],
  ];
  const edges: EdgeSpec[] = [["t", "m"]];
  if (v >= 2) {
    nodes.push(["c", "vendor.send", "Call-centre vendor list", { executor: "Call-centre vendor (fixed payout)", share: v >= 3 ? 30 : 50 }]);
    edges.push(["m", "c", "Default"]);
    nodes.push(["read", "vendor.read", "Read vendor results"]);
    edges.push(["c", "read", "Sent"]);
    nodes.push(["o", "outcome.bau", "Back to the window"]);
    edges.push(["read", "o", "Default"]);
  } else {
    nodes.push(["o", "outcome.bau", "Back to the window"]);
    edges.push(["m", "o", "Default"]);
  }
  if (v >= 3) {
    nodes.push(["pay", "agent.payment", "Send payment link"]);
    nodes.push(["oPaid", "outcome.paid"]);
    edges.push(["read", "pay", "Will pay (link requested)"], ["pay", "oPaid", "Paid"], ["pay", "o", "Not paid"], ["pay", "o", "Mandate problem"]);
  }
  if (v >= 4) {
    nodes.push(["hold", "outcome.routed", "Hold (X1)"]);
    edges.push(["read", "hold", "Complaint or mis-selling"]);
  }
  return build(nodes, edges);
}

/** Lower-detail canvases for the other workflows, using the same node types. */
function simple(trigger: string, triggerLabel: string, steps: NodeSpec[], outcome: string): WfGraph {
  const nodes: NodeSpec[] = [["t", trigger, triggerLabel], ...steps, ["o", "outcome.routed", outcome]];
  const edges: EdgeSpec[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const item = PALETTE_BY_TYPE[nodes[i]![1]];
    const label = item?.outreach ? (nodes[i]![1] === "agent.payment" ? "Paid" : nodes[i]![1].startsWith("vendor") ? "Sent" : "Default") : item?.returns[0];
    edges.push([nodes[i]![0], nodes[i + 1]![0], i === 0 ? undefined : label]);
  }
  const g = build(nodes, edges);
  // Payment nodes need edges for every result they return.
  for (const n of g.nodes.filter((x) => x.type === "agent.payment")) {
    g.edges.push({ id: `e${g.edges.length + 1}`, from: n.id, to: "o", label: "Not paid" }, { id: `e${g.edges.length + 2}`, from: n.id, to: "o", label: "Mandate problem" });
  }
  return g;
}

export const SEED_GRAPHS: Record<string, WfGraph> = {
  S1: simple("trigger.manual", "New policy scored", [["r", "decision.rule", "Top cohort flag", { ruleId: "R10" }], ["u", "people.underwriting", "Underwriting note"]], "Welcome journey"),
  S2: S2_FULL,
  S3: simple("trigger.timer", "Free-look open", [["r", "decision.rule", "Service messages only", { ruleId: "G3" }], ["s", "people.sales", "Free-look follow-up by branch"]], "Warming (W1)"),
  W1,
  W2: simple("trigger.station", "ULIP in policy year 1", [["v", "agent.voice", "Fund value and lock-in call"]], "Warming (W1)"),
  W3: W3_FULL,
  R1: R1_FULL,
  R2,
  R3: R3_FULL,
  R4,
  R5: simple("trigger.due", "Cash or cheque payer unpaid at due", [["paid", "check.paid"], ["v", "vendor.visit", "Visit list for sales officer"]], "Visit done"),
  R6: simple("trigger.due", "Bank-sourced policy in window", [["v", "vendor.send", "List to bank relationship manager", { executor: "Bank relationship manager" }]], "Relationship manager follows up"),
  R7: simple("trigger.due", "Ticket size above the high-value limit", [["h", "people.hv", "Personal call by high-value desk"]], "High-value desk owns the case"),
  L1: L1_FULL,
  L2: L2_FULL,
  L3: L3_FULL,
  X1: X1_FULL,
  X2: simple("trigger.receipt", "Receipt arrives", [["p", "check.paid", "Match to pending tasks"]], "Open tasks cancelled"),
};

const NOTE_R1 = ["First release", "Added call-centre vendor after the reminder", "Payment link for customers who will pay", "Complaints route to hold"];

export function seedWorkflowVersions(code: string): Version<WfGraph>[] {
  if (code === "R1") {
    return [1, 2, 3, 4].map((no) => ({
      no,
      status: no === 4 ? "Active" : "Retired",
      author: no % 2 ? "MIS and analytics" : "Head of Persistency",
      at: new Date(Date.UTC(2026, 3 + no, 3, 6)).toISOString(),
      note: NOTE_R1[no - 1]!,
      approver: "Head of Persistency",
      approvedAt: new Date(Date.UTC(2026, 3 + no, 5, 6)).toISOString(),
      data: no === 4 ? R1_FULL : r1Graph(no),
      sims: [{ id: `SIM-R1-${no}`, at: new Date(Date.UTC(2026, 3 + no, 4, 6)).toISOString(), by: "MIS and analytics", policyId: "SLI02400113", scenario: no >= 3 ? "Pays after the link" : "No answer", result: "Pass", steps: 4 + no }],
    }));
  }
  if (code === "R4") {
    const v1 = structuredClone(R4);
    v1.nodes = v1.nodes.filter((n) => n.id !== "voice");
    v1.edges = v1.edges.filter((e) => e.from !== "voice" && e.to !== "voice").map((e) => (e.from === "pay" && e.label === "Not paid" ? { ...e, to: "wp" } : e));
    return [
      { no: 1, status: "Retired", author: "MIS and analytics", at: "2026-05-10T06:00:00.000Z", note: "First release", approver: "Head of Persistency", approvedAt: "2026-05-12T06:00:00.000Z", data: v1, sims: [{ id: "SIM-R4-1", at: "2026-05-11T06:00:00.000Z", by: "MIS and analytics", policyId: "SLI02400347", scenario: "Pays after the link", result: "Pass", steps: 6 }] },
      { no: 2, status: "Active", author: "Head of Persistency", at: "2026-08-20T06:00:00.000Z", note: "Recovery call when the link is not paid", approver: "Head of Persistency", approvedAt: "2026-08-22T06:00:00.000Z", data: R4, sims: [{ id: "SIM-R4-2", at: "2026-08-21T06:00:00.000Z", by: "Head of Persistency", policyId: "SLI02400347", scenario: "No answer", result: "Pass", steps: 8 }] },
    ];
  }
  const g = SEED_GRAPHS[code];
  if (!g) return [];
  const sims = code === "R2" ? [{ id: "SIM-R2-1", at: "2026-09-14T06:00:00.000Z", by: "MIS and analytics", policyId: "SLI02400113", scenario: "Promises a date", result: "Pass" as const, steps: 6 }] : code === "W1" ? [{ id: "SIM-W1-1", at: "2026-09-02T06:00:00.000Z", by: "MIS and analytics", policyId: "SLI02400210", scenario: "No answer", result: "Pass" as const, steps: 7 }] : undefined;
  return [{ no: 1, status: "Active", author: "MIS and analytics", at: "2026-06-01T06:00:00.000Z", note: "First release", approver: "Head of Persistency", approvedAt: "2026-06-03T06:00:00.000Z", data: g, sims }];
}

/* ---------- Prompt builder: two prepared descriptions ---------- */

export const PREPARED_PROMPTS = [
  "When a bank-sourced policy enters the window, send the account balance request, and if the balance is short call the customer, otherwise stay silent.",
  "For agency policies with a paper mandate, send an e-NACH link on WhatsApp, wait two days, then call if the mandate is not registered.",
] as const;

export interface Generated {
  graph: WfGraph;
  why: { node: string; reason: string }[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function generateFromPrompt(text: string): Generated | null {
  const t = norm(text);
  if (t.includes("balance") && t.includes("bank")) {
    const graph = build(
      [
        ["t", "trigger.due", "Bank-sourced policy enters the window", { days: 90 }],
        ["f", "decision.field", "Channel is bank partner", { condition: "Channel is Bancassurance" }],
        ["m", "agent.message", "Account balance request", { script: "Account balance request", dispositions: ["Default"] }],
        ["b", "decision.field", "Balance short", { condition: "Customer reply says balance is short" }],
        ["v", "agent.voice", "Call the customer", { script: "Balance short call" }],
        ["o1", "outcome.bau", "Stay silent"],
        ["o2", "outcome.routed", "Payment follows the debit"],
      ],
      [["t", "f"], ["f", "m", "Yes"], ["f", "o1", "No"], ["m", "b", "Default"], ["b", "v", "Yes"], ["b", "o1", "No"], ["v", "o2", "Default"]],
    );
    return {
      graph,
      why: [
        { node: "Due list at T minus 90", reason: "'enters the window' means the window opens 90 days before due." },
        { node: "Branch on a field: channel", reason: "'bank-sourced policy' limits it to the bank partner channel." },
        { node: "Renewal Reminder Agent", reason: "'send the account balance request' uses the balance template." },
        { node: "Branch on a field: balance short", reason: "'if the balance is short' splits the path." },
        { node: "Premium Renewal Voice Agent", reason: "'call the customer' on the short-balance path." },
        { node: "Business as usual", reason: "'otherwise stay silent' ends the other path with no contact." },
      ],
    };
  }
  if ((t.includes("nach") || t.includes("mandate")) && t.includes("agency")) {
    const graph = build(
      [
        ["t", "trigger.due", "Agency policy in the window", { days: 60 }],
        ["f", "decision.field", "Paper mandate", { condition: "Payment method is paper mandate" }],
        ["m", "agent.message", "e-NACH link on WhatsApp", { script: "e-NACH set-up" }],
        ["w", "wait.days", "Wait 2 days", { days: 2 }],
        ["r", "decision.field", "Mandate registered", { condition: "Mandate state is Active" }],
        ["v", "agent.voice", "Call to register the mandate", { script: "e-NACH call" }],
        ["o1", "outcome.bau", "Mandate in place"],
        ["o2", "outcome.routed", "Back to reminders"],
      ],
      [["t", "f"], ["f", "m", "Yes"], ["f", "o1", "No"], ["m", "w", "Default"], ["w", "r", "Done"], ["r", "o1", "Yes"], ["r", "v", "No"], ["v", "o2", "Default"]],
    );
    return {
      graph,
      why: [
        { node: "Due list at T minus 60", reason: "Starts while there is time to register a mandate." },
        { node: "Branch on a field: paper mandate", reason: "'agency policies with a paper mandate'." },
        { node: "Renewal Reminder Agent", reason: "'send an e-NACH link on WhatsApp'." },
        { node: "Wait 2 days", reason: "'wait two days'." },
        { node: "Branch on a field: mandate registered", reason: "'if the mandate is not registered'." },
        { node: "Premium Renewal Voice Agent", reason: "'then call'." },
      ],
    };
  }
  return null;
}

export const SCENARIOS = ["Pays after the link", "Promises a date", "No answer", "Asks for a person", "Complaint", "Wants to surrender", "Already paid"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_DISPOSITION: Record<Scenario, string> = {
  "Pays after the link": "Will pay (link requested)",
  "Promises a date": "Promise to pay with date",
  "No answer": "Not reachable",
  "Asks for a person": "Asked for a person",
  Complaint: "Complaint or mis-selling",
  "Wants to surrender": "Wants to surrender",
  "Already paid": "Already paid",
};
