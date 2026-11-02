import { BASE_POLICIES, POLICY_INDEX } from "../index";
import { NOW, DAY_MS, addDays, toIso } from "../dates";
import { hashId } from "../derived";
import { Rng } from "../rng";
import type { Policy } from "../types";
import { branchOf } from "./common";
import { TASKS_BY_POLICY } from "./tasks";
import { DUE_COUNTS, NEW_POLICIES, STAGE_CHANGE_IDS, newDueDate } from "./due-import";

export { DUE_COUNTS, NEW_POLICIES, STAGE_CHANGE_IDS, newDueDate };

export interface AdapterDef {
  id: string;
  name: string;
  direction: "In" | "Out";
  source: string;
  schedule: string;
  lastReceived: string;
  rows: number;
  rejects: number;
  overdue: boolean;
  /** Who may import this file. */
  importKind: "due" | "payments" | "bounce" | "results" | "reference" | "outbound";
}

export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  date?: boolean | undefined;
}

export const TARGETS: Record<string, TargetField[]> = {
  "due-list": [
    { key: "policy", label: "Policy number", required: true },
    { key: "customer", label: "Customer name", required: true },
    { key: "product", label: "Product", required: true },
    { key: "premium", label: "Annual premium", required: true },
    { key: "mode", label: "Payment mode", required: true },
    { key: "due", label: "Due date", required: true, date: true },
    { key: "method", label: "Payment method", required: false },
    { key: "channel", label: "Channel", required: false },
    { key: "branch", label: "Branch", required: false },
    { key: "cohort", label: "Cohort", required: false },
  ],
  payments: [
    { key: "receipt", label: "Receipt number", required: true },
    { key: "policy", label: "Policy number", required: true },
    { key: "amount", label: "Amount", required: true },
    { key: "paidOn", label: "Paid on", required: true, date: true },
    { key: "mode", label: "Payment mode", required: false },
  ],
  bounce: [
    { key: "policy", label: "Policy number", required: true },
    { key: "amount", label: "Amount", required: true },
    { key: "date", label: "Bounce date", required: true, date: true },
    { key: "reason", label: "Bounce reason", required: true },
  ],
  "call-results": [
    { key: "policy", label: "Policy number", required: true },
    { key: "vendor", label: "Vendor", required: true },
    { key: "calledAt", label: "Called at", required: true, date: true },
    { key: "disposition", label: "Disposition", required: true },
    { key: "duration", label: "Duration (seconds)", required: false },
  ],
  "wa-results": [
    { key: "policy", label: "Policy number", required: true },
    { key: "sentAt", label: "Sent at", required: true, date: true },
    { key: "status", label: "Status", required: true },
  ],
  cohort: [
    { key: "policy", label: "Policy number", required: true },
    { key: "cohort", label: "Cohort", required: true },
  ],
  advisor: [
    { key: "advisor", label: "Advisor code", required: true },
    { key: "status", label: "Advisor status", required: true },
  ],
};

/** Source column names the mapper recognises without help. */
const KNOWN: Record<string, string> = {
  POLICY_NO: "policy", CUST_NAME: "customer", PRODUCT: "product", ANN_PREMIUM: "premium", DUE_DT: "due", PAY_METHOD: "method", CHANNEL: "channel", BRANCH: "branch", COHORT: "cohort",
  RECEIPT_NO: "receipt", AMOUNT: "amount", PAID_ON: "paidOn", MODE: "mode", BOUNCE_DT: "date", REASON: "reason", VENDOR: "vendor", CALLED_AT: "calledAt", DISPOSITION: "disposition", DURATION: "duration",
  SENT_AT: "sentAt", STATUS: "status", ADVISOR_CODE: "advisor", ADVISOR_STATUS: "status",
};

export function autoMap(adapterId: string, header: string[]): Record<string, string> {
  const targets = new Set((TARGETS[adapterId] ?? []).map((t) => t.key));
  const out: Record<string, string> = {};
  for (const h of header) {
    const k = KNOWN[h.trim().toUpperCase()];
    if (k && targets.has(k)) out[h] = k;
  }
  return out;
}

export interface SampleFile {
  name: string;
  header: string[];
  rows: string[][];
}

const fmtDmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/* ---------- Due list sample: 11,754 known policies, 214 new, 32 rejects ---------- */

