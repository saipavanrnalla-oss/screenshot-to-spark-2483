import { BASE_POLICIES } from "../index";
import { NOW, DAY_MS } from "../dates";
import { Rng } from "../rng";
import type { Policy } from "../types";
import { AGENTS } from "../agents";
import { AGENT_META } from "./agents";
import type { Disposition } from "./common";

export type TaskResult = "Completed" | "Handed off" | "No answer" | "Failed";
export type MsgStatus = "Sent" | "Delivered" | "Read" | "Clicked";

export interface ConductResult {
  check: string;
  pass: boolean;
}

export interface AgentTask {
  id: string;
  agentId: string;
  agentVersion: number;
  policyId: string;
  at: string;
  trigger: string;
  workflow: string;
  step: string;
  result: TaskResult;
  disposition?: Disposition | undefined;
  msgStatus?: MsgStatus | undefined;
  reason?: string | undefined;
  confidence?: number | undefined;
  handoffTo?: string | undefined;
  durationSec: number;
  language: string;
  transcriptId?: string | undefined;
  threadId?: string | undefined;
  conduct: ConductResult[];
  ruleId: string;
  cost: number;
  test?: boolean | undefined;
}

export interface Turn {
  speaker: "Agent" | "Customer";
  text: string;
  tag?: string | undefined;
}

export interface Transcript {
  id: string;
  language: string;
  disposition: Disposition;
  turns: Turn[];
}

const T = (speaker: "Agent" | "Customer", text: string, tag?: string): Turn => ({ speaker, text, tag });

