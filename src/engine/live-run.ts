/**
 * Live run of an uploaded due list: read the file, decide the stage of each policy and the step it
 * enters at, then move one step at a time on command. Every action an agent takes is recorded as an
 * event; the channel results (delivered, read, call disposition, payment) come from a channel adapter.
 * The prototype ships a simulated adapter; engineering replaces it with the voice and WhatsApp platform.
 */
import { addDays, diffDays, fromIso, NOW, toIso } from "@/data/persistency/dates";
import { hashId } from "@/data/persistency/derived";
import { PALETTE_BY_TYPE, type WfEdge, type WfGraph, type WfNode } from "@/data/persistency/r1/wf";
import { fillScript, pickScript, scriptRule, type ScriptContext, type ScriptVariant } from "@/data/persistency/r1/scripts-lib";
import { worthScore, type WorthResult } from "@/engine/worth-score";
import { isOutcome } from "@/engine/workflow";

/* ---------------- File ---------------- */

export const MODES = ["Annual", "Half-yearly", "Quarterly", "Monthly"] as const;
export type Mode = (typeof MODES)[number];
export const AUTOPAY = ["Bank auto-debit", "e-NACH", "ACH form", "None"] as const;
export type Autopay = (typeof AUTOPAY)[number];
export const LAST_YEAR = ["Before the due date", "On the due date", "In the Grace Period", "After 180 days", "Debit bounced"] as const;

export interface DueRow {
  line: number;
  policy: string;
  name: string;
  phone: string;
  language: "English" | "Hindi";
  product: "ULIP" | "Traditional" | "Term";
  plan: string;
  mode: Mode;
  premium: number;
  issueDate: string;
  dueDate: string;
  premiumsPaid: number;
  autopay: Autopay;
  /** P1 lowest propensity to pay to P10 highest; null when not scored. */
  band: number | null;
  lastYear: string;
  channel: string;
  branch: string;
  age: number | null;
  occupation: string;
}

export const FILE_COLUMNS: { key: string; label: string; required: boolean; aliases: string[]; example: string }[] = [
  { key: "policy_number", label: "Policy number", required: true, aliases: ["policy_no", "policy"], example: "SLI02409101" },
  { key: "customer_name", label: "Customer name", required: true, aliases: ["name", "policyholder"], example: "Sunil Kapoor" },
  { key: "phone", label: "Registered mobile", required: true, aliases: ["mobile", "phone_number"], example: "+919800000001" },
  { key: "due_date", label: "Due date", required: true, aliases: ["next_due_date"], example: "2027-01-14" },
  { key: "mode", label: "Payment mode", required: true, aliases: ["frequency", "payment_mode"], example: "Annual" },
  { key: "premium", label: "Modal premium (Rs)", required: true, aliases: ["modal_premium", "installment"], example: "36000" },
  { key: "premiums_paid", label: "Premiums paid", required: false, aliases: ["installments_paid"], example: "1" },
  { key: "issue_date", label: "Issue date", required: false, aliases: ["effective_date", "risk_commencement"], example: "2026-01-14" },
  { key: "product", label: "Product type", required: false, aliases: ["plan_type"], example: "Traditional" },
  { key: "plan", label: "Plan name", required: false, aliases: ["product_name"], example: "Assured Savings Plan" },
  { key: "propensity_band", label: "Propensity band (P1 to P10)", required: false, aliases: ["band", "score"], example: "P2" },
  { key: "autopay", label: "Autopay", required: false, aliases: ["mandate", "mandate_type"], example: "None" },
  { key: "last_year_payment", label: "Last year's payment", required: false, aliases: ["payment_history"], example: "" },
  { key: "language", label: "Language", required: false, aliases: [], example: "Hindi" },
  { key: "channel", label: "Channel", required: false, aliases: ["source"], example: "Bancassurance" },
  { key: "branch", label: "Branch", required: false, aliases: [], example: "Lucknow Main" },
  { key: "age", label: "Age", required: false, aliases: [], example: "44" },
  { key: "occupation", label: "Occupation", required: false, aliases: [], example: "Salaried" },
];

const HEADER = "policy_number,customer_name,phone,due_date,mode,premium,premiums_paid,issue_date,product,plan,propensity_band,autopay,last_year_payment,language,channel,branch,age,occupation";

/** The four booth scenarios. Each row plays a set story when the operator leaves the answer to the customer. */
export const SAMPLE_FILE = [
  HEADER,
  "SLI02409101,Sunil Kapoor,+919800000001,2027-01-16,Annual,36000,1,2026-01-16,Traditional,Assured Savings Plan,P2,None,,Hindi,Bancassurance,Lucknow Main,44,Self-employed",
  "SLI02409102,Meera Iyer,+919800000002,2026-11-11,Annual,48000,1,2025-11-11,ULIP,Wealth Builder,P8,None,,English,Agency,Chennai Central,38,Salaried",
  "SLI02409103,Farhan Ali,+919800000003,2026-11-10,Annual,30000,1,2025-11-10,Traditional,Assured Savings Plan,P4,None,,English,Bancassurance,Pune Camp,35,Salaried",
  "SLI02409104,Kiran Rao,+919800000004,2026-10-24,Annual,24000,1,2025-10-24,Traditional,Family Income Plan,P1,None,,Hindi,Agency,Nagpur East,41,Self-employed",
].join("\n");