const STAGE_CHANGE_SET = new Set(STAGE_CHANGE_IDS);

function dueRow(p: Policy, due: string): string[] {
  return [p.policyId, p.customerName, p.product, String(p.annualisedPremium), p.paymentMode, fmtDmy(due), p.paymentMethod, p.channel, branchOf(p), p.insurerCohort];
}

let dueCache: SampleFile | null = null;
export function dueListSample(): SampleFile {
  if (dueCache) return dueCache;
  const header = ["POLICY_NO", "CUST_NAME", "PRODUCT", "ANN_PREMIUM", "PREM_FREQ", "DUE_DT", "PAY_METHOD", "CHANNEL", "BRANCH", "COHORT"];
  const rows: string[][] = [];
  const known = BASE_POLICIES.slice(0, DUE_COUNTS.updated + 0);
  // Make sure every stage-change policy is in the file.
  const included = new Set(known.map((p) => p.policyId));
  const extra = STAGE_CHANGE_IDS.filter((id) => !included.has(id));
  const list = [...known.slice(0, known.length - extra.length), ...extra.map((id) => BASE_POLICIES[POLICY_INDEX.get(id)!]!)];
  for (const p of list) rows.push(dueRow(p, STAGE_CHANGE_SET.has(p.policyId) ? newDueDate(p) : p.dueDate));
  for (const p of NEW_POLICIES) rows.push(dueRow(p, p.dueDate));
  const rng = new Rng(3232);
  const spare = BASE_POLICIES.slice(DUE_COUNTS.updated).filter((p) => !STAGE_CHANGE_SET.has(p.policyId));
  for (let i = 0; i < DUE_COUNTS.rejects; i++) {
    const src = spare[i]!;
    const r = dueRow(src, src.dueDate);
    if (i < 12) r[3] = "";
    else if (i < 22) r[5] = "31/02/2026";
    else if (i < 28) r[0] = "";
    else r[2] = "Pension";
    rows.splice(rng.int(0, rows.length), 0, r);
  }
  dueCache = { name: "due_list_2026-10-28.csv", header, rows };
  return dueCache;
}

/* ---------- Payment file: 486 receipts, 471 matched, 15 unmatched, 38 with open touches ---------- */

export const PAYMENT_COUNTS = { receipts: 486, matched: 471, unmatched: 15, touchesClose: 38 } as const;

function recentTaskAt(p: Policy): string | null {
  const t = TASKS_BY_POLICY.get(p.policyId)?.[0];
  return t && NOW.getTime() - new Date(t.at).getTime() < 3 * DAY_MS ? t.at : null;
}

const OPEN_STATES = new Set(["Renewal window open", "Grace", "Promised"]);
export interface ReceiptRow {
  receipt: string;
  policyId: string;
  amount: number;
  paidAt: string;
  mode: string;
  /** For the 38: the touch that closed and how many touches came after payment. */
  closedTouch?: string | undefined;
  touchesAfter?: number | undefined;
}

export const PAYMENT_RECEIPTS: ReceiptRow[] = (() => {
  const open = BASE_POLICIES.filter((p) => OPEN_STATES.has(p.state));
  const withTouch = open.filter((p) => recentTaskAt(p)).slice(0, PAYMENT_COUNTS.touchesClose);
  const touched = new Set(withTouch.map((p) => p.policyId));
  const rest = open.filter((p) => !touched.has(p.policyId) && !recentTaskAt(p)).slice(0, PAYMENT_COUNTS.matched - withTouch.length);
  const rows: ReceiptRow[] = [];
  let n = 1;
  for (const p of withTouch) {
    const last = recentTaskAt(p)!;
    const tasks = TASKS_BY_POLICY.get(p.policyId) ?? [];
    const paidAt = new Date(new Date(last).getTime() - 5 * 3_600_000).toISOString();
    rows.push({ receipt: `RC${String(n++).padStart(6, "0")}`, policyId: p.policyId, amount: p.instalmentAmount, paidAt, mode: "Online", closedTouch: tasks[0]?.step ?? "Reminder", touchesAfter: Math.max(1, tasks.filter((t) => t.at > paidAt).length) });
  }
  for (const p of rest) rows.push({ receipt: `RC${String(n++).padStart(6, "0")}`, policyId: p.policyId, amount: p.instalmentAmount, paidAt: new Date(NOW.getTime() - (hashId(p.policyId) % 20) * 3_600_000).toISOString(), mode: hashId(p.policyId) % 4 === 0 ? "Branch" : "Online" });
  for (let i = 0; i < PAYMENT_COUNTS.unmatched; i++) rows.push({ receipt: `RC${String(n++).padStart(6, "0")}`, policyId: `SLI09${String(70000 + i * 37)}`, amount: 12_000 + i * 1_350, paidAt: new Date(NOW.getTime() - (i + 2) * 3_600_000).toISOString(), mode: "Branch" });
  return rows;
})();

