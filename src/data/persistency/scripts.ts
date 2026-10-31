import type { Product, ReasonCode } from "./types";

/** Product-specific call wording. Chosen by rules, never by a model. */
export const SCRIPTS: Record<Product, { opening: string; value: string; ask: string }> = {
  ULIP: {
    opening: "Namaste, this is a call from Sample Life Insurance about your ULIP policy {policy}.",
    value: "Your premium keeps your fund invested and your life cover active. Missing it during the lock-in period can stop fund growth and reduce cover.",
    ask: "Your premium of {amount} was due on {due}. Can I send you a payment link now, or would you like to set up autopay?",
  },
  Traditional: {
    opening: "Namaste, this is a call from Sample Life Insurance about your savings policy {policy}.",
    value: "Paying on time keeps your bonuses and guaranteed benefits intact.",
    ask: "Your premium of {amount} was due on {due}. Would you like to pay by link, or should our branch officer visit to collect a cheque?",
  },
  Term: {
    opening: "Namaste, this is a short call from Sample Life Insurance about your term cover {policy}.",
    value: "Your family stays protected only while the premium is paid.",
    ask: "Your premium of {amount} is due on {due}. I can send a one-tap payment link on WhatsApp. Shall I?",
  },
};

export const OBJECTIONS: { key: ReasonCode; label: string; reply: string }[] = [
  { key: "Money problem", label: "Money problem", reply: "Offer a change to a quarterly or monthly mode, or a later date within grace. Do not promise a waiver unless an approved offer applies." },
  { key: "Forgot", label: "Forgot", reply: "Send the payment link while on the call and offer autopay setup so it does not happen again." },
  { key: "Lost interest", label: "Lost interest", reply: "Recap what the cover protects and what is lost if it lapses. Do not pressure. Log the reason." },
  { key: "Mis-sold", label: "Mis-sold", reply: "Do not argue. Log as a complaint so outreach stops, and route to the grievance team." },
  { key: "Wants to surrender", label: "Wants to surrender", reply: "Do not continue collection. Route to surrender retention with the reason; they will explain alternatives." },
  { key: "Will pay later", label: "Will pay later", reply: "Ask for a specific date inside grace and record it as a promise. A reminder goes the day before." },
];

export const OUTCOMES = ["Paid on call", "Promised to pay", "Call back later", "Not reached", "Wants to surrender", "Complaint raised"] as const;
export type CallOutcome = (typeof OUTCOMES)[number];

export function fillScript(line: string, vars: Record<string, string>): string {
  return line.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}