/** The booth scenarios plus an auto-debit 25th-month policy and an HNI policy. */
export const BOOTH_FILE = [
  SAMPLE_FILE,
  "SLI02409105,Ramesh Yadav,+919800000005,2026-11-08,Quarterly,9000,8,2024-11-08,Traditional,Family Income Plan,,Bank auto-debit,In the Grace Period,Hindi,Bancassurance,Patna North,61,Farmer",
  "SLI02409106,Kavita Shah,+919800000006,2026-10-20,Annual,260000,1,2025-10-20,ULIP,Wealth Builder,P4,None,,English,Agency,Mumbai Central,52,Business owner",
].join("\n");

/** What the customer does at a step: a call answer, or what happens after a message. */
export type StoryBeat = Exclude<Reply, "As the customer would"> | "No reply" | "Pays on the link" | "Agrees with the vendor" | "Declines the vendor";

export interface Story {
  code: string;
  title: string;
  shows: string;
  /** Keyed by step id, or step id and visit ("rehit#2"). */
  beats: Record<string, StoryBeat>;
}

export const BOOTH_STORIES: Record<string, Story> = {
  SLI02409101: {
    code: "A", title: "Call first, then the link on WhatsApp", shows: "Voice call, disposition read from the call, next step on WhatsApp, paid",
    beats: { early: "Will pay", elink: "Pays on the link" },
  },
  SLI02409102: {
    code: "B", title: "WhatsApp first, nudged again on WhatsApp", shows: "Higher band gets messages, no call. No payment in 2 days, so a second WhatsApp goes on the same channel",
    beats: { link15: "No reply", link15b: "Pays on the link" },
  },
  SLI02409103: {
    code: "C", title: "No reply on WhatsApp, so a call", shows: "Two WhatsApp messages unpaid, the channel switches to a call, the customer asks for an explanation, then pays on the link",
    beats: { link15: "No reply", link15b: "No reply", call15: "Wants an explanation", ptp2: "Pays on the link" },
  },
  SLI02409104: {
    code: "D", title: "When to stop calling", shows: "Two refusals in the Grace Period. The Worth Pursuing Model drops below 25% and hands the case to the variable-payout vendor",
    beats: { "rehit#1": "Refused", "rehit#2": "Refused", vres: "Agrees with the vendor" },
  },
};

export interface FileProblem {
  line: number;
  message: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseBand(v: string): number | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^p?\s*(\d{1,2})$/);
  if (m) {
    const n = Number(m[1]);
    return n >= 1 && n <= 10 ? n : null;
  }
  if (s.startsWith("lowest")) return 1;
  if (s.startsWith("low")) return 4;
  if (s.startsWith("moderate")) return 6;
  if (s.startsWith("highest")) return 10;
  if (s.startsWith("high")) return 8;
  return null;
}

function parseMode(v: string): Mode | null {
  const s = v.trim().toLowerCase();
  if (s.startsWith("ann") || s === "yearly" || s === "y") return "Annual";
  if (s.startsWith("half") || s === "hy") return "Half-yearly";
  if (s.startsWith("quar") || s === "q") return "Quarterly";
  if (s.startsWith("mon") || s === "m") return "Monthly";
  return null;
}

function parseAutopay(v: string): Autopay {
  const s = v.trim().toLowerCase();
  if (!s || s === "none" || s === "no" || s === "cash" || s === "cheque") return "None";
  if (s.includes("enach") || s.includes("e-nach")) return "e-NACH";
  if (s.includes("ach") || s.includes("ecs")) return "ACH form";
  return "Bank auto-debit";
}

export const PER_YEAR: Record<Mode, number> = { Annual: 1, "Half-yearly": 2, Quarterly: 4, Monthly: 12 };

export function parseDueFile(text: string): { rows: DueRow[]; problems: FileProblem[]; missing: string[]; columns: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], problems: [], missing: FILE_COLUMNS.filter((c) => c.required).map((c) => c.label), columns: [] };
  const head = splitCsv(lines[0]!).map(norm);
  const idx = (key: string) => {
    const c = FILE_COLUMNS.find((f) => f.key === key)!;
    return [c.key, ...c.aliases].map(norm).map((k) => head.indexOf(k)).find((i) => i >= 0) ?? -1;
  };
  const missing = FILE_COLUMNS.filter((c) => c.required && idx(c.key) < 0).map((c) => c.label);
  const problems: FileProblem[] = [];
  const rows: DueRow[] = [];
  if (missing.length) return { rows, problems, missing, columns: head };
  const seen = new Set<string>();
  lines.slice(1).forEach((l, i) => {
    const line = i + 2;
    const cells = splitCsv(l);
    const get = (k: string) => {
      const j = idx(k);
      return j >= 0 ? (cells[j] ?? "").trim() : "";
    };
    const policy = get("policy_number");
    const mode = parseMode(get("mode"));
    const due = get("due_date");
    const premium = Number(get("premium").replace(/[^\d.]/g, ""));
    if (!policy) return problems.push({ line, message: "No policy number" });
    if (seen.has(policy)) return problems.push({ line, message: `${policy} appears twice; the first row is kept` });
    if (!mode) return problems.push({ line, message: `${policy}: payment mode "${get("mode")}" is not Annual, Half-yearly, Quarterly or Monthly` });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return problems.push({ line, message: `${policy}: due date must be YYYY-MM-DD` });
    if (!premium) return problems.push({ line, message: `${policy}: premium is missing` });
    const phone = get("phone");
    if (!/^\+?\d{10,13}$/.test(phone.replace(/[\s-]/g, ""))) return problems.push({ line, message: `${policy}: mobile number "${phone}" is not valid` });
    seen.add(policy);
    const issue = get("issue_date");
    let paid = Number(get("premiums_paid"));
    if (!get("premiums_paid") && /^\d{4}-\d{2}-\d{2}$/.test(issue)) {
      const months = Math.max(0, Math.round(diffDays(fromIso(due), fromIso(issue)) / 30.44));
      paid = Math.round(months / (12 / PER_YEAR[mode]));
    }
    const productRaw = get("product").toLowerCase();
    const product: DueRow["product"] = productRaw.includes("ulip") || productRaw.includes("unit") ? "ULIP" : productRaw.includes("term") ? "Term" : "Traditional";
    const ageN = Number(get("age"));
    rows.push({
      line,
      policy,
      name: get("customer_name") || "Customer",
      phone,
      language: get("language").toLowerCase().startsWith("hi") ? "Hindi" : "English",
      product,
      plan: get("plan") || (product === "ULIP" ? "Wealth Builder" : product === "Term" ? "Term Protect" : "Assured Savings Plan"),
      mode,
      premium,
      issueDate: issue,
      dueDate: due,
      premiumsPaid: Number.isFinite(paid) ? paid : 0,
      autopay: parseAutopay(get("autopay")),
      band: parseBand(get("propensity_band")),
      lastYear: get("last_year_payment"),
      channel: get("channel") || "Bancassurance",
      branch: get("branch") || "Not given",
      age: Number.isFinite(ageN) && ageN > 0 ? ageN : null,
      occupation: get("occupation"),
    });
    return undefined;
  });
  return { rows, problems, missing, columns: head };
}