export function paymentSample(): SampleFile {
  return {
    name: "payments_2026-10-28.csv",
    header: ["RECEIPT_NO", "POLICY_NO", "AMOUNT", "PAID_ON", "MODE"],
    rows: PAYMENT_RECEIPTS.map((r) => [r.receipt, r.policyId, String(r.amount), r.paidAt.slice(0, 10), r.mode]),
  };
}

/* ---------- Bounce, call results, WhatsApp results, cohort, advisor ---------- */

const BOUNCE_REASONS = ["Insufficient funds", "Mandate cancelled", "Account closed", "Signature mismatch"];
export const BOUNCE_ROWS: { policyId: string; amount: number; date: string; reason: string }[] = BASE_POLICIES.filter((p) => p.paymentMethod === "NACH/ECS mandate" && OPEN_STATES.has(p.state))
  .slice(0, 90)
  .map((p, i) => ({ policyId: p.policyId, amount: p.instalmentAmount, date: toIso(addDays(NOW, -1)), reason: BOUNCE_REASONS[i % 4]! }));

export function bounceSample(): SampleFile {
  return { name: "bounce_2026-10-27.csv", header: ["POLICY_NO", "AMOUNT", "BOUNCE_DT", "REASON"], rows: BOUNCE_ROWS.map((b) => [b.policyId, String(b.amount), b.date, b.reason]) };
}

const VENDOR_DISP = ["Promise to pay with date", "Not reachable", "Callback requested", "Will pay (link requested)", "Short of cash", "Already paid"];
export const CALL_RESULT_ROWS: { policyId: string; vendor: string; calledAt: string; disposition: string; duration: number }[] = (() => {
  const rng = new Rng(8008);
  const book = BASE_POLICIES.filter((p) => p.lifecycleStage === "Renewal window" || p.lifecycleStage === "Early lapse");
  return Array.from({ length: 800 }, (_, i) => {
    const p = book[(i * 7) % book.length]!;
    return {
      policyId: p.policyId,
      vendor: i % 3 === 0 ? "Call-centre vendor (variable payout)" : "Call-centre vendor (fixed payout)",
      calledAt: new Date(NOW.getTime() - rng.int(1, 20) * 3_600_000).toISOString(),
      disposition: rng.pick(VENDOR_DISP),
      duration: rng.int(0, 300),
    };
  });
})();

export function callResultsSample(): SampleFile {
  return { name: "call_results_2026-10-28.csv", header: ["POLICY_NO", "VENDOR", "CALLED_AT", "DISPOSITION", "DURATION"], rows: CALL_RESULT_ROWS.map((r) => [r.policyId, r.vendor, r.calledAt.slice(0, 10), r.disposition, String(r.duration)]) };
}

export function waResultsSample(): SampleFile {
  const rng = new Rng(4500);
  const statuses = ["Delivered", "Read", "Clicked", "Failed"];
  return {
    name: "whatsapp_results_2026-10-28.csv",
    header: ["POLICY_NO", "SENT_AT", "STATUS"],
    rows: Array.from({ length: 4500 }, (_, i) => [BASE_POLICIES[(i * 3) % BASE_POLICIES.length]!.policyId, toIso(addDays(NOW, -rng.int(0, 2))), rng.pick(statuses)]),
  };
}

export function cohortSample(): SampleFile {
  return { name: "cohorts_2026-10.csv", header: ["POLICY_NO", "COHORT"], rows: BASE_POLICIES.filter((p) => p.insurerCohort !== "Unscored").map((p) => [p.policyId, p.insurerCohort]) };
}

