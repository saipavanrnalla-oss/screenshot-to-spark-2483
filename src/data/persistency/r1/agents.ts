import { AGENTS } from "../agents";
import type { Product } from "../types";
import { DISPOSITIONS, type Disposition } from "./common";
import type { Version } from "./types";

export const ACTIVE_AGENT_IDS = ["message", "renewal-voice", "reason-classifier", "payment-assist", "handoff-summariser", "quality"] as const;
export type ActiveAgentId = (typeof ACTIVE_AGENT_IDS)[number];

export interface AgentMeta {
  inputs: string[];
  outputs: string[];
  costPerTask: number;
  channel: "WhatsApp" | "Voice" | "System";
}

export const AGENT_META: Record<string, AgentMeta> = {
  message: { inputs: ["Policy facts", "Due date and amount", "Language", "Template"], outputs: ["Delivery status", "Read and click", "Customer reply", "Disposition"], costPerTask: 1.2, channel: "WhatsApp" },
  "renewal-voice": { inputs: ["Task packet", "Script version", "Allowed offers", "Calling window"], outputs: ["Disposition", "Reason", "Stated promise date", "Transcript"], costPerTask: 7.5, channel: "Voice" },
  "reason-classifier": { inputs: ["Transcript or message text"], outputs: ["Reason tag", "Confidence"], costPerTask: 0.4, channel: "System" },
  "payment-assist": { inputs: ["Policy facts", "Payment method", "Mandate state"], outputs: ["Payment link sent", "Autopay set-up", "Payment status"], costPerTask: 2.1, channel: "WhatsApp" },
  "handoff-summariser": { inputs: ["Activity history", "Transcript", "Disposition"], outputs: ["Six-field packet"], costPerTask: 0.6, channel: "System" },
  quality: { inputs: ["Transcript or message", "Script version", "Contact policy"], outputs: ["Conduct check results", "Breach flag"], costPerTask: 0.5, channel: "System" },
  "worth-score": { inputs: ["Propensity band", "Calls and outcomes", "Links sent and paid", "Promises", "Days past due", "Reason tag", "Premium"], outputs: ["Chance to collect", "Factors", "Keep calling or hand over"], costPerTask: 0.2, channel: "System" },
  welcome: { inputs: ["New business file"], outputs: ["Verification result"], costPerTask: 0, channel: "Voice" },
  revival: { inputs: ["Lapse extract"], outputs: ["Revival interest"], costPerTask: 0, channel: "Voice" },
  retention: { inputs: ["Surrender request"], outputs: ["Retention outcome"], costPerTask: 0, channel: "Voice" },
  "relationship-brief": { inputs: ["Policy facts", "Activity"], outputs: ["Brief"], costPerTask: 0, channel: "System" },
  "mandate-recovery": { inputs: ["Mandate state", "Bounce reason"], outputs: ["New mandate link"], costPerTask: 0, channel: "WhatsApp" },
  "fatigue-guard": { inputs: ["Contact history"], outputs: ["Allow or wait"], costPerTask: 0, channel: "System" },
  "financial-stress": { inputs: ["Transcript", "Policy facts"], outputs: ["Offer for approval"], costPerTask: 0, channel: "Voice" },
  reinstatement: { inputs: ["Lapse date", "Policy facts"], outputs: ["Reinstatement route"], costPerTask: 0, channel: "System" },
  learning: { inputs: ["Treated and untreated outcomes"], outputs: ["Proposed changes"], costPerTask: 0, channel: "System" },
};

export interface ScriptDoc {
  product: Product;
  language: string;
  opening: string;
  identity: string;
  body: string;
  objections: { q: string; a: string }[];
  closing: string;
}

export interface TemplateDoc {
  id: string;
  name: string;
  language: string;
  text: string;
}

export const TOOL_KEYS = ["Look up policy facts", "Send payment link", "Record disposition", "Schedule callback", "Transfer call"] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];

export const ROUTE_OPTIONS = [
  "Payment Link Dispatcher",
  "R3 Promise-to-pay follow-up",
  "Telecaller",
  "ULIP Surrender Prevention (L3)",
  "Hold (X1)",
  "Remittance and operations",
  "Team lead",
  "Retry in the next window",
  "Close: paid",
  "Close: do not contact",
  "Verify contact details",
] as const;

