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
  // Early service call, T-90: P1 to P3 get a firm ask with a visit offer, P4 to P5 a lighter service call
  {
    id: "early-p13-en", nodes: ["early"], name: "Early service call, firm ask (P1 to P3)", channel: "Voice", when: ["P1 to P3"], language: "English", version: 3, approvals: OK,
    text: "Good morning, this is {agent} calling from Sample Life Insurance about your policy {policy}. This call is recorded for quality and training. Your next premium of {premium} is due on {due}. On which date will you pay, and by which mode? I can send a payment link on WhatsApp now, set up auto-debit, or ask your advisor to visit and collect.",
  },
  {
    id: "early-p13-hi", nodes: ["early"], name: "Early service call, firm ask (P1 to P3)", channel: "Voice", when: ["P1 to P3"], language: "Hindi", version: 3, approvals: OK,
    text: "Namaste, main {agent}, Sample Life Insurance se, aapki policy {policy} ke baare mein baat kar rahi hoon. Yeh call quality ke liye record ho rahi hai. Aapka agla premium {premium} {due} ko due hai. Aap kis tareekh ko aur kis mode se bharenge? Main abhi WhatsApp par payment link bhej sakti hoon, auto-debit laga sakti hoon, ya advisor ko collect karne bhej sakti hoon.",
  },
  {
    id: "early-p45-en", nodes: ["early"], name: "Early service call, details check (P4 to P5)", channel: "Voice", when: ["P4 to P5"], language: "English", version: 2, approvals: OK,
    text: "Good morning, this is {agent} from Sample Life Insurance about your policy {policy}. The call is recorded. Your premium of {premium} is due on {due}. May I confirm your alternate number and nominee, and would you like the premium to go by auto-debit so you never miss a date?",
  },
  {
    id: "early-p45-hi", nodes: ["early"], name: "Early service call, details check (P4 to P5)", channel: "Voice", when: ["P4 to P5"], language: "Hindi", version: 2, approvals: OK,
    text: "Namaste, main {agent}, Sample Life Insurance se. Call record ho rahi hai. Aapki policy {policy} ka premium {premium} {due} ko due hai. Kya main aapka alternate number aur nominee confirm kar loon? Kya aap auto-debit lagwana chahenge taaki koi date na chhoote?",
  },
  {
    id: "elink-en", nodes: ["elink"], name: "Payment link after the promise", channel: "WhatsApp", when: [], language: "English", version: 1, approvals: OK,
    text: "Hi {first}, thank you for speaking with us. As promised on the call, here is the link to pay {premium} for your {plan}: {pay_link}. It takes one tap with UPI or card.",
  },
  {
    id: "elink-hi", nodes: ["elink"], name: "Payment link after the promise", channel: "WhatsApp", when: [], language: "Hindi", version: 1, approvals: OK,
    text: "Namaste {first} ji, baat karne ke liye dhanyavaad. Call par jaisa tay hua, {plan} ka premium {premium} bharne ka link: {pay_link}. UPI ya card se ek tap mein.",
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
    id: "link15-low-en", nodes: ["link15"], name: "Payment link with help options (P1 to P5)", channel: "WhatsApp", when: ["Low propensity"], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due on {due}. Keep your family's cover of {sum_assured} going: pay here {pay_link}. Short this month? Reply HELP and we will call you with options, or your advisor can collect a cheque.",
  },
  {
    id: "link15-low-hi", nodes: ["link15"], name: "Payment link with help options (P1 to P5)", channel: "WhatsApp", when: ["Low propensity"], language: "Hindi", version: 2, approvals: OK,
    text: "Namaste {first} ji, {plan} ka premium {premium} {due} ko due hai. Parivaar ka {sum_assured} ka cover jaari rakhein: {pay_link}. Is mahine mushkil hai? HELP likhein, hum options ke saath call karenge, ya advisor cheque le jayenge.",
  },
  {
    id: "link15-high-en", nodes: ["link15"], name: "One-tap payment link (P6 to P10)", channel: "WhatsApp", when: ["High propensity"], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due on {due}. Pay in one tap: {pay_link}. Turn on auto-debit and skip the reminder next year: {mandate_link}.",
  },
  {
    id: "link15-hi", nodes: ["link15", "link7"], name: "Premium due, payment link, autopay nudge", channel: "WhatsApp", when: [], language: "Hindi", version: 3, approvals: OK,
    text: "Namaste {first} ji, aapke {plan} ka premium {premium} {due} ko due hai. Ek tap mein bharein: {pay_link}. Auto-debit lagwayein taaki koi date na chhoote: {mandate_link}.",
  },
  {
    id: "link2-default", nodes: ["link15b"], name: "Second reminder with the link", channel: "WhatsApp", when: [], language: "English", version: 1, approvals: OK,
    text: "Hi {first}, a reminder that {premium} for your {plan} is due on {due}. Your link is still open: {pay_link}. Reply CALL if you would like us to call you.",
  },
  {
    id: "call15-default", nodes: ["call15", "s3call", "s2call"], name: "Reminder call", channel: "Voice", when: [], language: "English", version: 3, approvals: OK,
    text: "Hello {first}, this is {agent} from Sample Life Insurance about policy {policy}. The call is recorded. Your premium of {premium} is due on {due}. When will you be able to pay? I can send the payment link on WhatsApp right away.",
  },
  {
    id: "link2-high-en", nodes: ["link15b"], name: "Second reminder, short (P6 to P10)", channel: "WhatsApp", when: ["High propensity"], language: "English", version: 1, approvals: OK,
    text: "Hi {first}, a quick reminder: {premium} for your {plan} is due on {due}. Your link is still open: {pay_link}.",
  },
  {
    id: "link2-low-en", nodes: ["link15b"], name: "Second reminder, what is at stake (P1 to P5)", channel: "WhatsApp", when: ["Low propensity"], language: "English", version: 1, approvals: OK,
    text: "Hi {first}, your premium of {premium} is due on {due}. If it is missed after the grace period, the cover of {sum_assured} stops and the benefits reduce. Pay now: {pay_link}. Reply CALL and we will call you.",
  },
  {
    id: "link2-low-hi", nodes: ["link15b"], name: "Second reminder, what is at stake (P1 to P5)", channel: "WhatsApp", when: ["Low propensity"], language: "Hindi", version: 1, approvals: OK,
    text: "Namaste {first} ji, premium {premium} {due} ko due hai. Grace period ke baad bhi na bharne par {sum_assured} ka cover band ho jayega. Abhi bharein: {pay_link}. CALL likhein, hum call karenge.",
  },
  {
    id: "t0-default", nodes: ["t0"], name: "Due-date reminder with link", channel: "WhatsApp", when: [], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due today. Pay now to keep your cover and benefits without a break: {pay_link}.",
  },
  // Reminder call T-15
  {
    id: "call15-p13", nodes: ["call15", "s3call"], name: "Reminder call, firm ask with options (P1 to P3)", channel: "Voice", when: ["P1 to P3"], language: "English", version: 2, approvals: OK,
    text: "Hello {first}, this is {agent} from Sample Life Insurance about policy {policy}. The call is recorded. Your premium of {premium} is due on {due}, and your family's cover of {sum_assured} depends on it. On which date will you pay? If the full amount is hard this month, a monthly mode or a date within the grace period is possible.",
  },
  {
    id: "call15-p13-hi", nodes: ["call15", "s3call"], name: "Reminder call, firm ask with options (P1 to P3)", channel: "Voice", when: ["P1 to P3"], language: "Hindi", version: 2, approvals: OK,
    text: "Namaste {first} ji, main {agent}, Sample Life Insurance se, policy {policy} ke baare mein. Call record ho rahi hai. Aapka premium {premium} {due} ko due hai, aur parivaar ka {sum_assured} ka cover isi par tika hai. Aap kis tareekh ko bharenge? Poori rakam is mahine mushkil ho to monthly mode ya grace period ke andar ki tareekh bhi ho sakti hai.",
  },
  {
    id: "call15-low", nodes: ["call15", "s3call", "s2call"], name: "Reminder call, firm ask (P4 to P5)", channel: "Voice", when: ["P4 to P5"], language: "English", version: 4, approvals: OK,
    text: "Hello {first}, this is {agent} from Sample Life Insurance about policy {policy}. The call is recorded. Your premium of {premium} is due on {due}. On which date will you pay, and by which mode? I can send a link right now, or ask your advisor to collect a cheque.",
  },
  {
    id: "call15-high", nodes: ["call15", "s2call"], name: "Reminder call, light touch (P6 to P10)", channel: "Voice", when: ["High propensity"], language: "English", version: 4, approvals: OK,
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
    id: "rehit-low-hi", nodes: ["rehit"], name: "Grace Period call, firm (P1 to P5)", channel: "Voice", when: ["Low propensity"], language: "Hindi", version: 2, approvals: OK,
    text: "Namaste {first} ji, main {agent}, Sample Life Insurance se. Call record ho rahi hai. Aapka premium {premium} {due} ko due tha. Policy {grace_end} tak grace period mein hai; tab tak bharne par koi extra charge nahi. Uske baad cover band ho jayega. Kya main abhi link bhej doon, ya aapke liye monthly mode dekhein?",
  },
  {
    id: "rehit-low-en", nodes: ["rehit"], name: "Grace Period call, firm (P1 to P5)", channel: "Voice", when: ["Low propensity"], language: "English", version: 2, approvals: OK,
    text: "Hello {first}, this is {agent} from Sample Life Insurance. The call is recorded. Your premium of {premium} was due on {due}. The policy is in its grace period until {grace_end}; paying before then costs nothing extra, and after that the cover stops. May I send the link now, or would a monthly mode help?",
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
  /** P1 to P10, when the policy is scored. */
  bandNo?: number | null | undefined;
  segment: string[];
  product: string;
  language: "English" | "Hindi";
}

