/**
 * Stand-in logic for trying two agents on a single input. The production agents are model-based;
 * these rules give the same shape of output so the screen shows exactly what the agent returns.
 */

export interface ReasonResult {
  disposition: string;
  subDisposition: string;
  reason: string;
  confidence: number;
  evidence: string[];
  nextStep: string;
  stopCalling: boolean;
}

const RULES: { reason: string; disposition: string; sub: string; next: string; stop?: boolean; words: string[] }[] = [
  { reason: "Bereavement", disposition: "Do not call", sub: "Customer expired", next: "Stop all outreach. Hand to the claims team with the policy number.", stop: true, words: ["passed away", "expired", "death", "died", "nahi rahe", "guzar"] },
  { reason: "Mis-selling", disposition: "No intention to pay", sub: "Misselling", next: "Stop collection. Hand to the complaint desk with this transcript; do not argue.", stop: true, words: ["only one year", "pay for 1 year", "ek saal", "one time", "single premium", "told me", "was told", "mis sold", "missold", "galat bataya", "fd", "fixed deposit", "cheated"] },
  { reason: "Wants to surrender", disposition: "No intention to pay", sub: "Cancelled / surrendered", next: "Hand to surrender retention. Share the fund value and what is lost on surrender.", words: ["surrender", "close the policy", "band karna", "withdraw", "cancel"] },
  { reason: "Financial", disposition: "No intention to pay", sub: "Financial problem", next: "Offer a date inside the grace period or a mode change to monthly. Mode change needs GM approval.", words: ["no money", "paise nahi", "lost my job", "job gone", "salary", "loan", "emi", "school fees", "tight", "can't afford", "cannot afford", "afford", "hospital", "business is down"] },
  { reason: "Product", disposition: "No intention to pay", sub: "Product related issue", next: "Explain the plan benefits from the policy record; share fund value against premium paid. No promise of returns.", words: ["returns", "return", "fund value", "market", "nav", "loss", "not growing", "bonus", "interest"] },
  { reason: "Service", disposition: "Pay upon resolution", sub: "Service related issue", next: "Raise a service ticket; the customer pays once it is resolved. Call back after the fix.", words: ["no receipt", "notice", "policy bond", "document", "address", "branch", "nobody called", "complaint", "update", "nominee", "not received"] },
  { reason: "Already paid", disposition: "Promise to pay", sub: "Will pay by own", next: "Check today's collection file before any further contact.", words: ["already paid", "paid yesterday", "paid last week", "bhar diya", "de diya"] },
  { reason: "Will pay later", disposition: "Promise to pay", sub: "Will pay by own", next: "Record the promised date and send the payment link; remind the day before.", words: ["will pay", "next week", "friday", "monday", "by month end", "salary comes", "bhar dunga", "kar dunga", "send the link", "link bhej"] },
  { reason: "Callback asked", disposition: "Follow-up", sub: "Call later", next: "Schedule the callback at the time the customer asked.", words: ["call later", "call me", "busy", "in a meeting", "baad mein", "driving", "travelling", "out of station"] },
  { reason: "Wrong person", disposition: "Non contact", sub: "Wrong number", next: "End the call without sharing policy details. Send to skip-trace for the registered contact.", stop: true, words: ["wrong number", "don't know", "not my policy", "kaun", "who is"] },
];

export function classifyReason(text: string): ReasonResult {
  const t = text.toLowerCase();
  const hits = RULES.map((r) => ({ r, ev: r.words.filter((w) => t.includes(w)) })).filter((x) => x.ev.length);
  if (!hits.length) {
    return { disposition: "Follow-up", subDisposition: "Customer not available", reason: "Not clear", confidence: 0.35, evidence: [], nextStep: "Low confidence: send to a person to listen to the call before the next attempt.", stopCalling: false };
  }
  hits.sort((a, b) => b.ev.length - a.ev.length || RULES.indexOf(a.r) - RULES.indexOf(b.r));
  const top = hits[0]!;
  const confidence = Math.min(0.97, 0.62 + top.ev.length * 0.12 - (hits.length > 1 ? 0.08 : 0));
  return {
    disposition: top.r.disposition,
    subDisposition: top.r.sub,
    reason: top.r.reason,
    confidence,
    evidence: top.ev,
    nextStep: confidence < 0.6 ? `Low confidence: a person checks. Suggested: ${top.r.next}` : top.r.next,
    stopCalling: !!top.r.stop,
  };
}

export const CLASSIFIER_EXAMPLES = [
  "Customer: Mujhe toh bola tha sirf ek saal bharna hai, ab phir se paise kyun maang rahe ho? Yeh toh FD jaisa bataya tha.",
  "Customer: Abhi paise nahi hain, school fees aur EMI dono is mahine hain. Next month dekhta hoon.",
  "Customer: My fund value is lower than what I paid. The market is up, why are returns so poor?",
  "Customer: I never got the renewal notice or the policy bond. Fix my address first, then I will pay.",
  "Customer: Yes, send the link, I will pay by Friday when the salary comes.",
];

export interface HandoffPacket {
  who: string;
  policy: string;
  whatHappened: string;
  customerSaid: string;
  reasonAndIntent: string;
  recommended: string;
  doNot: string;
}

export function summariseHandoff(text: string, facts: { name: string; policy: string; premium: string; due: string; stage: string; attempts: number }): HandoffPacket {
  const c = classifyReason(text);
  const said = text
    .split(/\n|(?<=[.?!])\s+/)
    .filter((l) => /^customer:/i.test(l.trim()) || !/^agent:/i.test(l.trim()))
    .map((l) => l.replace(/^customer:\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  return {
    who: `${facts.name}, policyholder, verified on the registered number`,
    policy: `${facts.policy} · premium ${facts.premium} · due ${facts.due} · ${facts.stage}`,
    whatHappened: `${facts.attempts} contact attempt${facts.attempts === 1 ? "" : "s"} by the renewal agent; last call answered. Disposition: ${c.disposition}, ${c.subDisposition}.`,
    customerSaid: said ? `"${said.slice(0, 220)}"` : "Nothing clear on the call",
    reasonAndIntent: `${c.reason} (${Math.round(c.confidence * 100)}% sure)${c.evidence.length ? `, from "${c.evidence.join('", "')}"` : ""}`,
    recommended: c.nextStep,
    doNot: c.stopCalling ? "Do not ask for payment on this call; do not promise returns." : "Do not promise returns or waivers that are not approved.",
  };
}