/** Twelve call transcripts, matched to calls by disposition and language. */
export const TRANSCRIPTS: Transcript[] = [
  { id: "TR01", language: "English", disposition: "Will pay (link requested)", turns: [T("Agent", "Hello, I am calling from Sample Life Insurance. Am I speaking with the policyholder? This call is recorded."), T("Customer", "Yes, speaking."), T("Agent", "Your premium of the amount on your policy is due on the 15th. Paying keeps your cover active."), T("Customer", "I forgot about it. Can you send me a link?", "Reason: forgot"), T("Agent", "I will send the payment link on WhatsApp now."), T("Customer", "Okay, I will pay tonight.", "Disposition: will pay (link requested)"), T("Agent", "Thank you for your time.")] },
  { id: "TR02", language: "Hindi", disposition: "Promise to pay with date", turns: [T("Agent", "Namaste, main Sample Life Insurance se baat kar rahi hoon. Kya meri baat policyholder se ho rahi hai?"), T("Customer", "Haan, boliye."), T("Agent", "Aapka premium is mahine due hai. Kya aap bata sakte hain kab tak bhar payenge?"), T("Customer", "Salary 1 tareekh ko aayegi, tab bhar dunga.", "Reason: waiting for salary"), T("Agent", "Theek hai, main 1 November likh leti hoon."), T("Customer", "Haan, 1 November.", "Disposition: promise to pay with date (stated: 1 Nov)"), T("Agent", "Dhanyavaad. Aapka din shubh ho.")] },
  { id: "TR03", language: "Hindi", disposition: "Short of cash", turns: [T("Agent", "Namaste, Sample Life Insurance se. Yeh call record ki ja rahi hai."), T("Customer", "Ji."), T("Agent", "Aapka premium due hai. Kya aap bhar payenge?"), T("Customer", "Is saal paise ki dikkat hai, nahi bhar paunga.", "Reason: short of cash"), T("Agent", "Main samajhti hoon. Monthly mode mein badalne se kisht chhoti ho jaati hai."), T("Customer", "Sochta hoon.", "Disposition: short of cash"), T("Agent", "Main details WhatsApp par bhej deti hoon. Dhanyavaad.")] },
  { id: "TR04", language: "English", disposition: "Wants to surrender", turns: [T("Agent", "Hello, I am calling from Sample Life Insurance. This call is recorded."), T("Customer", "Yes."), T("Agent", "Your premium is due next week."), T("Customer", "I want to close this policy and take the money.", "Reason: wants the money"), T("Agent", "I will pass your request to our retention team. They will call you with your options."), T("Customer", "Fine.", "Disposition: wants to surrender"), T("Agent", "Thank you. No further reminders will be sent for this premium until they speak with you.")] },
  { id: "TR05", language: "Hindi", disposition: "Complaint or mis-selling", turns: [T("Agent", "Namaste, Sample Life Insurance se. Kya meri baat policyholder se ho rahi hai?"), T("Customer", "Haan. Mujhe yeh policy galat batakar bechi gayi thi.", "Reason: mis-selling"), T("Agent", "Main aapki shikayat darj kar rahi hoon. Ab aapko collection ke liye call nahi aayega."), T("Customer", "Theek hai.", "Disposition: complaint or mis-selling"), T("Agent", "Grievance team aapse sampark karegi. Dhanyavaad."), T("Customer", "Ji.")] },
  { id: "TR06", language: "Tamil", disposition: "Asked for a person", turns: [T("Agent", "Vanakkam, Sample Life Insurance-ilirundhu pesugiren. Indha call record seiyappadugiradhu."), T("Customer", "Sollunga."), T("Agent", "Ungal premium indha maadham due aagiradhu."), T("Customer", "Oru manidharidam pesa vendum.", "Disposition: asked for a person"), T("Agent", "Ungalai oru advisor-idam maatrugiren."), T("Customer", "Sari."), T("Agent", "Nandri.")] },
  { id: "TR07", language: "English", disposition: "Already paid", turns: [T("Agent", "Hello, I am calling from Sample Life Insurance. This call is recorded."), T("Customer", "I paid it yesterday at the branch.", "Disposition: already paid"), T("Agent", "Thank you. Branch payments reach us a day later. I have noted it and you will not be called again for this premium."), T("Customer", "Good."), T("Agent", "Thank you for your time."), T("Customer", "Bye.")] },
  { id: "TR08", language: "Hindi", disposition: "Callback requested", turns: [T("Agent", "Namaste, Sample Life Insurance se."), T("Customer", "Abhi meeting mein hoon, shaam ko call kijiye.", "Disposition: callback requested"), T("Agent", "Zaroor. Shaam 6 baje theek rahega?"), T("Customer", "Haan."), T("Agent", "Dhanyavaad."), T("Customer", "Ji.")] },
  { id: "TR09", language: "English", disposition: "Unhappy with the policy", turns: [T("Agent", "Hello, I am calling from Sample Life Insurance. Am I speaking with the policyholder?"), T("Customer", "Yes. The returns on this are poor.", "Reason: unhappy with returns"), T("Agent", "I understand. A colleague can go over the fund options with you."), T("Customer", "Okay, have someone call.", "Disposition: unhappy with the policy"), T("Agent", "I will arrange that. Thank you."), T("Customer", "Thanks.")] },
  { id: "TR10", language: "Tamil", disposition: "Mandate problem", turns: [T("Agent", "Vanakkam, Sample Life Insurance-ilirundhu."), T("Customer", "Bank-la auto debit fail aachu.", "Reason: mandate failed"), T("Agent", "Ungal mandate-ai sari seiya operations team-ukku anuppugiren."), T("Customer", "Sari.", "Disposition: mandate problem"), T("Agent", "Payment link-um WhatsApp-il anuppugiren."), T("Customer", "Nandri."), T("Agent", "Nandri.")] },
  { id: "TR11", language: "English", disposition: "Wrong person", turns: [T("Agent", "Hello, I am calling from Sample Life Insurance. Am I speaking with the policyholder?"), T("Customer", "No, this is not their number anymore.", "Disposition: wrong person"), T("Agent", "Sorry to disturb you. I will update our records."), T("Customer", "Okay."), T("Agent", "Thank you."), T("Customer", "Bye.")] },
  { id: "TR12", language: "Hindi", disposition: "Will pay (link requested)", turns: [T("Agent", "Namaste, Sample Life Insurance se. Yeh call record ki ja rahi hai."), T("Customer", "Ji, boliye."), T("Agent", "Aapka premium due hai. Payment link bhej doon?"), T("Customer", "Haan, bhej dijiye.", "Disposition: will pay (link requested)"), T("Agent", "Link WhatsApp par bhej diya hai."), T("Customer", "Dhanyavaad."), T("Agent", "Aapka din shubh ho.")] },
];