export function advisorSample(): SampleFile {
  const seen = new Map<string, string>();
  for (const p of BASE_POLICIES) if (p.channel === "Agency" && !seen.has(p.sourceBankOrAdvisor)) seen.set(p.sourceBankOrAdvisor, p.advisorStatus);
  return { name: "advisor_status_2026-10-26.csv", header: ["ADVISOR_CODE", "ADVISOR_STATUS"], rows: [...seen.entries()].map(([a, s]) => [a, s]) };
}

export function sampleFor(adapterId: string): SampleFile | null {
  switch (adapterId) {
    case "due-list": return dueListSample();
    case "payments": return paymentSample();
    case "bounce": return bounceSample();
    case "call-results": return callResultsSample();
    case "wa-results": return waResultsSample();
    case "cohort": return cohortSample();
    case "advisor": return advisorSample();
    default: return null;
  }
}

export const ADAPTERS: AdapterDef[] = [
  { id: "due-list", name: "Due list and policy details", direction: "In", source: "Policy administration system", schedule: "Daily 06:00", lastReceived: "2026-10-28T00:32:00.000Z", rows: DUE_COUNTS.rows, rejects: DUE_COUNTS.rejects, overdue: false, importKind: "due" },
  { id: "cohort", name: "Cohort file", direction: "In", source: "Analytics team", schedule: "At 90 days and on refresh", lastReceived: "2026-10-03T05:50:00.000Z", rows: BASE_POLICIES.filter((p) => p.insurerCohort !== "Unscored").length, rejects: 0, overdue: false, importKind: "reference" },
  { id: "payments", name: "Payment and collection", direction: "In", source: "Collections system", schedule: "Daily 07:00, branch payments same day", lastReceived: "2026-10-27T01:35:00.000Z", rows: PAYMENT_COUNTS.receipts, rejects: 0, overdue: false, importKind: "payments" },
  { id: "bounce", name: "Bounce file", direction: "In", source: "Sponsor bank", schedule: "Daily 07:00", lastReceived: "2026-10-26T16:40:00.000Z", rows: BOUNCE_ROWS.length, rejects: 0, overdue: true, importKind: "bounce" },
  { id: "advisor", name: "Advisor status", direction: "In", source: "Distribution system", schedule: "Weekly, Monday 04:00", lastReceived: "2026-10-26T22:42:00.000Z", rows: advisorSample().rows.length, rejects: 0, overdue: false, importKind: "reference" },
  { id: "call-results", name: "Call results", direction: "In", source: "Call-centre vendors", schedule: "Daily 08:00", lastReceived: "2026-10-27T02:36:00.000Z", rows: 800, rejects: 0, overdue: false, importKind: "results" },
  { id: "wa-results", name: "WhatsApp results", direction: "In", source: "WhatsApp vendor", schedule: "Daily 08:00", lastReceived: "2026-10-28T02:31:00.000Z", rows: 4_500, rejects: 0, overdue: false, importKind: "results" },
  { id: "vendor-list", name: "Vendor work list", direction: "Out", source: "To call-centre vendors", schedule: "Daily 09:00", lastReceived: "2026-10-27T03:30:00.000Z", rows: 1_180, rejects: 0, overdue: false, importKind: "outbound" },
  { id: "visit-list", name: "Visit and call lists", direction: "Out", source: "To sales officers and bank relationship managers", schedule: "Daily 09:00", lastReceived: "2026-10-27T03:30:00.000Z", rows: 312, rejects: 0, overdue: false, importKind: "outbound" },
  { id: "reports", name: "Reports", direction: "Out", source: "To management", schedule: "Monthly, 2nd working day", lastReceived: "2026-10-02T06:00:00.000Z", rows: 3, rejects: 0, overdue: false, importKind: "outbound" },
];

export interface FileReceipt {
  id: string;
  at: string;
  rows: number;
  rejects: number;
  by: string;
  notes: string[];
}

export function seedHistory(adapterId: string): FileReceipt[] {
  const a = ADAPTERS.find((x) => x.id === adapterId);
  if (!a) return [];
  const daily = a.schedule.startsWith("Daily");
  const n = daily ? 7 : 3;
  const step = daily ? DAY_MS : 7 * DAY_MS;
  return Array.from({ length: n }, (_, i) => ({
    id: `${adapterId}-${i}`,
    at: new Date(new Date(a.lastReceived).getTime() - i * step).toISOString(),
    rows: Math.max(0, a.rows - (i * 37) % 120),
    rejects: Math.max(0, a.rejects - (i % 3)),
    by: a.direction === "Out" ? "Scheduled export" : i % 2 ? "MIS and analytics" : "Scheduled import",
    notes: [],
  }));
}

