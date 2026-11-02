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
  P("decision.cohort", "Branch on cohort", "Decisions", "One edge per cohort.", ["Cohort"], ["A1", "A2", "A3", "A4", "A5"]),
  P("decision.product", "Branch on product", "Decisions", "One edge per product.", ["Product"], ["ULIP", "Traditional", "Term"]),
  P("decision.field", "Branch on a field", "Decisions", "Branches on a policy field with a condition.", ["Policy facts"], ["Yes", "No"]),
  P("agent.message", "Message agent", "Agents", "Sends an approved template in the customer's language.", ["Template", "Policy facts"], [...DISPOSITIONS], { outreach: true, executor: "Message agent", agentId: "message", cost: 1.2 }),
  P("agent.voice", "Renewal voice agent", "Agents", "Calls the customer with the approved script and records what they say.", ["Script", "Task packet"], [...DISPOSITIONS], { outreach: true, executor: "Renewal voice agent", agentId: "renewal-voice", cost: 7.5 }),
  P("agent.classifier", "Reason classifier", "Agents", "Tags the reason for non-payment.", ["Transcript or message"], ["Reason", "Low confidence"], { executor: "Reason classifier", agentId: "reason-classifier", cost: 0.4 }),
  P("agent.payment", "Payment assist agent", "Agents", "Sends the payment link or autopay set-up and follows the payment.", ["Policy facts", "Mandate state"], ["Paid", "Not paid", "Mandate problem"], { outreach: true, executor: "Payment assist agent", agentId: "payment-assist", cost: 2.1 }),
  P("agent.summariser", "Handoff summariser", "Agents", "Writes the six-field packet when a case moves.", ["Activity", "Transcript"], ["Packet"], { executor: "Handoff summariser", agentId: "handoff-summariser", cost: 0.6 }),
  P("agent.quality", "Quality agent", "Agents", "Checks conduct on calls and messages.", ["Transcript", "Contact policy"], ["Pass", "Breach"], { executor: "Quality agent", agentId: "quality", cost: 0.5 }),
  P("agent.welcome", "Welcome and verification", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("agent.revival", "Revival", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("agent.retention", "Retention", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("agent.brief", "Relationship brief", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
  P("agent.learning", "Learning", "Agents", "Not enabled in this release.", [], [], { disabled: true }),
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
type EdgeSpec = [from: string, to: string, label?: string];

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

const R2 = build(
  [
    ["t", "trigger.due", "Due date passed, unpaid", { days: 0 }],
    ["paid", "check.paid"],
    ["cohort", "decision.cohort", "Branch on cohort"],
    ["bot", "vendor.send", "Voice bot vendor list", { executor: "Voice bot vendor" }],
    ["voice", "agent.voice", "Collection call", { script: "Due-date collection", retries: 2, gapDays: 1, deadlineHours: 48, onTimeout: "Move to another executor" }],
    ["vendor", "vendor.send", "Call-centre vendor list", { executor: "Call-centre vendor (fixed payout)" }],
    ["read", "vendor.read", "Read vendor results"],
    ["disp", "decision.disposition", "Branch on disposition"],
    ["pay", "agent.payment", "Send payment link"],
    ["sum", "agent.summariser", "Write handoff packet"],
    ["tc", "people.telecaller", "Telecaller call back"],
    ["wait", "wait.days", "Wait 1 day", { days: 1 }],
    ["oPaid", "outcome.paid"],
    ["oR3", "outcome.routed", "Promise follow-up (R3)"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oL3", "outcome.routed", "Surrender retention (L3)"],
    ["oH", "outcome.handoff", "Telecaller owns the case"],
    ["oL1", "outcome.routed", "Early-lapse recovery (L1)"],
  ],
  [
    ["t", "paid"], ["paid", "oPaid", "Paid"], ["paid", "cohort", "Not paid"], ["cohort", "bot", "A5"], ["cohort", "voice", "A3"], ["cohort", "voice", "A4"], ["cohort", "vendor", "A1"], ["cohort", "vendor", "A2"],
    ["bot", "read", "Sent"], ["vendor", "read", "Sent"], ["voice", "disp", "Default"], ["read", "disp", "Default"],
    ["disp", "pay", "Will pay (link requested)"], ["disp", "oR3", "Promise to pay with date"], ["disp", "oPaid", "Already paid"], ["disp", "oHold", "Complaint or mis-selling"], ["disp", "oL3", "Wants to surrender"], ["disp", "sum", "Asked for a person"], ["disp", "wait", "Not reachable"], ["disp", "wait", "Default"],
    ["sum", "tc", "Packet"], ["tc", "oH", "Default"], ["pay", "oPaid", "Paid"], ["pay", "wait", "Not paid"], ["pay", "oL1", "Mandate problem"], ["wait", "oL1", "Done"],
  ],
);

const R4 = build(
  [
    ["t", "trigger.bounce"],
    ["hold", "check.hold"],
    ["field", "decision.field", "Bounce reason is insufficient funds", { condition: "Bounce reason is Insufficient funds" }],
    ["msg", "agent.message", "Debit failed message", { script: "Bounce template" }],
    ["pay", "agent.payment", "Payment link or new mandate"],
    ["voice", "agent.voice", "Bounce recovery call", { script: "Bounce script", dispositions: ["Will pay (link requested)", "Mandate problem", "Default"] }],
    ["rem", "people.remittance", "Re-present or new mandate"],
    ["wp", "wait.payment", "Wait for payment file"],
    ["oPaid", "outcome.paid"],
    ["oHold", "outcome.routed", "Hold (X1)"],
    ["oL1", "outcome.routed", "Early-lapse recovery (L1)"],
  ],
  [["t", "hold"], ["hold", "oHold", "On hold"], ["hold", "field", "Clear"], ["field", "msg", "Yes"], ["field", "rem", "No"], ["msg", "pay", "Default"], ["pay", "oPaid", "Paid"], ["pay", "voice", "Not paid"], ["pay", "rem", "Mandate problem"], ["voice", "pay", "Will pay (link requested)"], ["voice", "rem", "Mandate problem"], ["voice", "wp", "Default"], ["rem", "wp", "Fixed"], ["rem", "wp", "Not fixed"], ["wp", "oPaid", "Paid"], ["wp", "oL1", "Not paid"]],
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
  S2: simple("trigger.event", "Policy issued", [["l", "people.telecaller", "Welcome and verification call"]], "Warming (W1)"),
  S3: simple("trigger.timer", "Free-look open", [["r", "decision.rule", "Service messages only", { ruleId: "G3" }], ["s", "people.sales", "Free-look follow-up by branch"]], "Warming (W1)"),
  W1,
  W2: simple("trigger.station", "ULIP in policy year 1", [["v", "agent.voice", "Fund value and lock-in call"]], "Warming (W1)"),
  W3: simple("trigger.timer", "No active mandate before window", [["m", "agent.message", "e-NACH set-up link"], ["w", "wait.days", "Wait 2 days", { days: 2 }], ["p", "agent.payment", "Autopay set-up"]], "Renewal window"),
  R1: r1Graph(4),
  R2,
  R3: simple("trigger.timer", "Promise date tomorrow", [["m", "agent.message", "Promise reminder"], ["w", "wait.payment", "Wait for payment file"]], "Due-date collection (R2)"),
  R4,
  R5: simple("trigger.due", "Cash or cheque payer unpaid at due", [["paid", "check.paid"], ["v", "vendor.visit", "Visit list for sales officer"]], "Visit done"),
  R6: simple("trigger.due", "Bank-sourced policy in window", [["v", "vendor.send", "List to bank relationship manager", { executor: "Bank relationship manager" }]], "Relationship manager follows up"),
  R7: simple("trigger.due", "Ticket size above the high-value limit", [["h", "people.hv", "Personal call by high-value desk"]], "High-value desk owns the case"),
  L1: simple("trigger.timer", "Lapsed 180 days or less", [["m", "agent.message", "Revival link"], ["v", "vendor.send", "Recovery call list", { executor: "Call-centre vendor (variable payout)" }]], "Revival or late lapse"),
  L2: simple("trigger.timer", "Lapsed over 180 days", [["v", "vendor.send", "Revival offer call list"], ["u", "people.underwriting", "Health declaration review"]], "Revived or referred"),
  L3: simple("trigger.event", "Customer says wants out", [["s", "agent.summariser", "Write handoff packet"], ["r", "people.retention", "Retention desk call"]], "Retained or surrendered"),
  X1: simple("trigger.event", "Complaint, bereavement or do-not-call", [["h", "check.hold", "Set hold"], ["l", "people.lead", "Grievance or claims team"]], "Outreach frozen"),
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
      approver: "Head of Persistency, Compliance and quality",
      approvedAt: new Date(Date.UTC(2026, 3 + no, 5, 6)).toISOString(),
      data: r1Graph(no),
      sims: [{ id: `SIM-R1-${no}`, at: new Date(Date.UTC(2026, 3 + no, 4, 6)).toISOString(), by: "MIS and analytics", policyId: "SLI02400118", scenario: no >= 3 ? "Pays after the link" : "No answer", result: "Pass", steps: 4 + no }],
    }));
  }
  if (code === "R4") {
    const v1 = structuredClone(R4);
    v1.nodes = v1.nodes.filter((n) => n.id !== "voice");
    v1.edges = v1.edges.filter((e) => e.from !== "voice" && e.to !== "voice").map((e) => (e.from === "pay" && e.label === "Not paid" ? { ...e, to: "wp" } : e));
    return [
      { no: 1, status: "Retired", author: "MIS and analytics", at: "2026-05-10T06:00:00.000Z", note: "First release", approver: "Head of Persistency, Compliance and quality", approvedAt: "2026-05-12T06:00:00.000Z", data: v1, sims: [{ id: "SIM-R4-1", at: "2026-05-11T06:00:00.000Z", by: "MIS and analytics", policyId: "SLI02400342", scenario: "Pays after the link", result: "Pass", steps: 6 }] },
      { no: 2, status: "Active", author: "Head of Persistency", at: "2026-08-20T06:00:00.000Z", note: "Recovery call when the link is not paid", approver: "Head of Persistency, Compliance and quality", approvedAt: "2026-08-22T06:00:00.000Z", data: R4, sims: [{ id: "SIM-R4-2", at: "2026-08-21T06:00:00.000Z", by: "Head of Persistency", policyId: "SLI02400342", scenario: "No answer", result: "Pass", steps: 8 }] },
    ];
  }
  const g = SEED_GRAPHS[code];
  if (!g) return [];
  const sims = code === "R2" ? [{ id: "SIM-R2-1", at: "2026-09-14T06:00:00.000Z", by: "MIS and analytics", policyId: "SLI02400118", scenario: "Promises a date", result: "Pass" as const, steps: 6 }] : code === "W1" ? [{ id: "SIM-W1-1", at: "2026-09-02T06:00:00.000Z", by: "MIS and analytics", policyId: "SLI02400210", scenario: "No answer", result: "Pass" as const, steps: 7 }] : undefined;
  return [{ no: 1, status: "Active", author: "MIS and analytics", at: "2026-06-01T06:00:00.000Z", note: "First release", approver: "Head of Persistency, Compliance and quality", approvedAt: "2026-06-03T06:00:00.000Z", data: g, sims }];
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
        { node: "Message agent", reason: "'send the account balance request' uses the balance template." },
        { node: "Branch on a field: balance short", reason: "'if the balance is short' splits the path." },
        { node: "Renewal voice agent", reason: "'call the customer' on the short-balance path." },
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
        { node: "Message agent", reason: "'send an e-NACH link on WhatsApp'." },
        { node: "Wait 2 days", reason: "'wait two days'." },
        { node: "Branch on a field: mandate registered", reason: "'if the mandate is not registered'." },
        { node: "Renewal voice agent", reason: "'then call'." },
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