export interface Thread {
  id: string;
  language: string;
  messages: { from: "Agent" | "Customer"; text: string; status?: MsgStatus | undefined }[];
}

const THREAD_SEEDS: [string, string, string | null][] = [
  ["English", "Your premium for policy {policy} is due on {due}. Pay here: link", "Paid, thanks"],
  ["English", "Your policy {policy} is in its grace period. Pay here: link", null],
  ["Hindi", "Aapki policy {policy} ka premium {due} ko due hai. Yahan bharein: link", "Kal bhar dunga"],
  ["Hindi", "Aapki policy grace period mein hai. Yahan bharein: link", "Call karo"],
  ["Tamil", "Ungal policy {policy} premium {due} anru due. Ingu selutthavum: link", "Sari"],
  ["English", "Set up e-NACH for policy {policy} in two minutes: link", "Done"],
  ["English", "Reminder: premium for policy {policy} due on {due}.", "Stop messaging me"],
  ["Hindi", "e-NACH set karein, premium kabhi miss nahi hoga: link", null],
  ["English", "Thank you for your payment for policy {policy}.", null],
  ["Tamil", "Ungal auto debit fail aanadhu. Payment link: link", "Bank-la paarkiren"],
];

export const THREADS: Thread[] = Array.from({ length: 20 }, (_, i) => {
  const [language, text, reply] = THREAD_SEEDS[i % THREAD_SEEDS.length]!;
  const status: MsgStatus = reply ? "Read" : i % 3 === 0 ? "Clicked" : "Delivered";
  return {
    id: `TH${String(i + 1).padStart(2, "0")}`,
    language,
    messages: [{ from: "Agent", text, status }, ...(reply ? [{ from: "Customer" as const, text: reply }] : [])],
  };
});

const WORKFLOW_RULE: Record<string, string> = { R1: "R01", R2: "R02", R3: "R05", R4: "R06", L1: "R12", W1: "R07", R6: "D1", R7: "D2" };

const VOICE_DISP: [Disposition, number][] = [
  ["Not reachable", 30], ["Will pay (link requested)", 18], ["Promise to pay with date", 14], ["Callback requested", 10], ["Short of cash", 7],
  ["Already paid", 5], ["Asked for a person", 4], ["Wants to surrender", 3], ["Complaint or mis-selling", 2], ["Unhappy with the policy", 3], ["Wrong person", 2], ["Mandate problem", 2],
];
const MSG_DISP: [Disposition | null, number][] = [[null, 50], ["Will pay (link requested)", 20], ["Not reachable", 12], ["Promise to pay with date", 8], ["Already paid", 6], ["Callback requested", 4]];
const HANDOFF: Partial<Record<Disposition, string>> = {
  "Will pay (link requested)": "Payment assist agent",
  "Asked for a person": "Telecaller",
  "Wants to surrender": "Surrender retention",
  "Complaint or mis-selling": "Hold",
  "Mandate problem": "Remittance and operations",
  "Unhappy with the policy": "Telecaller",
};
const REASONS = ["Forgot", "Short of cash", "Waiting for salary", "Unhappy with returns", "Mandate failed", "Wants the money", "Travelling", "Mis-selling"];
const CHECKS = ["Identity and consent line said", "Calling window kept", "No promise outside allowed offers", "Stop-calling honoured", "Script followed"];

function pool(): Policy[] {
  return BASE_POLICIES.filter(
    (p) => p.lifecycleStage === "Renewal window" || p.lifecycleStage === "Early lapse" || (p.warmingStation !== undefined && p.warmingStation >= 5),
  );
}