/* ---------------- Staging ---------------- */

export type LiveStage = "Before the window" | "Renewal window" | "Grace Period" | "Early lapse" | "Late lapse" | "Not in these workflows";

export interface Staged {
  workflowId: "R1" | "R8" | null;
  renewal: string;
  stage: LiveStage;
  timing: string;
  daysToDue: number;
  entryNodeId: string | null;
  reasons: string[];
  bandGroup: ScriptContext["band"];
  segment: string[];
}

const annual = (r: DueRow) => r.premium * PER_YEAR[r.mode];
export const graceDays = (m: Mode) => (m === "Monthly" ? 15 : 30);
export const bandLabel = (b: number | null) => (b == null ? "Not scored" : `P${b}`);

export function segmentsOf(r: DueRow): string[] {
  const s: string[] = [];
  if (r.age != null && r.age >= 60) s.push("Senior citizen");
  const o = r.occupation.toLowerCase();
  if (o.includes("farm") || o.includes("agri")) s.push("Farmer");
  else if (o.includes("self") || o.includes("business")) s.push("Self-employed");
  if (annual(r) > 200_000) s.push("HNI");
  return s;
}

function r8Segment(r: DueRow): string {
  const l = r.lastYear.toLowerCase();
  if (l.includes("bounce")) return "Debit bounced before";
  if (l.includes("180") || l.includes("reviv")) return "Pays very late or revived";
  if (l.includes("grace") || l.includes("late") || l.includes("after")) return "Pays late";
  return "Pays on time";
}

export function stagePolicy(r: DueRow, now: Date = NOW): Staged {
  const per = PER_YEAR[r.mode];
  const d = diffDays(fromIso(r.dueDate), now);
  const g = graceDays(r.mode);
  const reasons: string[] = [];
  const segment = segmentsOf(r);
  const low = r.band != null && r.band <= 5;
  const bandGroup: Staged["bandGroup"] = r.band == null ? "Unscored" : low ? "Low propensity" : "High propensity";
  const premiumWord = `${r.premiumsPaid} ${r.mode.toLowerCase()} premium${r.premiumsPaid === 1 ? "" : "s"} paid`;

  let workflowId: Staged["workflowId"] = null;
  let renewal = "";
  if (r.premiumsPaid === per) {
    workflowId = "R1";
    renewal = "13th month";
    reasons.push(`${premiumWord}: the next premium is the 13th-month premium`);
  } else if (r.premiumsPaid === per * 2) {
    workflowId = "R8";
    renewal = "25th month";
    reasons.push(`${premiumWord}: the next premium is the 25th-month premium`);
  } else if (r.premiumsPaid < per) {
    renewal = "First year";
    reasons.push(`${premiumWord}: still in the first policy year, not a renewal`);
  } else {
    renewal = `${Math.floor(r.premiumsPaid / per) * 12 + 1}th month`;
    reasons.push(`${premiumWord}: a ${renewal} renewal, handled by the other renewal workflows`);
  }

  let stage: LiveStage;
  let timing: string;
  if (d > 90) {
    stage = "Before the window";
    timing = `T-${d}`;
    reasons.push(`Due on ${r.dueDate}, ${d} days away: joins at T-90`);
  } else if (d >= 0) {
    stage = "Renewal window";
    timing = d === 0 ? "Due today" : `T-${d}`;
    reasons.push(`Due on ${r.dueDate}: ${timing}`);
  } else if (-d <= g) {
    stage = "Grace Period";
    timing = `Grace day ${-d} of ${g}`;
    reasons.push(`Due on ${r.dueDate}, unpaid: grace day ${-d} of ${g} (${r.mode.toLowerCase()} mode)`);
  } else if (-d <= 180) {
    stage = "Early lapse";
    timing = `Lapsed ${-d - g} days`;
    reasons.push(`Grace Period ended ${-d - g} days ago: early lapse, premium plus late fee, no health declaration`);
  } else {
    stage = "Late lapse";
    timing = `${-d} days past due`;
    reasons.push(`${-d} days past due: revival needs a declaration of good health`);
  }
  if (!workflowId) {
    return { workflowId, renewal, stage: "Not in these workflows", timing, daysToDue: d, entryNodeId: null, reasons, bandGroup, segment };
  }

  let entry: string;
  const hni = annual(r) > 200_000;
  if (hni && d >= 0) {
    entry = "hniteam";
    reasons.push(`Annualised premium Rs ${annual(r).toLocaleString("en-IN")} is above Rs 2 lakh: the HNI team works it through the advisor`);
  } else if (stage === "Before the window") {
    entry = "due";
  } else if (stage === "Renewal window") {
    if (workflowId === "R1") {
      if (low && d > 30) {
        entry = "early";
        reasons.push(`${bandLabel(r.band)} is in the lower propensity bands: early service call`);
      } else if (d > 45) entry = "t60";
      else if (d > 30) entry = "t45";
      else if (d > 15) entry = "rpn";
      else if (d > 0) entry = "ad";
      else entry = r.autopay === "None" ? "t0" : "debit";
      if (!low && d > 30) reasons.push(`${bandLabel(r.band)}${r.band == null ? "" : " is in the higher propensity bands"}: messages first, no early call`);
    } else {
      const seg = r8Segment(r);
      reasons.push(`Last year: ${r.lastYear || "paid on time"}, so the segment is "${seg}"`);
      if (d > 30) entry = "seg";
      else if (d > 15) entry = "rpn";
      else if (d > 0) entry = "ad";
      else entry = r.autopay === "None" ? "t0" : "debit";
    }
    if (d <= 15 && d > 0) reasons.push(r.autopay === "None" ? `Not on autopay: payment link on WhatsApp first, a call only if it is not paid` : `${r.autopay} registered: balance check before the debit`);
  } else if (stage === "Grace Period") {
    entry = "rehit";
  } else {
    entry = "days";
  }
  return { workflowId, renewal, stage, timing, daysToDue: d, entryNodeId: entry, reasons, bandGroup, segment };
}

