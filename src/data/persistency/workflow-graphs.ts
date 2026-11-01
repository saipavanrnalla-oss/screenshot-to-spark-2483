export type NodeKind = "Rule" | "File" | "LLM" | "Human" | "Stub";

export interface FlowNodeDef {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  /** What configuration this step reads. */
  reads: string[];
  detail: string;
  /** Sends on a live channel, so it offers "Send test". */
  liveChannel?: boolean | undefined;
}

export interface FlowEdgeDef {
  from: string;
  to: string;
  label?: string | undefined;
}

export interface WorkflowGraph {
  nodes: FlowNodeDef[];
  edges: FlowEdgeDef[];
}

const C = 250; // column width
const R = 110; // row height

function n(id: string, label: string, kind: NodeKind, col: number, row: number, reads: string[], detail: string, liveChannel?: boolean): FlowNodeDef {
  return { id, label, kind, x: col * C, y: row * R, reads, detail, liveChannel };
}

export const WORKFLOW_GRAPHS: Record<string, WorkflowGraph> = {
  W1: {
    nodes: [
      n("f1", "due_list (daily 06:00)", "File", 0, 1, ["File adapter: due_list"], "Reads next due date per policy to place it on the nine-station track."),
      n("r1", "Station date reached?", "Rule", 1, 1, ["Configuration: station calendar (day offsets, labels)"], "Compares today with each station's day offset from the due date."),
      n("r2", "Product variant", "Rule", 2, 1, ["Product matrix: Warming column", "Rules R07, R08, R09"], "ULIP starts a month earlier with fund value and lock-in content. Traditional adds mandate readiness. Term stays short."),
      n("r3", "Contact cap and holds", "Rule", 3, 0, ["Guardrails G1, G2", "Contact rules"], "Skips the station if the policy is on hold or at 8 touches in 30 days."),
      n("l1", "Personalise in customer language", "LLM", 3, 2, ["Scripts and templates", "Language list"], "Fills the approved template in the customer's language."),
      n("s1", "Send WhatsApp via WhatsApp vendor", "Stub", 4, 1, ["Executor routing", "Vendor mode: WhatsApp vendor"], "Queues the message to the vendor file.", true),
      n("h1", "Voice check-in (stations 4 and 8)", "Human", 4, 3, ["Executor routing", "Handoff rules"], "A short call by Desible voice or a telecaller to confirm contact details and how they will pay."),
      n("f2", "vendor_dispositions read-back", "File", 5, 1, ["File adapter: vendor_dispositions"], "Reads delivery and reply status from the vendor's file the next morning."),
      n("r4", "Mandate missing at station 3?", "Rule", 5, 3, ["Rule R09", "mandate_status file"], "Hands cash and branch payers to W3 Mandate readiness check."),
      n("r5", "Next station or renewal window", "Rule", 6, 1, ["Configuration: station calendar"], "Moves the policy to the next station; station 7 opens the renewal window."),
      n("x1", "Hold raised: go to X1", "Rule", 4, 0, ["Guardrail G1"], "A complaint, bereavement or stop-calling request freezes all outreach."),
    ],
    edges: [
      { from: "f1", to: "r1" }, { from: "r1", to: "r2", label: "Due" }, { from: "r2", to: "r3" }, { from: "r2", to: "l1" },
      { from: "r3", to: "x1", label: "Hold" }, { from: "r3", to: "s1", label: "Clear" }, { from: "l1", to: "s1" }, { from: "l1", to: "h1", label: "Station 4 or 8" },
      { from: "s1", to: "f2" }, { from: "h1", to: "r4" }, { from: "f2", to: "r5" }, { from: "r4", to: "r5", label: "Mandate active" },
    ],
  },
  R2: {
    nodes: [
      n("f1", "due_list (daily 06:00)", "File", 0, 1, ["File adapter: due_list"], "Policies whose due date has passed and are unpaid enter grace."),
      n("f2", "receipts (daily 07:00)", "File", 1, 1, ["File adapter: receipts", "Paid-meanwhile check"], "Re-reads the latest receipts before any call is placed."),
      n("r1", "Paid since the list?", "Rule", 2, 1, ["Guardrail G5", "Workflow X2"], "If a receipt arrived, the action is cancelled and logged."),
      n("r2", "Cancel and send receipt", "Rule", 3, 0, ["Workflow X2"], "Sends a receipt confirmation only."),
      n("r3", "Route by cohort and method", "Rule", 3, 2, ["Rules R02, R03, R04, R16", "Cohort (active set)"], "High-risk cohorts get the voice bot first, cash payers a field visit, others a telecall."),
      n("s1", "Voice bot call (Voice bot vendor)", "Stub", 4, 1, ["Executor routing", "Vendor mode: Voice bot vendor"], "Outbound voice bot call.", true),
      n("h1", "Collection call (Call-centre vendor (fixed payout))", "Human", 4, 3, ["Scripts and templates", "Vendor mode: Call-centre vendor (fixed payout)"], "Telecaller uses the product script on the handoff screen."),
      n("r4", "Outcome", "Rule", 5, 2, ["Reason codes", "Handoff rules"], "Paid, promise, not reached, wants out or hold, from the disposition file."),
      n("r5", "Promise: go to R3", "Rule", 6, 0, ["Workflow R3"], "Reminder the day before the promised date."),
      n("r6", "Wants out: go to L3", "Rule", 6, 1, ["Guardrail G4"], "No further collection calls; retention desk takes over."),
      n("r7", "Hold: go to X1", "Rule", 6, 2, ["Guardrail G1"], "All outreach stops."),
      n("r8", "Not reached: retry, then L1 at grace end", "Rule", 6, 3, ["Contact rules", "Targets and alerts"], "Retries within the contact cap; lapses to early-lapse recovery after grace."),
    ],
    edges: [
      { from: "f1", to: "f2" }, { from: "f2", to: "r1" }, { from: "r1", to: "r2", label: "Paid" }, { from: "r1", to: "r3", label: "Unpaid" },
      { from: "r3", to: "s1", label: "High risk" }, { from: "r3", to: "h1", label: "Others" }, { from: "s1", to: "r4" }, { from: "h1", to: "r4" },
      { from: "r4", to: "r5", label: "Promise" }, { from: "r4", to: "r6", label: "Wants out" }, { from: "r4", to: "r7", label: "Hold" }, { from: "r4", to: "r8", label: "Not reached" },
    ],
  },
  R4: {
    nodes: [
      n("f1", "bounce_returns (daily 07:00)", "File", 0, 0, ["File adapter: bounce_returns"], "Bounce codes from the bank. Decisions pause if this file is late."),
      n("f2", "mandate_status (daily 05:30)", "File", 0, 2, ["File adapter: mandate_status"], "Mandate registrations, rejections and cancellations."),
      n("r1", "Classify reason", "Rule", 1, 1, ["Reason codes"], "Insufficient funds, mandate cancelled, account closed or technical."),
      n("s1", "Re-present mandate", "Stub", 2, 0, ["Approvals required: Ops / remittance"], "Re-presentation on the next allowed date."),
      n("r2", "Re-presentation result", "Rule", 3, 0, ["mandate_status file"], "Reads the next day's file."),
      n("s2", "Voice bot reminder (Voice bot vendor)", "Stub", 2, 2, ["Rule R06", "Executor routing"], "Tells the customer the debit failed and when it will be retried.", true),
      n("h1", "Ops retry batch", "Human", 3, 2, ["Approvals required"], "Ops lead approves the retry batch on the Mandates and bounces screen."),
      n("r3", "Paid: go to X2", "Rule", 4, 0, ["Workflow X2"], "Receipt confirmation only."),
      n("r4", "New mandate needed: go to W3", "Rule", 4, 1, ["Workflow W3"], "Account closed or mandate cancelled."),
      n("r5", "Grace ends: go to L1", "Rule", 4, 2, ["Grace rules"], "Early-lapse recovery starts the day after grace ends."),
    ],
    edges: [
      { from: "f1", to: "r1" }, { from: "f2", to: "r1" }, { from: "r1", to: "s1", label: "Funds" }, { from: "r1", to: "s2" },
      { from: "s1", to: "r2" }, { from: "s2", to: "h1" }, { from: "h1", to: "r2" }, { from: "r2", to: "r3", label: "Paid" },
      { from: "r1", to: "r4", label: "Mandate gone" }, { from: "r2", to: "r5", label: "Failed again" },
    ],
  },
  L2: {
    nodes: [
      n("f1", "Lapse extract (due_list)", "File", 0, 1, ["File adapter: due_list"], "Policies lapsed for more than 180 days."),
      n("r1", "Late lapse over 180 days", "Rule", 1, 1, ["Rule R14"], "Revival needs a good-health declaration or medicals."),
      n("r2", "Product and ticket", "Rule", 2, 1, ["Insurer default D3 (Term)", "Insurer default D2 (HNI)"], "Term always needs a declaration; ₹5,00,000 and above goes to the High-value desk."),
      n("l1", "Draft revival letter", "LLM", 3, 0, ["Scripts and templates"], "Drafts a plain-language revival letter.; a person approves it."),
      n("h1", "Revival offer call (Call-centre vendor (fixed payout))", "Human", 3, 2, ["Executor routing", "Offers"], "Explains revival cost and the health declaration."),
      n("h2", "Underwriting review", "Human", 4, 1, ["Approvals required: Underwriting"], "Clears the declaration or asks for medicals."),
      n("r3", "Clear or refer", "Rule", 5, 1, ["Underwriting rules"], "Cleared goes to payment; referred books medicals."),
      n("s1", "Book medicals", "Stub", 6, 2, ["Vendor: diagnostics partner"], "Appointment booking ."),
      n("s2", "Revival payment", "Stub", 6, 0, ["receipts file"], "Payment ."),
      n("r4", "Revived: back to Warming", "Rule", 7, 1, ["Workflow W1"], "Restarts the nine-station track for the next due date."),
    ],
    edges: [
      { from: "f1", to: "r1" }, { from: "r1", to: "r2" }, { from: "r2", to: "l1" }, { from: "r2", to: "h1" },
      { from: "l1", to: "h2", label: "Approved letter" }, { from: "h1", to: "h2", label: "Interested" }, { from: "h2", to: "r3" },
      { from: "r3", to: "s2", label: "Cleared" }, { from: "r3", to: "s1", label: "Refer" }, { from: "s1", to: "h2", label: "Reports in" }, { from: "s2", to: "r4" },
    ],
  },
  L3: {
    nodes: [
      n("r1", "Wants out detected", "Rule", 0, 1, ["Guardrail G4", "Reason codes"], "From a call disposition, a branch request or a surrender form."),
      n("r2", "Stop collection outreach", "Rule", 1, 1, ["Guardrail G4"], "Cancels every scheduled collection action."),
      n("l1", "Summarise history", "LLM", 2, 0, ["Timeline", "Touch history"], "Short summary of past touches for the retention agent."),
      n("r3", "Pick retention offers", "Rule", 2, 2, ["Offers", "Product matrix"], "ULIP: partial withdrawal or premium holiday. Traditional: reduced paid-up or mode change. Term: mode change."),
      n("h1", "Retention desk call", "Human", 3, 1, ["Handoff rules", "Scripts and templates"], "Warm handoff with the reason and the offers allowed."),
      n("h2", "Offer approval", "Human", 4, 2, ["Approvals required"], "Offers above the agent's limit need the desk lead."),
      n("r4", "Outcome", "Rule", 5, 1, ["Reason codes"], "Retained, still wants to surrender, or complaint."),
      n("r5", "Retained: back to renewal", "Rule", 6, 0, ["Workflow R1"], "Normal reminders resume after a 7-day quiet period."),
      n("r6", "Surrender processed", "Rule", 6, 1, ["Servicing team"], "Hands off to servicing; no further persistency outreach."),
      n("r7", "Complaint: go to X1", "Rule", 6, 2, ["Guardrail G1"], "Freezes all outreach."),
    ],
    edges: [
      { from: "r1", to: "r2" }, { from: "r2", to: "l1" }, { from: "r2", to: "r3" }, { from: "l1", to: "h1" }, { from: "r3", to: "h1" },
      { from: "h1", to: "h2", label: "Offer above limit" }, { from: "h1", to: "r4" }, { from: "h2", to: "r4" },
      { from: "r4", to: "r5", label: "Retained" }, { from: "r4", to: "r6", label: "Surrender" }, { from: "r4", to: "r7", label: "Complaint" },
    ],
  },
  X1: {
    nodes: [
      n("f1", "CRM complaints and DND list", "File", 0, 1, ["File adapter: CRM extract"], "Complaints, bereavement notes and stop-calling requests."),
      n("r1", "Hold state set", "Rule", 1, 1, ["Guardrail G1"], "Complaint-hold, Bereavement-hold or Do-not-contact."),
      n("r2", "Cancel every scheduled action", "Rule", 2, 1, ["Guardrail G1", "Kill switch"], "All channels, all vendors, immediately."),
      n("s1", "Tell vendors to stop", "Stub", 3, 0, ["Vendor modes", "Dispatch file"], "Adds the policy to the next suppression file."),
      n("h1", "Grievance team", "Human", 3, 1, ["Approvals required: Compliance"], "Owns complaints until closed."),
      n("h2", "Claims team (bereavement)", "Human", 3, 2, ["Handoff rules"], "Starts the claim conversation; no persistency outreach."),
      n("r3", "Hold closed?", "Rule", 4, 1, ["CRM extract"], "Checked daily."),
      n("r4", "Resume after 7-day quiet period", "Rule", 5, 1, ["Contact rules"], "Normal workflow resumes only for complaints closed in the customer's favour or withdrawn."),
      n("f2", "Audit log entry", "File", 5, 2, ["Audit log"], "Every hold, cancel and resume is logged with the rule."),
    ],
    edges: [
      { from: "f1", to: "r1" }, { from: "r1", to: "r2" }, { from: "r2", to: "s1" }, { from: "r2", to: "h1", label: "Complaint" },
      { from: "r2", to: "h2", label: "Bereavement" }, { from: "h1", to: "r3" }, { from: "r3", to: "r4", label: "Closed" }, { from: "r2", to: "f2" },
    ],
  },
};