export interface AgentConfig {
  instructions: string;
  scripts: ScriptDoc[];
  templates: TemplateDoc[];
  tools: Record<ToolKey, boolean>;
  offers: { name: string; needsApproval: boolean }[];
  languages: string[];
  transferLanguage: string;
  windowStart: string;
  windowEnd: string;
  attempts: { window: number; grace: number; lapse: number };
  gapDays: number;
  routes: Record<Disposition, string>;
  thresholds: { classifier: number; voice: number };
  limits: { tasks: number; retries: number; cost: number };
  conduct: string[];
}

const DEFAULT_ROUTES: Record<Disposition, string> = {
  "Will pay (link requested)": "Payment Link Dispatcher",
  "Promise to pay with date": "R3 Promise-to-pay follow-up",
  "Already paid": "Close: paid",
  "Mandate problem": "Remittance and operations",
  "Short of cash": "Retry in the next window",
  "Unhappy with the policy": "Telecaller",
  "Wants to surrender": "ULIP Surrender Prevention (L3)",
  "Complaint or mis-selling": "Hold (X1)",
  "Asked for a person": "Telecaller",
  "Wrong person": "Verify contact details",
  "Callback requested": "Retry in the next window",
  "Not reachable": "Retry in the next window",
  "Do not call": "Close: do not contact",
};

function script(product: Product, language: string, v: number): ScriptDoc {
  const hi = language === "Hindi";
  const cannotPay = v >= 4
    ? "I understand. You can change to a monthly mode, which spreads the amount. Shall I send the change request with the payment link?"
    : v === 3
      ? "I understand. A smaller monthly instalment is possible. Would you like details?"
      : "I understand. Please pay within the grace period to keep your cover.";
  return {
    product,
    language,
    opening: hi ? "Namaste, main Sample Life Insurance se baat kar rahi hoon." : "Hello, I am calling from Sample Life Insurance.",
    identity: hi ? "Kya meri baat policyholder se ho rahi hai? Yeh call record ki ja rahi hai." : "Am I speaking with the policyholder? This call is recorded.",
    body:
      product === "ULIP"
        ? "Your premium of {amount} is due on {due}. Paying keeps your fund invested and your life cover active."
        : product === "Traditional"
          ? "Your premium of {amount} is due on {due}. Paying on time keeps your bonuses and guaranteed benefits."
          : "Your premium of {amount} is due on {due}. Your family stays covered while the premium is paid.",
    objections: [
      { q: "I cannot pay this year", a: cannotPay },
      { q: "I already paid", a: "Thank you. I will note it and you will not be called again for this premium." },
      { q: "I want to surrender", a: "I will pass your request to our retention team, who will call you with your options." },
      ...(v >= 2 ? [{ q: "Call me later", a: "Of course. What time suits you inside 9 am to 7 pm?" }] : []),
    ],
    closing: hi ? "Dhanyavaad. Aapka din shubh ho." : "Thank you for your time.",
  };
}

const TEMPLATES: TemplateDoc[] = [
  { id: "pre-due", name: "Pre-due reminder", language: "English", text: "Dear {customer}, your premium of {amount} for policy {policy} is due on {due}. Pay here: {link}" },
  { id: "pre-due-hi", name: "Pre-due reminder", language: "Hindi", text: "{customer} ji, aapki policy {policy} ka premium {amount} {due} ko due hai. Yahan bharein: {link}" },
  { id: "grace", name: "Grace reminder", language: "English", text: "Dear {customer}, your policy {policy} is in its grace period until {graceEnd}. Pay {amount} here: {link}" },
  { id: "enach", name: "e-NACH set-up", language: "English", text: "Dear {customer}, set up e-NACH for policy {policy} in two minutes and never miss a premium: {link}" },
  { id: "balance", name: "Account balance request", language: "English", text: "Dear {customer}, {amount} will be debited for policy {policy} on {due}. Please keep the balance ready." },
];