/* ---------------- Run ---------------- */

export const REPLIES = ["As the customer would", "Will pay", "Wants an explanation", "Not reached", "Refused", "Needs a person", "Pays now"] as const;
export type Reply = (typeof REPLIES)[number];

export type EventKind = "file" | "stage" | "system" | "whatsapp" | "call" | "payment" | "brief" | "person" | "vendor" | "wait" | "decision" | "outcome" | "score";

export interface LiveEvent {
  id: string;
  day: number;
  kind: EventKind;
  nodeId?: string | undefined;
  title: string;
  detail?: string | undefined;
  by: string;
  script?: { id: string; name: string; version: number; rule?: string | undefined } | undefined;
  /** The words actually sent or spoken, filled for this customer. */
  text?: string | undefined;
  worth?: WorthResult | undefined;
  transcript?: { who: "Agent" | "Customer"; text: string }[] | undefined;
  disposition?: string | undefined;
  status?: string | undefined;
}

export interface PersonCase {
  id: string;
  team: string;
  nodeId: string;
  why: string;
  recommended: string;
  openedDay: number;
  slaHours: number;
  resolved?: { by: string; outcome: string; day: number };
}

export interface RunState {
  id: string;
  row: DueRow;
  staged: Staged;
  graphId: "R1" | "R8";
  nodeId: string;
  day: number;
  done: boolean;
  endState?: string | undefined;
  paid: boolean;
  refusals: number;
  lastDisposition?: string | undefined;
  reason?: string | undefined;
  visits: Record<string, number>;
  events: LiveEvent[];
  waitingCase?: PersonCase | undefined;
  /** Channel actions that need the real platform. */
  handoffs: Handoff[];
  story?: Story | undefined;
  calls: number;
  unanswered: number;
  unpaidLinks: number;
}

/** One action the real platform must take. Sent to the dispatch address when one is set. */
export interface Handoff {
  at: string;
  action: string;
  channel?: "Voice" | "WhatsApp" | "Brief" | "Vendor" | undefined;
  scriptId?: string | undefined;
  text?: string | undefined;
}

const hash = (s: string) => hashId(s) % 100;

export function startRun(row: DueRow, staged: Staged, fileName: string): RunState | null {
  if (!staged.workflowId || !staged.entryNodeId) return null;
  const id = `${row.policy}`;
  const events: LiveEvent[] = [
    { id: `${id}-f`, day: 0, kind: "file", title: `Read from ${fileName}`, detail: `Row ${row.line}: ${row.plan}, ${row.mode}, Rs ${row.premium.toLocaleString("en-IN")}, due ${row.dueDate}`, by: "Due-list intake" },
    { id: `${id}-s`, day: 0, kind: "stage", title: `${staged.renewal}, ${staged.stage}, ${staged.timing}`, detail: staged.reasons.join(". ") + ".", by: "Staging rules" },
  ];
  return {
    id, row, staged, graphId: staged.workflowId, nodeId: staged.entryNodeId, day: 0, done: false, paid: false, refusals: 0,
    visits: {}, events, handoffs: [], story: BOOTH_STORIES[row.policy], calls: 0, unanswered: 0, unpaidLinks: 0,
  };
}

function ctxFor(s: RunState): ScriptContext {
  return ctxOf(s.row, s.staged);
}

export function ctxOf(row: DueRow, staged: Staged): ScriptContext {
  return { band: staged.bandGroup, bandNo: row.band, segment: staged.segment, product: row.product, language: row.language };
}

/** The variant a step will use for this customer, and why. */
export function scriptFor(row: DueRow, staged: Staged, nodeId: string): { v: ScriptVariant; rule: string } | undefined {
  const v = pickScript(nodeId, ctxOf(row, staged));
  return v ? { v, rule: scriptRule(v) } : undefined;
}

/** What the story says the customer does at this step, on this visit. */
export function beatAt(s: RunState, nodeId: string, visitNo: number): StoryBeat | undefined {
  return s.story?.beats[`${nodeId}#${visitNo}`] ?? s.story?.beats[nodeId];
}

