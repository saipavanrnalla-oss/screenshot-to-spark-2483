/**
 * Approved scripts and message templates used by the agents in the 13th and 25th month workflows.
 * Wording is generic, written for the fictional insurer. Every item carries a variant key so one
 * workflow step can say different things to different customers (band, segment, product, language).
 */

export type ScriptChannel = "Voice" | "WhatsApp" | "Brief";
export type Approval = "Approved" | "In review" | "Draft";

export interface ScriptVariant {
  id: string;
  /** Workflow step ids this text is used on. */
  nodes: string[];
  name: string;
  channel: ScriptChannel;
  /** Who it is for, in words: "Low propensity", "Senior citizen", "ULIP", "Hindi". Empty = everyone. */
  when: string[];
  language: "English" | "Hindi";
  text: string;
  approvals: { marketing: Approval; compliance: Approval; legal: Approval };
  version: number;
}

const OK = { marketing: "Approved", compliance: "Approved", legal: "Approved" } as const;

export const SCRIPT_LIBRARY: ScriptVariant[] = [
  // Early service call, T-90, low propensity
  {
    id: "early-low-en", nodes: ["early"], name: "Early service call", channel: "Voice", when: ["Low propensity"], language: "English", version: 3, approvals: OK,
    text: "Good morning, this is {agent} calling from Sample Life Insurance about your policy {policy}. This call is recorded for quality and training. Your next premium of {premium} is due on {due}. Before then, may I confirm an alternate number, your nominee, and whether you would like the premium to go by auto-debit? When do you plan to pay, and would you like a payment link or a visit from your advisor?",
  },
  {
    id: "early-low-hi", nodes: ["early"], name: "Early service call", channel: "Voice", when: ["Low propensity"], language: "Hindi", version: 3, approvals: OK,
    text: "Namaste, main {agent}, Sample Life Insurance se, aapki policy {policy} ke baare mein baat kar rahi hoon. Yeh call quality ke liye record ho rahi hai. Aapka agla premium {premium} {due} ko due hai. Kya main aapka alternate number aur nominee confirm kar loon, aur kya aap auto-debit lagwana chahenge? Aap kab aur kis mode se pay karenge, link bhejoon ya advisor ko bhejoon?",
  },
  // Templates T-60, T-45, T-30, T-15, T-0
  {
    id: "t60-default", nodes: ["t60"], name: "Value of the policy and the app", channel: "WhatsApp", when: [], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, your {plan} is building a secure future for you and your family. Track your policy and fund value any time on the Sample Life app: {app_link}. Opt out: {opt_out}",
  },
  {
    id: "t60-senior", nodes: ["t60"], name: "Value of the policy, senior citizen", channel: "WhatsApp", when: ["Senior citizen"], language: "English", version: 2, approvals: OK,
    text: "Dear {first}, your {plan} protects your loved ones and keeps your savings growing. Market ups and downs are normal; your plan is built for the long term. Manage it easily on the Sample Life app: {app_link}. Opt out: {opt_out}",
  },
  {
    id: "t60-self", nodes: ["t60"], name: "Value of the policy, self-employed", channel: "WhatsApp", when: ["Self-employed"], language: "English", version: 2, approvals: OK,
    text: "Dear {first}, your {plan} is key to your long-term goals and your family's future. Stay invested for continuous protection. A small step today, a better tomorrow. Explore your benefits on the Sample Life app: {app_link}. Opt out: {opt_out}",
  },
  {
    id: "t60-ulip", nodes: ["t60"], name: "Value of the policy, ULIP", channel: "WhatsApp", when: ["ULIP"], language: "English", version: 1, approvals: { marketing: "Approved", compliance: "In review", legal: "Approved" },
    text: "Hi {first}, your {plan} (UIN {uin}, policy {policy}) protects your family and grows with the market. Paying every premium keeps your money invested in the funds you chose. Track your fund on the Sample Life app: {app_link}. T&C apply. Reply STOP to unsubscribe.",
  },
  {
    id: "t45-default", nodes: ["t45", "s2wa"], name: "Update nominee and alternate contact", channel: "WhatsApp", when: [], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, for your {plan} you can update your nominee and an alternate contact number in two minutes on the Sample Life app: {app_link}. For help call {helpline}.",
  },
  {
    id: "rpn-default", nodes: ["rpn"], name: "Renewal Premium Notice", channel: "WhatsApp", when: [], language: "English", version: 4, approvals: OK,
    text: "Renewal Premium Notice. Policy {policy}, {plan}. Premium {premium} due on {due}. Pay online, through the app, or at any branch. Policies on auto-debit will be debited on the due date; please keep the balance ready.",
  },
  {
    id: "link15-default", nodes: ["link15", "link7"], name: "Premium due, payment link, autopay nudge", channel: "WhatsApp", when: [], language: "English", version: 3, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due on {due}. Pay in one tap: {pay_link}. Set up auto-debit so you never miss a date: {mandate_link}. Help: {helpline}.",
  },
  {
    id: "link15-hi", nodes: ["link15", "link7"], name: "Premium due, payment link, autopay nudge", channel: "WhatsApp", when: [], language: "Hindi", version: 3, approvals: OK,
    text: "Namaste {first} ji, aapke {plan} ka premium {premium} {due} ko due hai. Ek tap mein bharein: {pay_link}. Auto-debit lagwayein taaki koi date na chhoote: {mandate_link}.",
  },
  {
    id: "t0-default", nodes: ["t0"], name: "Due-date reminder with link", channel: "WhatsApp", when: [], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due today. Pay now to keep your cover and benefits without a break: {pay_link}.",
  },
  // Reminder call T-15
  {
    id: "call15-low", nodes: ["call15", "s3call", "s2call"], name: "Reminder call, firm ask", channel: "Voice", when: ["Low propensity"], language: "English", version: 4, approvals: OK,
    text: "Hello {first}, this is {agent} from Sample Life Insurance about policy {policy}. The call is recorded. Your premium of {premium} is due on {due}. On which date will you pay, and by which mode? I can send a link right now, or ask your advisor to collect a cheque.",
  },
  {
    id: "call15-high", nodes: ["call15", "s2call"], name: "Reminder call, light touch", channel: "Voice", when: ["High propensity"], language: "English", version: 4, approvals: OK,
    text: "Hello {first}, this is {agent} from Sample Life Insurance. The call is recorded. A quick reminder that your premium of {premium} is due on {due}. You can pay online, on the app, or through the link I can send now. Thank you for staying with us.",
  },
  {
    id: "call15-farmer", nodes: ["call15", "early"], name: "Reminder call, farmer", channel: "Voice", when: ["Farmer"], language: "Hindi", version: 2, approvals: OK,
    text: "Namaste {first} ji, aapki policy {policy} aapke parivaar aur aapki kheti dono ko suraksha deti hai. Premium {premium} {due} ko due hai. Kab bharenge? Main link bhej sakti hoon, ya branch mein cash ya cheque se bhi bhar sakte hain.",
  },
  // Product explanation, when the customer asks
  {
    id: "explain-trad", nodes: ["explain"], name: "Product explanation, traditional", channel: "Voice", when: ["Traditional"], language: "English", version: 2, approvals: OK,
    text: "Your {plan} gives life cover of {sum_assured} and guaranteed benefits at maturity. Bonuses are added each year the premium is paid. If a premium is missed after the grace period, cover stops and the benefits reduce. You also get a tax benefit for the premium you pay this year.",
  },
  {
    id: "explain-ulip", nodes: ["explain"], name: "Product explanation, ULIP", channel: "Voice", when: ["ULIP"], language: "English", version: 2, approvals: { marketing: "Approved", compliance: "Approved", legal: "In review" },
    text: "Your {plan} does two jobs: life cover of {sum_assured}, and your premium invested in the funds you chose. Returns depend on the market and are best judged over many years. If a premium is missed, the money moves to the discontinued fund and stops growing with your funds, and life cover stops. Paying now keeps both running.",
  },
  // Grace and lapse
  {
    id: "rehit-default", nodes: ["rehit"], name: "Grace Period reminder call", channel: "Voice", when: [], language: "English", version: 3, approvals: OK,
    text: "Hello {first}, this is {agent} from Sample Life Insurance. Your premium of {premium} was due on {due}. Your policy is in its grace period until {grace_end}; paying before then keeps your cover with no extra charge. May I send the link now?",
  },
  {
    id: "fund-default", nodes: ["fund"], name: "Keep funds for the debit", channel: "Voice", when: [], language: "English", version: 2, approvals: OK,
    text: "Hello {first}, {premium} for policy {policy} will be debited from your account on {due}. Please keep the balance ready so your cover continues without a break.",
  },
  {
    id: "bounce-default", nodes: ["bounce"], name: "Debit did not go through", channel: "Voice", when: [], language: "English", version: 2, approvals: OK,
    text: "Hello {first}, the auto-debit of {premium} for policy {policy} did not go through. There is no charge for this. I can send a payment link now, or we can try the debit again on a date that suits you.",
  },
  {
    id: "sales-brief", nodes: ["sales", "brief", "s3brief"], name: "Brief to the advisor or branch", channel: "Brief", when: [], language: "English", version: 1, approvals: OK,
    text: "Customer {name}, policy {policy}, premium {premium} due {due}. Status: {status}. Last contact: {last}. Payment link: {pay_link}. Please reach the customer today.",
  },
  {
    id: "s4mand", nodes: ["s4mand"], name: "Mandate check and re-register", channel: "WhatsApp", when: [], language: "English", version: 1, approvals: OK,
    text: "Hi {first}, last year your auto-debit for policy {policy} did not go through. Register e-NACH in two minutes so the next premium goes through on time: {mandate_link}.",
  },
  {
    id: "rpu-msg", nodes: ["rpuMsg"], name: "Reduced paid-up explained", channel: "Voice", when: ["Traditional"], language: "English", version: 1, approvals: { marketing: "Approved", compliance: "In review", legal: "Draft" },
    text: "Your policy has moved to reduced paid-up: cover continues at a lower sum assured and no further bonuses are added. You can restart full cover by paying the due premium within the revival window.",
  },
];

export interface ScriptContext {
  band: "Low propensity" | "High propensity" | "Unscored";
  segment: string[];
  product: string;
  language: "English" | "Hindi";
}

/** The variant a step uses for this customer: the most specific approved match wins. */
export function pickScript(nodeId: string, ctx: ScriptContext): ScriptVariant | undefined {
  const pool = SCRIPT_LIBRARY.filter((s) => s.nodes.includes(nodeId));
  if (!pool.length) return undefined;
  const tags = new Set([ctx.band, ...ctx.segment, ctx.product]);
  const score = (s: ScriptVariant) => {
    if (s.when.some((w) => !tags.has(w))) return -1;
    return s.when.length * 10 + (s.language === ctx.language ? 5 : 0);
  };
  return [...pool].sort((a, b) => score(b) - score(a)).find((s) => score(s) >= 0);
}

export function fillScript(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}
