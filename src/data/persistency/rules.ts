import type { DimensionKey, Rule } from "./types";

export const DIMENSIONS: { key: DimensionKey; label: string; values: string[] }[] = [
  { key: "product", label: "Product family", values: ["ULIP", "Traditional", "Term"] },
  { key: "policyYear", label: "Policy year", values: ["1", "2", "3", "4-5", "6+"] },
  { key: "paymentMode", label: "Payment mode", values: ["Monthly", "Quarterly", "Half-yearly", "Annual"] },
  { key: "paymentMethod", label: "Payment method / mandate", values: ["NACH/ECS mandate", "Credit card SI", "Cash/cheque", "UPI autopay", "Bank branch"] },
  { key: "channel", label: "Channel", values: ["Agency", "Bancassurance", "Online", "Direct"] },
  { key: "cohort", label: "Cohort (active set)", values: ["A1", "A2", "A3", "A4", "A5", "High", "Medium", "Low", "Band 1", "Band 2", "Band 3", "Band 4", "Band 5", "Unscored"] },
  { key: "ticketBand", label: "Ticket size band", values: ["Under ₹25,000", "₹25,000 to ₹1,00,000", "₹1,00,000 to ₹5,00,000", "₹5,00,000 and above"] },
  { key: "customerProfile", label: "Customer profile", values: ["Salaried", "Self-employed", "Senior", "HNI", "NRI"] },
  { key: "language", label: "Language / region", values: ["Hindi", "English", "Marathi", "Tamil", "Telugu", "Kannada", "Bengali", "Gujarati", "North", "South", "East", "West"] },
  { key: "advisorStatus", label: "Advisor status", values: ["Active", "Inactive", "Left"] },
  { key: "stage", label: "Lifecycle stage", values: ["Sourcing", "Warming", "Renewal window", "Early lapse", "Late lapse"] },
  { key: "state", label: "Event / state", values: ["Welcome pending", "PIVC pending", "Free-look open", "Renewal window open", "Promised", "Paid", "Grace", "Lapsed early", "Lapsed late", "Revival offered", "Revived", "Surrender-intent", "Complaint-hold", "Bereavement-hold", "Do-not-contact"] },
  { key: "reasonCode", label: "Reason code", values: ["Money problem", "Forgot", "Lost interest", "Mis-sold", "Wants to surrender", "Will pay later", "Not reached", "Mandate bounce", "Mandate failed"] },
  { key: "calendar", label: "Calendar", values: ["Month-end (last 5 days)", "Mid-month", "Festival window"] },
  { key: "touchHistory", label: "Touch history", values: ["No touches in 30 days", "1 to 3 touches in 30 days", "4 to 7 touches in 30 days", "8 or more touches in 30 days"] },
  { key: "executor", label: "Executor", values: ["Call-centre vendor (fixed payout)", "Call-centre vendor (variable payout)", "WhatsApp vendor", "Voice bot vendor", "Bank relationship manager", "Sales officer", "High-value desk", "Retention desk"] },
  { key: "insurer", label: "Insurer", values: ["Sample Life Insurance"] },
];

export const DIMENSION_LABEL: Record<DimensionKey, string> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, d.label]),
) as Record<DimensionKey, string>;

export const RULE_SETTINGS = [
  "Treatment",
  "Scripts and templates",
  "Offers",
  "Approvals required",
  "Contact rules",
  "Executor routing",
  "Handoff rules",
  "Targets and alerts",
  "Exclusions",
] as const;

const EFF = "2026-10-01";
const PROPOSED = "Proposed by Desible, insurer to confirm" as const;
const INSURER = "Insurer rule" as const;

