import { BASE_POLICIES, hashId, NOW, addDays, toIso, type Policy } from "@/data/persistency";
import { branchOf } from "./common";

/** The 24-point call scorecard used on renewal calls. Weights total 100; the Kicker is a bonus. */
export interface QualityParam {
  no: number;
  name: string;
  group: "Business" | "Fatal" | "Soft skill";
  fatal: boolean;
  weight: number;
  meaning: string;
}

export const SCORECARD: QualityParam[] = [
  { no: 1, name: "Greeting and introduction", group: "Business", fatal: false, weight: 4, meaning: "Greets, names the company and self" },
  { no: 2, name: "Right party and verification", group: "Fatal", fatal: true, weight: 3, meaning: "Policyholder confirmed before any policy detail" },
  { no: 3, name: "Language preference", group: "Business", fatal: false, weight: 2, meaning: "Switches to the customer's language" },
  { no: 4, name: "Purpose of the call", group: "Business", fatal: false, weight: 2, meaning: "Says why it is calling" },
  { no: 5, name: "Link to the previous call", group: "Business", fatal: false, weight: 2, meaning: "Refers to the last contact on a follow-up" },
  { no: 6, name: "Policy details given", group: "Fatal", fatal: true, weight: 4, meaning: "Policy number, plan, due date, amount" },
  { no: 7, name: "Payment date and method confirmed", group: "Fatal", fatal: true, weight: 5, meaning: "Promised date and mode read back" },
  { no: 8, name: "Customer query answered", group: "Business", fatal: false, weight: 7, meaning: "Every question answered" },
  { no: 9, name: "Information accuracy", group: "Fatal", fatal: true, weight: 4, meaning: "Only verified facts about the policy" },
  { no: 10, name: "Effective probing", group: "Business", fatal: false, weight: 8, meaning: "Finds the reason for the delay" },
  { no: 11, name: "Creates urgency", group: "Business", fatal: false, weight: 10, meaning: "Explains what is lost if not paid" },
  { no: 12, name: "Objection handling", group: "Fatal", fatal: true, weight: 10, meaning: "Answers the objection with an approved rebuttal" },
  { no: 13, name: "Product benefits pitched", group: "Business", fatal: false, weight: 8, meaning: "Explains benefits when the customer is unsure" },
  { no: 14, name: "Active listening", group: "Soft skill", fatal: false, weight: 2, meaning: "Does not interrupt or repeat questions" },
  { no: 15, name: "Empathy", group: "Soft skill", fatal: false, weight: 2, meaning: "Acknowledges the customer's situation" },
  { no: 16, name: "Fluency and confidence", group: "Soft skill", fatal: false, weight: 4, meaning: "No fillers or jargon that disrupt the call" },
  { no: 17, name: "Tone and pace", group: "Soft skill", fatal: false, weight: 4, meaning: "Tone fits the conversation" },
  { no: 18, name: "Clarity of speech", group: "Soft skill", fatal: false, weight: 4, meaning: "Clear, no talking over the customer" },
  { no: 19, name: "Hold and mute etiquette", group: "Soft skill", fatal: false, weight: 2, meaning: "Asks before hold, thanks after" },
  { no: 20, name: "Personalisation", group: "Soft skill", fatal: false, weight: 2, meaning: "Uses the customer's name and context" },
  { no: 21, name: "No rude or careless behaviour", group: "Fatal", fatal: true, weight: 4, meaning: "No arguing, sarcasm or dropped call" },
  { no: 22, name: "Closing and script adherence", group: "Business", fatal: false, weight: 2, meaning: "Closes politely, offers more help" },
  { no: 23, name: "Disposition and remarks correct", group: "Fatal", fatal: true, weight: 5, meaning: "Disposition matches what was said" },
  { no: 24, name: "Kicker", group: "Business", fatal: false, weight: 0, meaning: "Goes the extra mile and keeps the policy" },
];

export type CallerKind = "AI agent" | "In-house caller" | "Vendor caller";

export interface ScoredCall {
  id: string;
  policy: Policy;
  at: string;
  caller: string;
  callerKind: CallerKind;
  durationSec: number;
  disposition: string;
  /** Pass or fail per parameter number, as the scoring model heard it. */
  ai: Record<number, boolean>;
  aiConfidence: number;
  transcript: { who: "Agent" | "Customer"; text: string }[];
}

