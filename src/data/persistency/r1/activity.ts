import { NOW, DAY_MS, fromIso, addDays } from "../dates";
import { hashId } from "../derived";
import type { Policy } from "../types";
import { TASKS_BY_POLICY, agentName, type AgentTask } from "./tasks";
import type { ActivityRow } from "./types";

const CHECKS = ["Paid since the list: not paid", "Not on hold", "Contact policy: inside hours, under the cap, registered number"];

function fromTask(t: AgentTask, p: Policy): ActivityRow {
  const voice = t.agentId === "renewal-voice";
  const msg = t.agentId === "message" || t.agentId === "payment-assist";
  return {
    id: `A-${t.id}`,
    policyId: p.policyId,
    at: t.at,
    step: t.step,
    executor: agentName(t.agentId),
    executorKind: "agent",
    version: `v${t.agentVersion}`,
    result: t.msgStatus && !t.disposition ? t.msgStatus : t.disposition ?? (t.reason ? `Reason: ${t.reason}` : t.result),
    ruleId: t.ruleId,
    workflow: t.workflow,
    channel: voice ? "Voice" : msg ? "WhatsApp" : "System",
    disposition: t.disposition,
    reason: t.reason,
    durationSec: t.durationSec || undefined,
    language: t.language,
    transcriptId: t.transcriptId,
    threadId: t.threadId,
    scriptVersion: voice || msg ? `${p.product} ${t.language} v${t.agentVersion}` : undefined,
    offers: voice || msg ? ["Payment link", "Autopay set-up"] : undefined,
    checks: voice || msg ? CHECKS : undefined,
    taskId: t.id,
  };
}

/** Seeded Activity for one policy: agent tasks, vendor calls, receipts and station messages. */
export function seedActivity(p: Policy): ActivityRow[] {
  const rows: ActivityRow[] = (TASKS_BY_POLICY.get(p.policyId) ?? []).map((t) => fromTask(t, p));
  const h = hashId(p.policyId + "act");
  if (p.lastTouch && p.lastTouchChannel === "Telecall") {
    rows.push({
      id: `A-${p.policyId}-v1`,
      policyId: p.policyId,
      at: fromIso(p.lastTouch).toISOString(),
      step: "Collection call",
      executor: h % 2 ? "Call-centre vendor (fixed payout)" : "Call-centre vendor (variable payout)",
      executorKind: "vendor",
      result: p.state === "Promised" ? "Promise to pay with date" : p.reasonCode === "Not reached" ? "Not reachable" : "Callback requested",
      ruleId: "R02",
      workflow: "R2",
      channel: "Voice",
      disposition: p.state === "Promised" ? "Promise to pay with date" : "Callback requested",
      durationSec: 90 + (h % 200),
      language: p.language,
      checks: CHECKS,
    });
  }
  if (p.warmingStation) {
    const st = p.warmingStation;
    rows.push({
      id: `A-${p.policyId}-st`,
      policyId: p.policyId,
      at: addDays(NOW, -((h % 20) + 2)).toISOString(),
      step: `Station ${st} message`,
      executor: "WhatsApp vendor",
      executorKind: "vendor",
      result: "Delivered",
      ruleId: "R07",
      workflow: "W1",
      channel: "WhatsApp",
      language: p.language,
      checks: CHECKS,
    });
  }
  if (p.monthDue?.status === "paid" && p.monthDue.paidOn) {
    rows.push({
      id: `A-${p.policyId}-rc`,
      policyId: p.policyId,
      at: fromIso(p.monthDue.paidOn).toISOString(),
      step: "Receipt matched",
      executor: "Payment and collection file",
      executorKind: "system",
      result: p.monthDue.branchPayment ? "Paid at branch" : "Paid",
      channel: "Payment",
      workflow: "X2",
    });
  }
  if (p.reasonCode === "Mandate bounce" || p.reasonCode === "Mandate failed") {
    rows.push({
      id: `A-${p.policyId}-bn`,
      policyId: p.policyId,
      at: new Date(NOW.getTime() - ((h % 6) + 1) * DAY_MS).toISOString(),
      step: p.reasonCode === "Mandate bounce" ? "Bounce in file" : "Mandate rejected",
      executor: "Bounce file",
      executorKind: "system",
      result: p.reasonCode === "Mandate bounce" ? "Insufficient funds" : "Rejected by bank",
      channel: "File",
      workflow: "R4",
    });
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export interface PaymentRow {
  date: string;
  kind: "Receipt" | "Bounce" | "Mandate";
  amount?: number | undefined;
  detail: string;
}

/** Receipts, bounces and mandate history derived from the seeded policy. */
export function paymentHistory(p: Policy): PaymentRow[] {
  const out: PaymentRow[] = [];
  const issue = fromIso(p.issueDate);
  const years = Math.min(3, Math.floor(p.monthsSinceIssue / 12));
  for (let y = 0; y <= years; y++) {
    const d = new Date(Date.UTC(issue.getUTCFullYear() + y, issue.getUTCMonth(), issue.getUTCDate()));
    if (d < NOW && (!p.lapseDate || d < fromIso(p.lapseDate))) out.push({ date: d.toISOString(), kind: "Receipt", amount: p.instalmentAmount, detail: `${p.paymentMethod}, instalment received` });
  }
  if (p.monthDue?.paidOn) out.push({ date: fromIso(p.monthDue.paidOn).toISOString(), kind: "Receipt", amount: p.monthDue.amount, detail: p.monthDue.branchPayment ? "Paid at branch" : "Receipt matched" });
  if (p.reasonCode === "Mandate bounce") out.push({ date: new Date(NOW.getTime() - 3 * DAY_MS).toISOString(), kind: "Bounce", amount: p.instalmentAmount, detail: "Insufficient funds" });
  if (p.paymentMethod === "NACH/ECS mandate" || p.paymentMethod === "UPI autopay") {
    out.push({ date: addDays(issue, 10).toISOString(), kind: "Mandate", detail: `${p.paymentMethod} registered` });
    if (p.reasonCode === "Mandate failed") out.push({ date: new Date(NOW.getTime() - 5 * DAY_MS).toISOString(), kind: "Mandate", detail: "Rejected by bank" });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function attemptsUsed(p: Policy): number {
  return Math.min(4, (TASKS_BY_POLICY.get(p.policyId) ?? []).filter((t) => t.agentId === "renewal-voice" || t.agentId === "message").length);
}