function vars(s: RunState): Record<string, string> {
  const r = s.row;
  const due = fromIso(r.dueDate);
  return {
    agent: "Asha",
    first: r.name.split(" ")[0] ?? r.name,
    name: r.name,
    policy: r.policy,
    plan: r.plan,
    premium: `Rs ${r.premium.toLocaleString("en-IN")}`,
    due: r.dueDate,
    grace_end: toIso(addDays(due, graceDays(r.mode))),
    sum_assured: `Rs ${(r.premium * PER_YEAR[r.mode] * 10).toLocaleString("en-IN")}`,
    uin: "121L000V01",
    app_link: "sample.life/app",
    pay_link: `pay.sample.life/${r.policy.slice(-4)}`,
    mandate_link: `sample.life/enach/${r.policy.slice(-4)}`,
    opt_out: "sample.life/stop",
    helpline: "1800 000 0000",
    status: s.paid ? "Paid" : s.lastDisposition ?? "Not reached yet",
    last: s.events.filter((e) => e.kind === "call" || e.kind === "whatsapp").slice(-1)[0]?.title ?? "None",
  };
}

/** A script's text filled in for this customer, as it would be sent or spoken. */
export function wordsFor(s: RunState, text: string): string {
  return fillScript(text, vars(s));
}

function scriptOf(s: RunState, nodeId: string) {
  const v = pickScript(nodeId, ctxFor(s));
  return v ? { v, text: fillScript(v.text, vars(s)), ref: { id: v.id, name: v.name, version: v.version, rule: scriptRule(v) } } : undefined;
}

const PROMISED = ["Promise to pay", "Explained, will pay", "Paid on the call"];

function worthOf(s: RunState): WorthResult {
  return worthScore({
    band: s.row.band, calls: s.calls, unanswered: s.unanswered, refusals: s.refusals,
    promise: PROMISED.includes(s.lastDisposition ?? ""), brokenPromises: 0,
    daysPastDue: Math.max(0, s.day - s.staged.daysToDue), unpaidLinks: s.unpaidLinks, reason: s.reason,
    annualPremium: s.row.premium * PER_YEAR[s.row.mode],
  });
}

/** Message steps: whether the customer pays on the link, reads it, or does nothing. */
function messageResult(s: RunState, node: WfNode, reply: Reply, beat: StoryBeat | undefined): "Pays" | "Read" | "No reply" {
  if (reply === "Pays now" || beat === "Pays on the link") return "Pays";
  if (beat === "No reply") return "No reply";
  const x = hash(s.id + node.id + (s.visits[node.id] ?? 0));
  if (/link/i.test(node.label) && reply === "As the customer would" && !beat) {
    const promised = PROMISED.includes(s.lastDisposition ?? "");
    if (x < (promised ? 75 : s.staged.bandGroup === "High propensity" ? 45 : 20)) return "Pays";
  }
  return x < 70 ? "Read" : "No reply";
}

const CONTACT = (t: string) => t === "agent.message" || t === "agent.voice" || t === "agent.payment";

/** The disposition a simulated call returns when the operator leaves it to the customer. */
function naturalReply(s: RunState, nodeId: string): Exclude<Reply, "As the customer would"> {
  const x = hash(s.row.policy + nodeId + (s.visits[nodeId] ?? 0));
  const low = s.staged.bandGroup === "Low propensity";
  if (low) return x < 35 ? "Will pay" : x < 50 ? "Wants an explanation" : x < 75 ? "Not reached" : x < 92 ? "Refused" : "Needs a person";
  return x < 60 ? "Will pay" : x < 70 ? "Wants an explanation" : x < 88 ? "Not reached" : x < 96 ? "Refused" : "Needs a person";
}

function transcriptFor(s: RunState, opening: string, reply: Exclude<Reply, "As the customer would">): LiveEvent["transcript"] {
  const hi = s.row.language === "Hindi";
  const t: NonNullable<LiveEvent["transcript"]> = [{ who: "Agent", text: opening }];
  const say = (en: string, h: string) => t.push({ who: "Customer", text: hi ? h : en });
  const ag = (en: string, h: string) => t.push({ who: "Agent", text: hi ? h : en });
  switch (reply) {
    case "Will pay":
    case "Pays now":
      say("Yes, I will pay. Please send the link.", "Haan, main bhar dunga. Link bhej dijiye.");
      ag("Thank you. On which date shall I note it?", "Dhanyavaad. Kis tareekh ko note karoon?");
      say("This week, by Friday.", "Isi hafte, Friday tak.");
      ag("Noted. The link is on your WhatsApp now.", "Note kar liya. Link aapke WhatsApp par bhej diya hai.");
      break;
    case "Wants an explanation":
      say("Before I pay I want to understand what I get from this policy.", "Pay karne se pehle samajhna hai ki is policy se mujhe kya milega.");
      ag("Of course. Let me take you through the benefits.", "Bilkul, main aapko benefits samjhati hoon.");
      break;
    case "Refused":
      say("I don't want to continue. Money is tight right now.", "Abhi paise nahi hain, main continue nahi karna chahta.");
      ag("I understand. Paying within the grace period keeps your cover with no extra charge. Could a monthly mode help?", "Main samajh sakti hoon. Grace period mein bharne par koi extra charge nahi lagega. Kya monthly mode se aasaan hoga?");
      say("No, not now.", "Nahi, abhi nahi.");
      break;
    case "Needs a person":
      say("I want to speak to someone from the company about how this was sold to me.", "Mujhe company ke kisi insaan se baat karni hai, mujhe policy galat batakar bechi gayi.");
      ag("I am connecting you to a colleague who will call you back today.", "Main aapko ek colleague se jodti hoon, woh aaj hi call karenge.");
      break;
    case "Not reached":
      return [{ who: "Agent", text: "No answer after 6 rings." }];
  }
  return t;
}

