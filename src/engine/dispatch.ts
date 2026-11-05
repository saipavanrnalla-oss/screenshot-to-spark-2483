/**
 * The one place a channel action leaves the prototype. With no address set, every call and message is
 * simulated in the browser. Set VITE_DISPATCH_URL (for example in a .env.local file) and each action is
 * also POSTed there as JSON, so a small script can place the real call or send the real WhatsApp.
 * The contract is in docs/dispatch-contract.md.
 */
import type { DueRow, Handoff } from "@/engine/live-run";

export const DISPATCH_URL: string = (import.meta.env?.["VITE_DISPATCH_URL"] as string | undefined) ?? "";

export interface DispatchPayload {
  policy: string;
  customer: string;
  phone: string;
  language: string;
  step: string;
  channel: string;
  action: string;
  scriptId?: string | undefined;
  text?: string | undefined;
  /** Where the platform should send the result back (disposition, transcript, delivered, read, paid). */
  callback: string;
}

export function payloadOf(row: DueRow, h: Handoff): DispatchPayload {
  return {
    policy: row.policy,
    customer: row.name,
    phone: row.phone,
    language: row.language,
    step: h.at,
    channel: h.channel ?? "System",
    action: h.action,
    scriptId: h.scriptId,
    text: h.text,
    callback: `/api/runs/${row.policy}/result`,
  };
}

/** Fire and forget. A failed POST never stops the demo; the simulated result is still shown. */
export function dispatch(row: DueRow, list: Handoff[]): void {
  if (!DISPATCH_URL || typeof fetch === "undefined") return;
  for (const h of list) {
    void fetch(DISPATCH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadOf(row, h)) }).catch(() => undefined);
  }
}