const CALLERS: { name: string; kind: CallerKind; skill: number }[] = [
  { name: "Premium Renewal Voice Agent v4", kind: "AI agent", skill: 96 },
  { name: "Premium Renewal Voice Agent v3", kind: "AI agent", skill: 91 },
  { name: "Ritu S. (in-house)", kind: "In-house caller", skill: 88 },
  { name: "Imran K. (in-house)", kind: "In-house caller", skill: 81 },
  { name: "Call-centre vendor, fixed payout", kind: "Vendor caller", skill: 76 },
  { name: "Specialist vendor, variable payout", kind: "Vendor caller", skill: 72 },
];

const DISPOSITIONS = ["Promise to pay", "Will pay by own", "Call later", "Financial problem", "Misselling", "Service related issue", "Not reached"];

function transcriptFor(p: Policy, disp: string, rude: boolean): ScoredCall["transcript"] {
  const first = p.customerName.split(" ")[0];
  const t: ScoredCall["transcript"] = [
    { who: "Agent", text: `Hello, am I speaking with ${p.customerName}? This is a call from Sample Life Insurance about policy ${p.policyId}. The call is recorded.` },
    { who: "Customer", text: "Yes, speaking." },
    { who: "Agent", text: `${first}, your premium of Rs ${p.instalmentAmount.toLocaleString("en-IN")} is due. When will you be able to pay?` },
  ];
  if (disp === "Financial problem") t.push({ who: "Customer", text: "Money is tight this month, I lost some business." }, { who: "Agent", text: rude ? "Everyone says that. You have to pay." : "I understand. Paying within the grace period keeps your cover with no charge. Would a monthly mode help?" });
  else if (disp === "Misselling") t.push({ who: "Customer", text: "I was told I had to pay only once." }, { who: "Agent", text: "I am sorry about that. I will log this and a colleague will call you back today." });
  else if (disp === "Service related issue") t.push({ who: "Customer", text: "I never received my policy bond." }, { who: "Agent", text: "I will raise a request now; you will get it within 7 days." });
  else if (disp === "Call later") t.push({ who: "Customer", text: "I am driving, call me in the evening." }, { who: "Agent", text: "Of course, I will call you at 6 pm." });
  else t.push({ who: "Customer", text: "I will pay this week, send me the link." }, { who: "Agent", text: "Done, the link is on your WhatsApp. Shall I note Friday as the date?" });
  return t;
}

/** Calls of the last 7 days, scored by the model. Deterministic from the policy book. */
export const SCORED_CALLS: ScoredCall[] = BASE_POLICIES.filter((p) => p.touchesLast30d > 0)
  .slice(0, 140)
  .map((p, i) => {
    const h = (s: string) => hashId(p.policyId + s) % 100;
    const caller = CALLERS[h("c") % CALLERS.length]!;
    const disp = DISPOSITIONS[h("d") % DISPOSITIONS.length]!;
    const rude = caller.kind !== "AI agent" && h("rude") < 4;
    const ai: Record<number, boolean> = {};
    // Miss rate per check grows as the caller's skill drops; fatal checks are missed far less often.
    for (const q of SCORECARD) ai[q.no] = q.no === 24 ? h("k") < 12 : q.no === 21 ? !rude : h(`q${q.no}`) >= (100 - caller.skill) * (q.fatal ? 0.12 : 0.6);
    if (disp === "Misselling" && h("disp") < 25) ai[23] = false; // disposition tagged as follow-up instead
    return {
      id: `CALL-${String(10230 + i)}`,
      policy: p,
      at: `${toIso(addDays(NOW, -(h("day") % 7)))}T${String(10 + (h("hr") % 8)).padStart(2, "0")}:${String(h("mn") % 60).padStart(2, "0")}:00Z`,
      caller: caller.name,
      callerKind: caller.kind,
      durationSec: disp === "Not reached" ? 0 : 60 + h("dur") * 3,
      disposition: disp,
      ai,
      aiConfidence: 0.7 + (h("conf") % 28) / 100,
      transcript: disp === "Not reached" ? [{ who: "Agent" as const, text: "No answer after 6 rings." }] : transcriptFor(p, disp, rude),
    };
  })
  .filter((c) => c.disposition !== "Not reached");

export function scoreOf(pass: Record<number, boolean>): { score: number; fatal: boolean; failed: number[] } {
  const failed = SCORECARD.filter((q) => q.no !== 24 && !pass[q.no]).map((q) => q.no);
  const fatal = SCORECARD.some((q) => q.fatal && !pass[q.no]);
  const score = SCORECARD.reduce((a, q) => a + (pass[q.no] ? q.weight : 0), 0);
  return { score: fatal ? 0 : score, fatal, failed };
}

export { branchOf };