const dispositionWord: Record<Exclude<Reply, "As the customer would">, string> = {
  "Will pay": "Promise to pay",
  "Pays now": "Paid on the call",
  "Wants an explanation": "Explained, will pay",
  "Not reached": "Not reached",
  Refused: "No intention to pay",
  "Needs a person": "Asked for a person",
};

const PERSON_TEAMS: Record<string, { team: string; sla: number; recommended: string }> = {
  "people.hv": { team: "High-value desk", sla: 24, recommended: "Call through the advisor or the customer's CA; share the payment link and ask for a date." },
  "people.retention": { team: "Complaint desk", sla: 4, recommended: "Stop collection. Call back, log the complaint with the transcript, and agree a resolution date." },
  "people.remittance": { team: "Service team", sla: 24, recommended: "Fix the service request, then put the policy back in the reminder journey." },
  "people.telecaller": { team: "Persistency callers", sla: 8, recommended: "Call back with the transcript in front of you; offer a later date in grace or a mode change." },
  "people.underwriting": { team: "Revival underwriting", sla: 48, recommended: "Collect the declaration of good health; apply the money held in suspense once it is in." },
};

function lowerChoice(s: RunState, node: WfNode, labels: string[], reply: Reply): string | undefined {
  const r = (salt: string) => hash(s.row.policy + salt);
  const has = (l: string) => labels.includes(l);
  const disp = s.lastDisposition;
  switch (node.id) {
    case "hni": return s.row.premium * PER_YEAR[s.row.mode] > 200_000 ? "Yes" : "No";
    case "band": return s.staged.bandGroup === "Low propensity" ? "P1 to P5" : "P6 to P10";
    case "seg": return r8Segment(s.row);
    case "out1":
      return disp === "Promise to pay" || disp === "Explained, will pay" || disp === "Paid on the call" ? "Will pay" : disp === "Not reached" ? "Not reached" : disp === "No intention to pay" ? "Refused" : "Raised an issue";
    case "out2":
      return disp === "Promise to pay" || disp === "Explained, will pay" || disp === "Paid on the call" ? "Will pay" : disp === "Not reached" ? "Not reached" : disp === "No intention to pay" ? "Refused" : "Callback asked";
    case "resp":
      return disp === "Promise to pay" || disp === "Explained, will pay" || disp === "Paid on the call" ? "Will pay" : disp === "No intention to pay" ? "Refuses" : disp === "Asked for a person" ? "Needs a person" : "No response";
    case "rdec": return s.reason === "Mis-selling" ? "Mis-selling" : s.reason === "Financial" ? "Financial" : "Service or product";
    case "ad": return s.row.autopay === "None" ? "No" : "Yes";
    case "balDec": return reply === "Refused" ? "No" : r("bal") < 80 ? "Yes" : "No";
    case "debDec": return s.paid || reply === "Pays now" || r("deb") < 85 ? "Yes" : "Bounced";
    case "paid": case "gpaid": case "lp1": case "lp2": case "ep": return s.paid ? "Yes" : "No";
    case "wdec": return worthOf(s).handOver ? "No" : "Yes";
    case "cont": return s.refusals >= 3 ? "Stop" : "Yes";
    case "prod": return s.row.product === "ULIP" ? "ULIP" : "Traditional";
    case "days": return -s.staged.daysToDue + s.day > 180 ? "180 and over" : "Under 180";
    case "vres": {
      const b = beatAt(s, "vres", 1);
      if (b === "Agrees with the vendor") return "Yes";
      if (b === "Declines the vendor") return "No";
      return reply === "Refused" ? "No" : reply === "Will pay" || reply === "Pays now" || r("vres") < 40 ? "Yes" : "No";
    }
    case "rein": return -s.staged.daysToDue + s.day > 180 && !s.visits["reinFix"] ? "No" : "Yes";
    case "cb": return (s.visits["cb"] ?? 0) <= 1 ? "Call again" : "Still not reached";
    case "reinFix": return "Documents in";
    default: return has("Default") ? "Default" : labels[0];
  }
}

function timingDay(s: RunState, node: WfNode): number {
  const m = node.label.match(/\(T-(\d+)\)/);
  if (m) return Math.max(s.day, s.staged.daysToDue - Number(m[1]));
  if (node.label.includes("(T-0)")) return Math.max(s.day, s.staged.daysToDue);
  // Unpaid at the end of the Grace Period: the lapse is dated the day after it ends.
  if ((node.id === "gpaid" || node.id === "lapse") && !s.paid) return Math.max(s.day, s.staged.daysToDue + graceDays(s.row.mode) + 1);
  return s.day;
}

let seq = 0;
const eid = (s: RunState) => `${s.id}-${s.events.length}-${seq++}`;