/** The variant a step uses for this customer: the most specific approved match wins. */
export function pickScript(nodeId: string, ctx: ScriptContext): ScriptVariant | undefined {
  const pool = SCRIPT_LIBRARY.filter((s) => s.nodes.includes(nodeId));
  if (!pool.length) return undefined;
  const range = bandRange(ctx.bandNo);
  const tags = new Set([ctx.band, ...ctx.segment, ctx.product, ...(range ? [range] : [])]);
  const score = (s: ScriptVariant) => {
    if (s.when.some((w) => !tags.has(w))) return -1;
    // A band range is narrower than "Low propensity", so it wins over it.
    return s.when.reduce((a, w) => a + (w.startsWith("P") && w.includes(" to ") ? 12 : 10), 0) + (s.language === ctx.language ? 5 : 0);
  };
  return [...pool].sort((a, b) => score(b) - score(a)).find((s) => score(s) >= 0);
}

export function fillScript(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

export function bandRange(b: number | null | undefined): string | undefined {
  if (b == null) return undefined;
  return b <= 3 ? "P1 to P3" : b <= 5 ? "P4 to P5" : "P6 to P10";
}

/** Why this variant was chosen, in words: "P1 to P3 · Hindi". */
export function scriptRule(v: ScriptVariant): string {
  const who = v.when.map((w) => (w === "Low propensity" ? "P1 to P5" : w === "High propensity" ? "P6 to P10" : w));
  return [...(who.length ? who : ["Everyone"]), v.language].join(" · ");
}