function workflowFor(p: Policy, agentId: string): [string, string, string] {
  if (agentId === "payment-assist") return p.reasonCode === "Mandate bounce" || p.reasonCode === "Mandate failed" ? ["R4", "Payment link after bounce", "Bounce in file"] : ["R2", "Send payment link", "Disposition: will pay"];
  if (p.lifecycleStage === "Early lapse") return ["L1", agentId === "renewal-voice" ? "Recovery call" : "Revival link", "Lapsed 180 days or less"];
  if (p.lifecycleStage === "Warming") return ["W1", "Station message", "Station date reached"];
  if (p.state === "Grace") return ["R2", agentId === "renewal-voice" ? "Collection call" : "Grace reminder", "Due date passed, unpaid"];
  if (p.state === "Promised") return ["R3", "Promise reminder", "Promise date tomorrow"];
  return ["R1", agentId === "renewal-voice" ? "Pre-due call" : "Pre-due reminder", "Due list at T minus 15"];
}

function generate(): AgentTask[] {
  const rng = new Rng(40_400);
  const book = pool();
  const counts: [string, number][] = [["message", 1600], ["renewal-voice", 900], ["reason-classifier", 700], ["payment-assist", 350], ["handoff-summariser", 200], ["quality", 250]];
  const out: AgentTask[] = [];
  let seq = 1;
  for (const [agentId, n] of counts) {
    const version = AGENTS.find((a) => a.id === agentId)?.version ?? 1;
    const meta = AGENT_META[agentId]!;
    for (let i = 0; i < n; i++) {
      const p = rng.pick(book);
      const dayBack = Math.floor(rng.next() * 30);
      const minute = 3 * 60 + 30 + Math.floor(rng.next() * 600);
      const at = new Date(NOW.getTime() - dayBack * DAY_MS - 5 * 3_600_000 + minute * 60_000);
      if (at >= NOW) at.setTime(NOW.getTime() - (i + 1) * 60_000);
      const [workflow, step, trigger] = workflowFor(p, agentId);
      const t: AgentTask = {
        id: `T-${String(seq++).padStart(5, "0")}`,
        agentId,
        agentVersion: dayBack > 20 && version > 1 ? version - 1 : version,
        policyId: p.policyId,
        at: at.toISOString(),
        trigger,
        workflow,
        step,
        result: "Completed",
        durationSec: 0,
        language: p.language,
        conduct: [],
        ruleId: WORKFLOW_RULE[workflow] ?? "R01",
        cost: meta.costPerTask,
      };
      if (agentId === "renewal-voice") {
        const d = rng.weighted(VOICE_DISP);
        t.disposition = d;
        t.durationSec = d === "Not reachable" ? 0 : rng.int(60, 420);
        t.result = d === "Not reachable" ? "No answer" : HANDOFF[d] ? "Handed off" : rng.chance(0.02) ? "Failed" : "Completed";
        t.handoffTo = HANDOFF[d];
        if (d !== "Not reachable") {
          const matches = TRANSCRIPTS.filter((x) => x.disposition === d);
          const pickT = matches.find((x) => x.language === p.language) ?? matches[0];
          t.transcriptId = pickT?.id;
          t.reason = rng.pick(REASONS);
        }
        t.conduct = CHECKS.map((c) => ({ check: c, pass: !(c === "Calling window kept" && rng.chance(0.015)) && !(c === "Script followed" && rng.chance(0.03)) }));
      } else if (agentId === "message") {
        const d = rng.weighted(MSG_DISP);
        t.msgStatus = d === "Not reachable" ? "Sent" : d === "Will pay (link requested)" ? "Clicked" : d ? "Read" : rng.weighted<MsgStatus>([["Delivered", 40], ["Read", 45], ["Clicked", 15]]);
        if (d) t.disposition = d;
        t.result = d === "Not reachable" ? "No answer" : d === "Will pay (link requested)" ? "Handed off" : "Completed";
        if (t.result === "Handed off") t.handoffTo = "Payment assist agent";
        if (!d && t.msgStatus === "Delivered" && rng.chance(0.15)) {
          t.result = "Handed off";
          t.handoffTo = "Renewal voice agent";
        }
        t.threadId = THREADS[rng.int(0, THREADS.length - 1)]!.id;
        t.conduct = CHECKS.filter((c) => c !== "Identity and consent line said").map((c) => ({ check: c, pass: true }));
      } else if (agentId === "reason-classifier") {
        t.reason = rng.pick(REASONS);
        t.confidence = +(0.55 + rng.next() * 0.43).toFixed(2);
        if (t.confidence < 0.62 && rng.chance(0.4)) {
          t.result = "Handed off";
          t.handoffTo = "Team lead";
        }
        t.durationSec = 1;
      } else if (agentId === "payment-assist") {
        const fail = workflow === "R4" && rng.chance(0.25);
        t.result = fail ? "Handed off" : "Completed";
        if (fail) t.handoffTo = "Remittance and operations";
        t.disposition = fail ? "Mandate problem" : "Will pay (link requested)";
        t.durationSec = 2;
      } else if (agentId === "handoff-summariser") {
        t.durationSec = 3;
        t.step = "Write handoff packet";
      } else {
        t.durationSec = 2;
        t.step = "Conduct checks on a call";
        t.conduct = CHECKS.map((c) => ({ check: c, pass: !(c === "Calling window kept" && rng.chance(0.04)) }));
        if (t.conduct.some((c) => !c.pass)) t.result = "Handed off";
        if (t.result === "Handed off") t.handoffTo = "Team lead";
      }
      out.push(t);
    }
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const TASKS: AgentTask[] = generate();

export const TASKS_BY_POLICY: Map<string, AgentTask[]> = (() => {
  const m = new Map<string, AgentTask[]>();
  for (const t of TASKS) {
    const list = m.get(t.policyId);
    if (list) list.push(t);
    else m.set(t.policyId, [t]);
  }
  return m;
})();

export function agentName(id: string): string {
  return AGENTS.find((a) => a.id === id)?.name ?? id;
}

/* ---------- Handoffs ---------- */

export interface Handoff {
  id: string;
  at: string;
  policyId: string;
  from: string;
  to: string;
  trigger: string;
  status: "Open" | "In progress" | "Closed";
  taskId: string;
}

export const HANDOFFS: Handoff[] = (() => {
  const candidates = TASKS.filter((t) => t.result === "Handed off" && t.handoffTo);
  const byDest = new Map<string, AgentTask[]>();
  for (const t of candidates) {
    const k = t.handoffTo!;
    byDest.set(k, [...(byDest.get(k) ?? []), t]);
  }
  // Take an even spread across destinations, newest first, 60 in all.
  const out: AgentTask[] = [];
  let round = 0;
  while (out.length < 60 && round < 60) {
    for (const list of byDest.values()) if (list[round] && out.length < 60) out.push(list[round]!);
    round++;
  }
  return out
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .map((t, i) => ({
      id: `H-${String(i + 1).padStart(3, "0")}`,
      at: t.at,
      policyId: t.policyId,
      from: agentName(t.agentId),
      to: t.handoffTo!,
      trigger: t.disposition ? `Disposition: ${t.disposition.toLowerCase()}` : t.confidence !== undefined ? "Two low-confidence results" : t.agentId === "message" ? "Message unread by the set time" : "Conduct check failed",
      status: i < 18 ? "Open" : i < 30 ? "In progress" : "Closed",
      taskId: t.id,
    }));
})();

export interface HandoffRule {
  id: string;
  from: string;
  to: string;
  trigger: string;
}

export const DEFAULT_HANDOFF_RULES: HandoffRule[] = [
  { id: "HR1", from: "Message agent", to: "Renewal voice agent", trigger: "Message unread by the set time before the due date" },
  { id: "HR2", from: "Renewal voice agent", to: "Payment assist agent", trigger: "Disposition: will pay, link requested" },
  { id: "HR3", from: "Renewal voice agent", to: "Telecaller", trigger: "Disposition: asked for a person" },
  { id: "HR4", from: "Renewal voice agent", to: "Surrender retention", trigger: "Disposition: wants to surrender" },
  { id: "HR5", from: "Renewal voice agent", to: "High-value desk", trigger: "Ticket size above the high-value limit" },
  { id: "HR6", from: "Any agent", to: "Hold", trigger: "Complaint, bereavement, legal threat or do-not-contact" },
  { id: "HR7", from: "Payment assist agent", to: "Remittance and operations", trigger: "Mandate fails or is rejected" },
  { id: "HR8", from: "Any agent", to: "Team lead", trigger: "Two low-confidence results or two failed tasks" },
];

/* ---------- Task queue ---------- */

export type QueueStatus = "In flight" | "Due soon" | "Overdue" | "Retried";

export interface QueueTask {
  id: string;
  task: string;
  policyId: string;
  workflow: string;
  step: string;
  executor: string;
  deadline: string;
  retries: number;
  maxRetries: number;
  status: QueueStatus;
}

export const QUEUE: QueueTask[] = (() => {
  const rng = new Rng(9090);
  const book = pool();
  const execs: [string, string, string][] = [
    ["Renewal voice agent", "R2", "Collection call"],
    ["Message agent", "R1", "Pre-due reminder"],
    ["Payment assist agent", "R2", "Send payment link"],
    ["Call-centre vendor (fixed payout)", "R2", "Collection call"],
    ["Telecaller", "R2", "Call back the customer"],
    ["Sales officer", "R5", "Collect cheque"],
    ["Remittance and operations", "R4", "Fix mandate"],
    ["High-value desk", "R7", "Personal call"],
  ];
  return Array.from({ length: 96 }, (_, i) => {
    const p = rng.pick(book);
    const [executor, workflow, step] = rng.pick(execs);
    const status: QueueStatus = i % 7 === 0 ? "Overdue" : i % 5 === 0 ? "Retried" : i % 3 === 0 ? "Due soon" : "In flight";
    const hours = status === "Overdue" ? -rng.int(1, 30) : status === "Due soon" ? rng.int(1, 4) : rng.int(5, 48);
    const retries = status === "Retried" ? rng.int(1, 2) : status === "Overdue" ? rng.int(0, 2) : 0;
    return {
      id: `Q-${String(i + 1).padStart(4, "0")}`,
      task: step,
      policyId: p.policyId,
      workflow,
      step,
      executor,
      deadline: new Date(NOW.getTime() + hours * 3_600_000).toISOString(),
      retries,
      maxRetries: 3,
      status,
    };
  });
})();

/* ---------- Agent performance ---------- */

export interface AgentStats {
  tasks: number;
  success: number;
  handoffs: number;
  aht: number;
  conduct: number;
  cost: number;
  reasons: [string, number][];
}

export function agentStats(agentId: string, days: number, tasks: AgentTask[] = TASKS): AgentStats {
  const since = NOW.getTime() - days * DAY_MS;
  const list = tasks.filter((t) => t.agentId === agentId && new Date(t.at).getTime() >= since && !t.test);
  const n = list.length || 1;
  const timed = list.filter((t) => t.durationSec > 0);
  const checks = list.flatMap((t) => t.conduct);
  const reasons = new Map<string, number>();
  for (const t of list) if (t.result === "Handed off") reasons.set(t.handoffTo ?? "Other", (reasons.get(t.handoffTo ?? "Other") ?? 0) + 1);
  return {
    tasks: list.length,
    success: list.filter((t) => t.result === "Completed" || t.result === "Handed off").length / n,
    handoffs: list.filter((t) => t.result === "Handed off").length / n,
    aht: timed.length ? timed.reduce((s, t) => s + t.durationSec, 0) / timed.length : 0,
    conduct: checks.length ? checks.filter((c) => c.pass).length / checks.length : 1,
    cost: list.reduce((s, t) => s + t.cost, 0),
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
  };
}