/** Run the current step and move to the next one. Pure: returns a new state. */
export function runStep(graph: WfGraph, prev: RunState, replyIn: Reply = "As the customer would"): RunState {
  if (prev.done || prev.waitingCase) return prev;
  const s: RunState = { ...prev, events: [...prev.events], visits: { ...prev.visits }, handoffs: [...prev.handoffs] };
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out = new Map<string, WfEdge[]>();
  for (const e of graph.edges) out.set(e.from, [...(out.get(e.from) ?? []), e]);
  let node = byId.get(s.nodeId);
  if (!node) return { ...s, done: true, endState: "Step not found" };
  const visit = s.visits[node.id] ?? 0;
  s.visits[node.id] = visit + 1;
  const beat = beatAt(s, node.id, visit + 1);
  s.day = timingDay(s, node);
  const pal = PALETTE_BY_TYPE[node.type];
  const who = node.config.executor ?? pal?.executor ?? "Platform";
  const push = (e: Omit<LiveEvent, "id" | "day"> & { day?: number }) => s.events.push({ id: eid(s), day: e.day ?? s.day, ...e });
  const reply: Reply = replyIn;

  if (isOutcome(node)) {
    push({ kind: "outcome", nodeId: node.id, title: node.label, by: "Workflow", status: node.label });
    return { ...s, done: true, endState: node.label };
  }

  const t = node.type;
  const skip = s.paid && CONTACT(t);
  if (skip) {
    push({ kind: "system", nodeId: node.id, title: `${node.label}: not sent`, detail: "Premium already received; the exclusion check stops every later contact", by: "Exclusion check" });
  } else if (t === "agent.voice" || t === "agent.payment" && /call/i.test(node.label)) {
    const sc = scriptOf(s, node.id) ?? scriptOf(s, "call15");
    const storyReply = beat && (REPLIES as readonly string[]).includes(beat) ? (beat as Exclude<Reply, "As the customer would">) : undefined;
    const actual = reply === "As the customer would" ? storyReply ?? naturalReply(s, node.id) : reply;
    const opening = sc?.text ?? node.label;
    s.calls += 1;
    if (actual === "Not reached") s.unanswered += 1;
    push({
      kind: "call", nodeId: node.id, title: `${node.label}: ${dispositionWord[actual]}`, by: who,
      detail: actual === "Not reached" ? `Called ${s.row.phone}, no answer` : `Called ${s.row.phone}, ${2 + (hash(s.id + node.id) % 4)} min ${10 + (hash(node.id + s.id) % 50)} s, ${s.row.language}. Disposition read from the call: ${dispositionWord[actual]}`,
      ...(sc ? { script: sc.ref, text: sc.text } : {}),
      transcript: transcriptFor(s, opening, actual), disposition: dispositionWord[actual],
    });
    s.handoffs.push({ at: node.id, channel: "Voice", scriptId: sc?.v.id, text: sc?.text, action: `Place a call with script ${sc?.v.id ?? "default"}, return disposition and transcript` });
    if (actual === "Wants an explanation") {
      const ex = scriptOf(s, "explain");
      s.calls += 1;
      push({
        kind: "call", nodeId: node.id, title: "Product explanation call: Explained, will pay", by: who,
        detail: `Called back within the hour, ${s.row.product} benefits explained`,
        ...(ex ? { script: ex.ref, text: ex.text } : {}),
        transcript: [
          { who: "Agent", text: ex?.text ?? "Explained the plan benefits." },
          { who: "Customer", text: s.row.language === "Hindi" ? "Theek hai, ab samajh aaya. Link bhej dijiye." : "That is clear now. Please send the link." },
        ],
        disposition: "Explained, will pay",
      });
      s.handoffs.push({ at: node.id, channel: "Voice", scriptId: ex?.v.id, text: ex?.text, action: "Place the product explanation call" });
    }
    if (actual === "Pays now") {
      s.paid = true;
      push({ kind: "payment", nodeId: node.id, title: `Paid Rs ${s.row.premium.toLocaleString("en-IN")} by UPI on the link`, by: "Payment gateway", status: "Paid" });
    }
    s.lastDisposition = actual === "Wants an explanation" ? "Explained, will pay" : dispositionWord[actual];
    if (actual === "Refused") s.refusals += 1;
    if (actual === "Needs a person") s.reason = "Mis-selling";
    else if (actual === "Refused") s.reason = "Financial";
  } else if (t === "agent.message" || t === "agent.payment") {
    const sc = scriptOf(s, node.id) ?? scriptOf(s, /link/i.test(node.label) ? "link15" : "t0");
    const res = messageResult(s, node, reply, beat);
    const hasLink = /link/i.test(node.label) || /\{pay_link\}/.test(sc?.v.text ?? "");
    push({
      kind: "whatsapp", nodeId: node.id, title: node.label, by: who, status: res === "No reply" ? "Delivered, no reply" : res === "Pays" ? "Read, link opened" : "Read",
      detail: sc?.text, ...(sc ? { script: sc.ref, text: sc.text } : {}),
    });
    s.handoffs.push({ at: node.id, channel: "WhatsApp", scriptId: sc?.v.id ?? node.id, text: sc?.text, action: `Send WhatsApp template ${sc?.v.id ?? node.id}, return delivered, read and paid` });
    if (res === "Pays") {
      s.paid = true;
      push({ kind: "payment", nodeId: node.id, title: `Paid Rs ${s.row.premium.toLocaleString("en-IN")} by UPI on the link`, by: "Payment gateway", status: "Paid" });
    } else if (hasLink) s.unpaidLinks += 1;
  } else if (t === "agent.summariser") {
    const sc = scriptOf(s, node.id) ?? scriptOf(s, "sales");
    push({ kind: "brief", nodeId: node.id, title: node.label, detail: sc?.text, by: who, ...(sc ? { script: sc.ref, text: sc.text } : {}) });
    s.handoffs.push({ at: node.id, channel: "Brief", scriptId: sc?.v.id, text: sc?.text, action: "Send the brief to the advisor or branch" });
  } else if (t === "agent.score") {
    const w = worthOf(s);
    push({ kind: "score", nodeId: node.id, title: `Chance to collect ${Math.round(w.chance * 100)}%: ${w.handOver ? "hand over" : "keep calling"}`, detail: w.why, by: who, worth: w });
  } else if (t === "agent.classifier") {
    const reason = s.reason ?? (s.lastDisposition === "Asked for a person" ? "Mis-selling" : "Service or product");
    s.reason = reason;
    push({ kind: "system", nodeId: node.id, title: `${node.label}: ${reason}`, detail: "Read from the last call transcript", by: who });
  } else if (t === "agent.quality") {
    push({ kind: "system", nodeId: node.id, title: `${node.label}: 86 of 100, no fatal flags`, detail: "Scored on the 24-point call scorecard", by: who });
  } else if (t.startsWith("people.")) {
    const p = PERSON_TEAMS[t] ?? { team: "Persistency team", sla: 24, recommended: "Review the case and decide the next step." };
    const c: PersonCase = {
      id: `CASE-${s.row.policy.slice(-4)}-${s.events.length}`, team: p.team, nodeId: node.id, openedDay: s.day, slaHours: p.sla,
      why: s.lastDisposition === "Asked for a person" ? "Customer asked for a person on the call; words suggest mis-selling" : node.label,
      recommended: p.recommended,
    };
    push({ kind: "person", nodeId: node.id, title: `Handed to ${p.team}`, detail: c.why, by: "Workflow", status: "Waiting" });
    s.waitingCase = c;
    return s; // stays on this step until a person closes the case
  } else if (t === "vendor.send") {
    push({ kind: "vendor", nodeId: node.id, title: node.label, detail: "Case file sent with the full history, reasons and the score. The result is read back from the vendor file", by: "Workflow" });
    s.handoffs.push({ at: node.id, channel: "Vendor", action: "Send the case to the calling vendor" });
    s.day += 30;
  } else if (t.startsWith("wait.")) {
    const gap = node.config.gapDays ?? (node.id === "grace" ? 1 : 2);
    s.day += gap;
    push({ kind: "wait", nodeId: node.id, title: node.label, detail: `${gap} day${gap === 1 ? "" : "s"}`, by: "Workflow" });
  } else if (t.startsWith("decision.")) {
    // recorded below with its branch
  } else {
    push({ kind: "system", nodeId: node.id, title: node.label, by: who });
  }

  const edges = out.get(node.id) ?? [];
  let next: WfEdge | undefined;
  if (edges.length === 1) next = edges[0];
  else if (edges.length > 1) {
    const labels = edges.map((e) => e.label ?? "Default");
    const want = lowerChoice(s, node, labels, reply);
    next = edges.find((e) => (e.label ?? "Default") === want) ?? edges.find((e) => !e.label) ?? edges[0];
    if (t.startsWith("decision.")) push({ kind: "decision", nodeId: node.id, title: `${node.label} ${next?.label ?? ""}`.trim(), by: "Workflow rules" });
  }
  if (!next) return { ...s, done: true, endState: "No next step" };
  s.nodeId = next.to;
  node = byId.get(next.to);
  // Decisions and checks resolve on their own; stop at the next step that does something visible.
  if (node && (node.type.startsWith("decision.") || node.type.startsWith("check.") || isOutcome(node) || (s.paid && CONTACT(node.type)))) return runStep(graph, s, reply === "Pays now" ? "As the customer would" : reply);
  return s;
}