/** Rejects shown on a file page; the due list uses the reasons from its sample file. */
export function seedRejects(adapterId: string): { row: number; reason: string; value: string }[] {
  if (adapterId === "due-list") {
    return Array.from({ length: DUE_COUNTS.rejects }, (_, i) => ({
      row: 140 + i * 371,
      reason: i < 12 ? "Annual premium missing" : i < 22 ? "Due date is not a real date" : i < 28 ? "Policy number missing" : "Unknown product",
      value: i < 12 ? "" : i < 22 ? "31/02/2026" : i < 28 ? "" : "Pension",
    }));
  }
  return [];
}

/* ---------- Checking a file against a mapping ---------- */

export const DATE_FORMATS = ["yyyy-mm-dd", "dd/mm/yyyy", "dd-mm-yyyy", "mm/dd/yyyy"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export function parseDate(value: string, f: DateFormat): string | null {
  const v = value.trim();
  let y: string, m: string, d: string;
  if (f === "yyyy-mm-dd") {
    const r = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (!r) return null;
    [, y, m, d] = r as unknown as [string, string, string, string];
  } else {
    const sep = f === "dd-mm-yyyy" ? "-" : "/";
    const parts = v.split(sep);
    if (parts.length !== 3) return null;
    if (f === "mm/dd/yyyy") [m, d, y] = parts as [string, string, string];
    else [d, m, y] = parts as [string, string, string];
  }
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(dt.getTime()) || dt.getUTCDate() !== Number(d) || dt.getUTCMonth() !== Number(m) - 1) return null;
  return toIso(dt);
}

export interface CheckResult {
  valid: Record<string, string>[];
  rejects: { row: number; reason: string }[];
  missingRequired: string[];
}

const PRODUCTS = new Set(["ULIP", "Traditional", "Term"]);

export function checkFile(adapterId: string, file: SampleFile, mapping: Record<string, string>, dateFormat: DateFormat): CheckResult {
  const targets = TARGETS[adapterId] ?? [];
  const mapped = new Set(Object.values(mapping));
  const missingRequired = targets.filter((t) => t.required && !mapped.has(t.key)).map((t) => t.label);
  if (missingRequired.length) return { valid: [], rejects: [], missingRequired };
  const colOf = new Map<string, number>();
  file.header.forEach((h, i) => {
    const t = mapping[h];
    if (t) colOf.set(t, i);
  });
  const valid: Record<string, string>[] = [];
  const rejects: { row: number; reason: string }[] = [];
  file.rows.forEach((r, idx) => {
    const rec: Record<string, string> = {};
    for (const t of targets) {
      const i = colOf.get(t.key);
      rec[t.key] = i === undefined ? "" : (r[i] ?? "").trim();
    }
    const blank = targets.find((t) => t.required && !rec[t.key]);
    if (blank) return void rejects.push({ row: idx + 2, reason: `${blank.label} missing` });
    for (const t of targets) {
      if (t.date && rec[t.key]) {
        const iso = parseDate(rec[t.key]!, dateFormat);
        if (!iso) return void rejects.push({ row: idx + 2, reason: `${t.label} is not a real date in ${dateFormat}` });
        rec[t.key] = iso;
      }
    }
    const product = rec["product"];
    if (product !== undefined && product !== "" && !PRODUCTS.has(product)) return void rejects.push({ row: idx + 2, reason: `Unknown product ${product}` });
    valid.push(rec);
  });
  return { valid, rejects, missingRequired };
}

/** A file is refused when its header lacks the columns the saved mapping expects. */
export function missingColumns(adapterId: string, header: string[]): string[] {
  const sample = sampleFor(adapterId);
  if (!sample) return [];
  const have = new Set(header.map((h) => h.trim().toUpperCase()));
  return sample.header.filter((h) => !have.has(h.toUpperCase()));
}

export function parseCsv(text: string): SampleFile {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  const split = (l: string) => l.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
  return { name: "uploaded.csv", header: split(lines[0] ?? ""), rows: lines.slice(1).map(split) };
}