function baseConfig(id: string, v: number): AgentConfig {
  const voice = id === "renewal-voice";
  return {
    instructions: voice
      ? "You call policyholders about the premium due. Be polite and brief. Speak in the customer's language. Cover the amount, the due date and how to pay. Never promise a waiver, never discuss investment returns, never call outside the calling window."
      : id === "message"
        ? "You send approved templates in the customer's language. Never send outside 8 am to 9 pm. Never send more than one reminder a day."
        : `You are the ${AGENTS.find((a) => a.id === id)?.name ?? id}. Follow the contact policy and record every result.`,
    scripts: voice || id === "message"
      ? (["ULIP", "Traditional", "Term"] as Product[]).flatMap((p) => ["Hindi", "English", "Tamil"].map((l) => script(p, l, p === "Term" ? Math.min(v, 2) : v)))
      : [],
    templates: id === "message" || id === "payment-assist" ? TEMPLATES : [],
    tools: {
      "Look up policy facts": true,
      "Send payment link": id !== "quality" && id !== "reason-classifier",
      "Record disposition": true,
      "Schedule callback": voice,
      "Transfer call": voice && v >= 3,
    },
    offers: [
      { name: "Payment link", needsApproval: false },
      { name: "Autopay set-up", needsApproval: false },
      ...(v >= 3 ? [{ name: "Mode change to monthly", needsApproval: true }] : []),
    ],
    languages: ["Hindi", "English", "Tamil", "Telugu", "Marathi"],
    transferLanguage: "English",
    windowStart: "09:00",
    windowEnd: "19:00",
    attempts: { window: voice ? 2 : 3, grace: voice ? 3 : 4, lapse: 2 },
    gapDays: voice ? 2 : 1,
    routes: { ...DEFAULT_ROUTES },
    thresholds: { classifier: v >= 3 ? 0.8 : 0.75, voice: 0.7 },
    limits: { tasks: voice ? 4 : 8, retries: 2, cost: voice ? 40 : 15 },
    conduct: ["Identity and consent line said", "Calling window kept", "No promise outside allowed offers", "Stop-calling honoured", "Script followed"],
  };
}

const AUTHORS = ["MIS and analytics", "Head of Persistency", "Compliance and quality"];
const NOTES: Record<number, string> = {
  1: "First release",
  2: "Added callback handling",
  3: "Monthly mode offer with approval",
  4: "Clearer answer to 'I cannot pay this year'",
  5: "Tamil scripts",
  6: "Shorter grace reminder",
};

/** Seeded version history for each agent: the current version is Active, earlier ones Retired. */
export function seedAgentVersions(id: string): Version<AgentConfig>[] {
  const def = AGENTS.find((a) => a.id === id);
  const n = def?.version ?? 1;
  const list: Version<AgentConfig>[] = Array.from({ length: n }, (_, i) => {
    const no = i + 1;
    const day = 27 - (n - no) * 21;
    const at = new Date(Date.UTC(2026, 9, day, 6, 30)).toISOString();
    return {
      no,
      status: no === n ? "Active" : "Retired",
      author: AUTHORS[no % AUTHORS.length]!,
      at,
      note: NOTES[no] ?? `Version ${no}`,
      approver: "Head of Persistency",
      approvedAt: at,
      data: baseConfig(id, no),
      reviewedCalls: 30,
    } satisfies Version<AgentConfig>;
  });
  if (id === "message") {
    const prev = list[list.length - 1]!.data;
    list.push({
      no: n + 1,
      status: "In review",
      author: "MIS and analytics",
      at: "2026-10-27T13:05:00.000Z",
      note: "Shorter grace reminder; Tamil template",
      data: {
        ...prev,
        templates: [
          ...prev.templates.map((t) => (t.id === "grace" ? { ...t, text: "Dear {customer}, policy {policy} is in grace until {graceEnd}. Pay {amount}: {link}" } : t)),
          { id: "pre-due-ta", name: "Pre-due reminder", language: "Tamil", text: "{customer}, ungal policy {policy} premium {amount} {due} anru due. Ingu selutthavum: {link}" },
        ],
      },
    });
  }
  return list;
}

export const NOT_ENABLED_IDS = AGENTS.filter((a) => a.status === "Not enabled").map((a) => a.id);

export { DISPOSITIONS };