/** Resolve decisions and checks at the entry step so the board opens on a step that does something. */
export function settle(graph: WfGraph, s: RunState): RunState {
  const n = graph.nodes.find((x) => x.id === s.nodeId);
  return n && (n.type.startsWith("decision.") || n.type.startsWith("check.")) ? runStep(graph, s) : s;
}

/** Close a person's case and let the policy carry on. */
export function resolveCase(graph: WfGraph, prev: RunState, by: string, outcome: "Will pay" | "Paid" | "Refused" | "Documents in" | "Close the case"): RunState {
  if (!prev.waitingCase) return prev;
  const s: RunState = { ...prev, events: [...prev.events], visits: { ...prev.visits } };
  const c = { ...prev.waitingCase, resolved: { by, outcome, day: s.day } };
  s.events.push({ id: eid(s), day: s.day, kind: "person", nodeId: c.nodeId, title: `${c.team}: ${outcome}`, detail: `Closed by ${by}`, by, status: "Done" });
  if (outcome === "Paid") {
    s.paid = true;
    s.events.push({ id: eid(s), day: s.day, kind: "payment", nodeId: c.nodeId, title: `Paid Rs ${s.row.premium.toLocaleString("en-IN")}`, by: "Payment gateway", status: "Paid" });
  }
  if (outcome === "Will pay") s.lastDisposition = "Promise to pay";
  if (outcome === "Refused") {
    s.refusals += 1;
    s.lastDisposition = "No intention to pay";
  }
  if (outcome === "Close the case") {
    s.events.push({ id: eid(s), day: s.day, kind: "outcome", title: "Closed with reason", detail: "Closed by a person", by, status: "Closed with reason" });
    return { ...s, waitingCase: undefined, done: true, endState: "Closed with reason" };
  }
  const out = graph.edges.filter((e) => e.from === c.nodeId);
  const next = out.find((e) => e.label === "Documents in") ?? out[0];
  s.waitingCase = undefined;
  if (!next) return { ...s, done: true, endState: "No next step" };
  s.nodeId = next.to;
  const n = graph.nodes.find((x) => x.id === next.to);
  if (n && (n.type.startsWith("decision.") || n.type.startsWith("check.") || isOutcome(n))) return runStep(graph, s);
  return s;
}

export function dayLabel(day: number): string {
  const d = addDays(NOW, day);
  return `${toIso(d)}${day === 0 ? " (today)" : ""}`;
}