export const SEED_RULES: Rule[] = [
  // Guardrails: always win, locked.
  {
    id: "G1", name: "Hold freezes all outreach", stage: "Any", level: "guardrail", priority: 1, locked: true, source: INSURER,
    when: { state: ["Complaint-hold", "Bereavement-hold", "Do-not-contact"] },
    then: { workflowId: "X1", action: "Freeze all outreach", executor: "None", freeze: true, delayHours: 0, contactRule: "No contact on any channel" },
    effectiveFrom: EFF, needsApprovalFrom: "Compliance",
  },
  {
    id: "G2", name: "Contact cap: 8 touches in 30 days", stage: "Any", level: "guardrail", priority: 2, locked: true, source: PROPOSED,
    when: { touchHistory: ["8 or more touches in 30 days"] },
    then: { workflowId: "X1", action: "Hold outreach until contact count drops", executor: "None", freeze: true, delayHours: 72, contactRule: "Max 2 touches a week, max 8 in 30 days" },
    effectiveFrom: EFF, needsApprovalFrom: "Compliance",
  },
  {
    id: "G3", name: "No collection messages during free-look", stage: "Sourcing", level: "guardrail", priority: 3, locked: true, source: INSURER,
    when: { state: ["Free-look open"] },
    then: { workflowId: "S3", action: "Watch only, service messages allowed", executor: "Message agent", delayHours: 24, exclusions: "Renewal and payment content" },
    effectiveFrom: EFF, needsApprovalFrom: "Compliance",
  },
  {
    id: "G4", name: "Wants out routes to retention, no collection call", stage: "Any", level: "guardrail", priority: 4, locked: true, source: INSURER,
    when: { state: ["Surrender-intent"] },
    then: { workflowId: "L3", action: "Route to surrender retention desk", executor: "Retention desk", delayHours: 4, handoff: "Warm handoff with reason" },
    effectiveFrom: EFF, needsApprovalFrom: "Compliance",
  },
  {
    id: "G5", name: "Paid policies receive no payment outreach", stage: "Any", level: "guardrail", priority: 5, locked: true, source: INSURER,
    when: { state: ["Paid", "Revived"] },
    then: { workflowId: "X2", action: "Send receipt confirmation only", executor: "WhatsApp vendor", delayHours: 2 },
    effectiveFrom: EFF, needsApprovalFrom: "Compliance",
  },

  // Insurer defaults: outrank Desible rules wherever they match.
  {
    id: "D1", name: "Bank-sourced: RM nudge before any direct call", stage: "Renewal window", level: "insurer", priority: 10, source: INSURER,
    when: { channel: ["Bancassurance"], stage: ["Renewal window"] },
    then: { workflowId: "R6", action: "Nudge bank RM with customer list", executor: "Bank relationship manager", delayHours: 6, approvals: "Bank partner manager" },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "D2", name: "High-value desk", stage: "Renewal window", level: "insurer", priority: 11, source: INSURER, version: 3,
    description: "Ticket size above ₹2 lakh goes to the high-value desk. No automated calls.",
    when: { stage: ["Renewal window", "Early lapse"] },
    conds: [[{ dim: "ticketBand", op: "above", values: [], n: 200_000 }]],
    then: { workflowId: "R7", action: "Route to high-value desk, no automated calls", executor: "High-value desk", delayHours: 8, contactRule: "No automated calls" },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "D3", name: "Term late revival needs health declaration", stage: "Lapse and revival", level: "insurer", priority: 12, source: INSURER,
    when: { product: ["Term"], stage: ["Late lapse"] },
    then: { workflowId: "L2", action: "Revival offer with good-health declaration", executor: "Call-centre vendor (fixed payout) + Underwriting", delayHours: 24 },
    effectiveFrom: EFF, needsApprovalFrom: "Underwriting",
  },

  // Desible-proposed rules.
  {
    id: "R01", name: "Renewal window: pre-due WhatsApp reminders", stage: "Renewal window", level: "rule", priority: 50, source: PROPOSED,
    when: { stage: ["Renewal window"] },
    then: { workflowId: "R1", action: "WhatsApp reminder with payment link", executor: "WhatsApp vendor", delayHours: 3, script: "Pre-due reminder" },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R02", name: "Grace: telecall on due-date collection", stage: "Renewal window", level: "rule", priority: 40, source: PROPOSED,
    when: { state: ["Grace"] },
    then: { workflowId: "R2", action: "Collection call", executor: "Call-centre vendor (fixed payout)", delayHours: 2, script: "Due-date collection" },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R03", name: "Grace, high-risk cohort: voice bot first", stage: "Renewal window", level: "rule", priority: 20, source: PROPOSED,
    when: { state: ["Grace"], cohort: ["A4", "A5", "High", "Band 4", "Band 5"] },
    then: { workflowId: "R2", action: "Voice bot call, then telecall if no answer", executor: "Voice bot vendor", delayHours: 1, script: "Due-date collection (short)" },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R04", name: "Grace, cash or cheque payer: field visit", stage: "Renewal window", level: "rule", priority: 20, source: PROPOSED,
    when: { state: ["Grace"], paymentMethod: ["Cash/cheque"] },
    then: { workflowId: "R5", action: "Schedule field visit", executor: "Sales officer", delayHours: 24 },
    effectiveFrom: EFF, needsApprovalFrom: "Regional lead",
  },
  {
    id: "R05", name: "Promise hold", version: 2, description: "Promise to pay open: hold collection touches until the day after the promised date.", stage: "Renewal window", level: "rule", priority: 30, source: PROPOSED,
    when: { state: ["Promised"] },
    then: { workflowId: "R3", action: "Hold collection touches until the day after the promised date", executor: "Message agent", delayHours: 20 },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R06", name: "Mandate bounce: re-present and call", stage: "Renewal window", level: "rule", priority: 15, source: PROPOSED,
    when: { state: ["Grace"], paymentMethod: ["NACH/ECS mandate", "UPI autopay"], reasonCode: ["Mandate bounce", "Mandate failed"] },
    then: { workflowId: "R4", action: "Re-present mandate and voice-bot call", executor: "Voice bot vendor", delayHours: 4 },
    effectiveFrom: EFF, needsApprovalFrom: "Ops / remittance",
  },
  {
    id: "R07", name: "Warming: nine-station content", stage: "Warming", level: "rule", priority: 60, source: PROPOSED,
    when: { stage: ["Warming"] },
    then: { workflowId: "W1", action: "Station message", executor: "WhatsApp vendor", delayHours: 24 },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R08", name: "ULIP year 1: first-year protect", stage: "Warming", level: "rule", priority: 35, source: PROPOSED,
    when: { stage: ["Warming"], product: ["ULIP"], policyYear: ["1"] },
    then: { workflowId: "W2", action: "Fund value and lock-in explainer call", executor: "Renewal voice agent", delayHours: 24, script: "ULIP first-year protect" },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R09", name: "Bank balance check", stage: "Renewal window", level: "rule", priority: 22, source: PROPOSED, status: "In review", version: 1,
    description: "Bank partner channel with auto-debit: balance check 5 days before the debit.",
    when: { channel: ["Bancassurance"], paymentMethod: ["NACH/ECS mandate", "UPI autopay"] },
    conds: [[{ dim: "calendar", op: "within N days of", values: ["due date"], n: 5 }]],
    then: { workflowId: "R6", action: "Send account balance request", executor: "Message agent", delayHours: 2 },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R10", name: "Sourcing: PIVC and welcome call", stage: "Sourcing", level: "rule", priority: 50, source: PROPOSED, status: "Retired", version: 2,
    when: { stage: ["Sourcing"] },
    then: { workflowId: "S2", action: "Welcome and PIVC call", executor: "Welcome and verification", delayHours: 6 },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R11", name: "Term no calls", description: "Product Term: no automated calls, reminder message only.", stage: "Renewal window", level: "rule", priority: 45, source: PROPOSED,
    when: { stage: ["Renewal window"], product: ["Term"] },
    then: { workflowId: "R1", action: "Reminder message only, no automated calls", executor: "Message agent", delayHours: 6, contactRule: "No automated calls" },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R12", name: "Early lapse: voice and WhatsApp recovery", stage: "Lapse and revival", level: "rule", priority: 50, source: PROPOSED,
    when: { stage: ["Early lapse"] },
    then: { workflowId: "L1", action: "Revival link, premium plus late fee", executor: "Message agent", delayHours: 6, offer: "Late fee waiver up to ₹500 with approval" },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R13", name: "Early lapse, high-risk cohort: telecall", stage: "Lapse and revival", level: "rule", priority: 30, source: PROPOSED, status: "Retired", version: 3,
    when: { stage: ["Early lapse"], cohort: ["A4", "A5", "High", "Band 4", "Band 5"] },
    then: { workflowId: "L1", action: "Recovery telecall", executor: "Call-centre vendor (variable payout)", delayHours: 4 },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R14", name: "Late lapse: revival with health declaration", stage: "Lapse and revival", level: "rule", priority: 50, source: PROPOSED,
    when: { stage: ["Late lapse"] },
    then: { workflowId: "L2", action: "Revival offer, good-health declaration or medicals", executor: "Call-centre vendor (fixed payout)", delayHours: 24 },
    effectiveFrom: EFF, needsApprovalFrom: "Underwriting",
  },
  {
    id: "R15", name: "Early risk call", stage: "Renewal window", level: "rule", priority: 24, source: PROPOSED, status: "In review", version: 1,
    description: "Low cohort, 90 days to due: an early call from the renewal voice agent.",
    when: { cohort: ["A5"] },
    conds: [[{ dim: "calendar", op: "within N days of", values: ["due date"], n: 90 }]],
    then: { workflowId: "R1", action: "Early renewal call", executor: "Renewal voice agent", delayHours: 6 },
    effectiveFrom: EFF, needsApprovalFrom: "Head of Persistency",
  },
  {
    id: "R16", name: "Month-end push", version: 1, description: "Day of month 25 or later with the plan behind: an extra call for grace policies.", stage: "Renewal window", level: "rule", priority: 25, source: PROPOSED,
    when: { calendar: ["Month-end (last 5 days)"], state: ["Grace"], cohort: ["A3", "Medium", "Band 3"] },
    then: { workflowId: "R2", action: "Extra month-end call", executor: "Call-centre vendor (fixed payout)", delayHours: 2, target: "Close before month-end" },
    effectiveFrom: EFF, needsApprovalFrom: "Regional lead",
  },
];