/** Read-only step lists for the twelve workflows without a full canvas. */
export const WORKFLOW_STEPS: Record<string, { label: string; kind: NodeKind }[]> = {
  S1: [{ label: "New business file arrives", kind: "File" }, { label: "Score with active cohort set", kind: "Rule" }, { label: "Flag top cohort for early welcome call", kind: "Rule" }, { label: "Underwriting note if flagged", kind: "Human" }],
  S2: [{ label: "Policy issued (new business file)", kind: "File" }, { label: "Welcome and PIVC call in customer language", kind: "Stub" }, { label: "Mis-selling cues to compliance", kind: "Rule" }, { label: "Call summary for the record", kind: "LLM" }],
  S3: [{ label: "Free-look period opens", kind: "Rule" }, { label: "Service messages only (G3)", kind: "Rule" }, { label: "Cancellation request watch", kind: "File" }, { label: "NTU follow-up by branch", kind: "Human" }],
  W2: [{ label: "ULIP in policy year 1", kind: "Rule" }, { label: "Fund value and lock-in explainer call", kind: "Stub" }, { label: "Questions to relationship manager", kind: "Human" }],
  W3: [{ label: "mandate_status file", kind: "File" }, { label: "No active mandate before window", kind: "Rule" }, { label: "Offer NACH or UPI autopay setup", kind: "Stub" }, { label: "Bank registration result", kind: "Stub" }],
  R1: [{ label: "due_list: T-90 to due date", kind: "File" }, { label: "Pick template by product and language", kind: "Rule" }, { label: "WhatsApp reminder with payment link", kind: "Stub" }, { label: "Delivery read-back", kind: "File" }],
  R3: [{ label: "Promise recorded with a date", kind: "Rule" }, { label: "Reminder the day before", kind: "Stub" }, { label: "Check receipts on the promised date", kind: "File" }, { label: "Broken promise goes back to R2", kind: "Rule" }],
  R5: [{ label: "Cash or cheque payer unpaid at due", kind: "Rule" }, { label: "Build visit list by branch and route", kind: "Rule" }, { label: "Sales officer visit", kind: "Human" }, { label: "Paid-meanwhile check before each visit", kind: "File" }],
  R6: [{ label: "Bank-sourced policy in window", kind: "Rule" }, { label: "Customer list to bank RM", kind: "Stub" }, { label: "RM follows up", kind: "Human" }, { label: "Branch persistency report", kind: "File" }],
  R7: [{ label: "Premium ₹5,00,000 or more", kind: "Rule" }, { label: "Personal outreach draft", kind: "LLM" }, { label: "Relationship manager approves and calls", kind: "Human" }],
  L1: [{ label: "Lapsed 180 days or less", kind: "Rule" }, { label: "Revival link: premium plus late fee", kind: "Stub" }, { label: "Recovery telecall for high-risk cohorts", kind: "Human" }, { label: "Late fee waiver needs approval", kind: "Human" }],
  X2: [{ label: "receipts file arrives", kind: "File" }, { label: "Match receipts to pending actions", kind: "Rule" }, { label: "Cancel action and log 'paid since the list'", kind: "Rule" }, { label: "Branch payments arrive a day late", kind: "File" }],
};
