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
  // Renewal call, pre-due (T-90). Structure from the insurer's telecaller script: greeting and
  // identification, purpose and permission, recording line, policy facts, ask the promise, date and mode.
  {
    id: "early-low-en", nodes: ["early"], name: "Pre-due renewal call (Low propensity)", channel: "Voice", when: ["Low propensity"], language: "English", version: 3, approvals: OK,
    text: "Good morning, this is {agent} calling on behalf of Sample Life Insurance. May I speak to {name}? This call is about your policy with us; is this a good time to talk? Before I go ahead, this call is recorded for quality and training. Your policy {policy}, {plan}, has a premium of {premium} due on {due}. Your due date is coming up, so we request you to pay on time and keep enjoying the benefits of your policy. May I confirm that you will pay by the due date? On which date, and by which mode: online, on the Sample Life app, or a cheque at a branch? I can also send a secure payment link on WhatsApp right now, and you can register auto-debit so future premiums are never missed.",
  },
  {
    id: "early-low-hi", nodes: ["early"], name: "Pre-due renewal call (Low propensity)", channel: "Voice", when: ["Low propensity"], language: "Hindi", version: 3, approvals: OK,
    text: "Namaste, main {agent}, Sample Life Insurance ki taraf se baat kar rahi hoon. Kya meri baat {name} ji se ho rahi hai? Yeh call aapki policy ke baare mein hai; kya abhi baat karne ka sahi samay hai? Aage badhne se pehle bata doon, yeh call quality aur training ke liye record ho rahi hai. Aapki policy {policy}, {plan}, ka premium {premium} {due} ko due hai. Due date paas aa rahi hai, isliye aapse request hai ki premium samay par bharein taaki policy ke saare fayde jaari rahein. Kya aap due date tak premium bhar denge? Kis tareekh ko, aur kis mode se: online, Sample Life app se, ya branch mein cheque se? Main abhi WhatsApp par payment link bhej sakti hoon, aur aage ke premium ke liye auto-debit bhi lag sakta hai.",
  },
  {
    id: "elink-en", nodes: ["elink"], name: "Payment link after the call", channel: "WhatsApp", when: [], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, thank you for speaking with us. As discussed on the call, here is your secure link to pay {premium} for your {plan}, policy {policy}: {pay_link}. Paying on time keeps your life cover and benefits without a break. For help, call {helpline}.",
  },
  {
    id: "elink-hi", nodes: ["elink"], name: "Payment link after the call", channel: "WhatsApp", when: [], language: "Hindi", version: 2, approvals: OK,
    text: "Namaste {first} ji, baat karne ke liye dhanyavaad. Call par jaisa tay hua, {plan} (policy {policy}) ka premium {premium} bharne ka surakshit link: {pay_link}. Samay par bharne se aapka life cover aur saare fayde jaari rehte hain. Madad ke liye {helpline} par call karein.",
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
    id: "link15-default", nodes: ["link15", "link7"], name: "Premium due, payment link", channel: "WhatsApp", when: [], language: "English", version: 4, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due on {due}. Pay on time to keep your life cover and benefits without a break: {pay_link}. You can also pay and manage your policy on the Sample Life app: {app_link}. For help, call {helpline}. Thank you for choosing Sample Life Insurance.",
  },
  {
    id: "link15-hi", nodes: ["link15", "link7"], name: "Premium due, payment link", channel: "WhatsApp", when: [], language: "Hindi", version: 4, approvals: OK,
    text: "Namaste {first} ji, aapke {plan} ka premium {premium} {due} ko due hai. Samay par bharein taaki life cover aur fayde bina rukawat jaari rahein: {pay_link}. Sample Life app par bhi bhar sakte hain: {app_link}. Madad ke liye {helpline}.",
  },
  {
    id: "link15-low-en", nodes: ["link15"], name: "Premium due, link and help options (Low propensity)", channel: "WhatsApp", when: ["Low propensity"], language: "English", version: 3, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due on {due}. Keep your family's cover of {sum_assured} going: pay here {pay_link}. Short this month? Reply HELP and we will call you with options, such as a date within the grace period or a monthly mode.",
  },
  {
    id: "link15-med-en", nodes: ["link15"], name: "Premium due, payment link (Medium propensity)", channel: "WhatsApp", when: ["Medium propensity"], language: "English", version: 3, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due on {due}. Pay on time to keep your life cover and benefits without a break: {pay_link}. Manage your policy on the Sample Life app: {app_link}. For help, call {helpline}.",
  },
  {
    id: "link15-high-en", nodes: ["link15"], name: "One-tap link and auto-debit (High propensity)", channel: "WhatsApp", when: ["High propensity"], language: "English", version: 3, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due on {due}. Pay in one tap: {pay_link}. Make future payments worry-free: register auto-debit for no missed dates and continuous cover: {mandate_link}.",
  },
  {
    id: "link2-default", nodes: ["link15b"], name: "Second reminder with the link", channel: "WhatsApp", when: [], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, a reminder that {premium} for your {plan} is due on {due}. Your link is still open: {pay_link}. Reply CALL if you would like us to call you.",
  },
  {
    id: "link2-med-en", nodes: ["link15b"], name: "Second reminder, what is at stake (Medium propensity)", channel: "WhatsApp", when: ["Medium propensity"], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, your premium of {premium} for policy {policy} is due on {due}. If it is not paid by the end of the grace period, your cover of {sum_assured} stops and the benefits reduce. Pay now: {pay_link}. Reply CALL and we will call you.",
  },
  {
    id: "link2-low-en", nodes: ["link15b"], name: "Second reminder, what is at stake (Low propensity)", channel: "WhatsApp", when: ["Low propensity"], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, your premium of {premium} is due on {due}. If it is missed after the grace period, the cover of {sum_assured} stops and the benefits reduce. Pay now: {pay_link}. Reply CALL and we will call you.",
  },
  {
    id: "link2-high-en", nodes: ["link15b"], name: "Second reminder, short (High propensity)", channel: "WhatsApp", when: ["High propensity"], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, a quick reminder: {premium} for your {plan} is due on {due}. Your link is still open: {pay_link}.",
  },
  {
    id: "t0-default", nodes: ["t0"], name: "Due-date reminder with link", channel: "WhatsApp", when: [], language: "English", version: 2, approvals: OK,
    text: "Hi {first}, your {plan} premium of {premium} is due today. Pay now to keep your cover and benefits without a break: {pay_link}.",
  },
  // Reminder call, T-15. Same telecaller structure, shorter, after the WhatsApp messages went unpaid.
  {
    id: "call15-default", nodes: ["call15", "s3call", "s2call"], name: "Reminder call", channel: "Voice", when: [], language: "English", version: 4, approvals: OK,
    text: "Good afternoon, this is {agent} calling on behalf of Sample Life Insurance. May I speak to {name}? This call is recorded for quality and training. Your policy {policy}, {plan}, has a premium of {premium} due on {due}. We sent you the payment link on WhatsApp. May I confirm the date you will pay, and the mode? I can send the link again right now.",
  },
  {
    id: "call15-med-en", nodes: ["call15", "s2call"], name: "Reminder call after WhatsApp (Medium propensity)", channel: "Voice", when: ["Medium propensity"], language: "English", version: 3, approvals: OK,
    text: "Good afternoon, this is {agent} calling on behalf of Sample Life Insurance. May I speak to {name}? This call is recorded for quality and training. We sent you two WhatsApp reminders for policy {policy}, {plan}. Your premium of {premium} is due on {due}, and paying on time keeps your cover and benefits running. May I confirm the date you will pay and the mode: online, the app, or a cheque at a branch? I can send the secure link again right now.",
  },
  {
    id: "call15-low-en", nodes: ["call15", "s3call", "s2call"], name: "Reminder call, firm ask (Low propensity)", channel: "Voice", when: ["Low propensity"], language: "English", version: 5, approvals: OK,
    text: "Good afternoon, this is {agent} calling on behalf of Sample Life Insurance. May I speak to {name}? This call is recorded for quality and training. Your premium of {premium} for policy {policy} is due on {due}, and your family's cover of {sum_assured} depends on it. On which date will you pay? If the full amount is hard this month, you can pay within the grace period with no extra charge, or change to a monthly mode.",
  },
  {
    id: "call15-farmer", nodes: ["call15", "early"], name: "Renewal call, farmer", channel: "Voice", when: ["Farmer"], language: "Hindi", version: 2, approvals: OK,
    text: "Namaste {first} ji, aapki policy {policy} lambe samay ke liye guaranteed fayde deti hai aur aapke parivaar aur aapki kheti dono ko suraksha deti hai. Premium {premium} {due} ko due hai. Kab bharenge? Main link bhej sakti hoon, ya branch mein cheque se bhi bhar sakte hain.",
  },
  // When the customer is not convinced: the mis-selling rebuttal, then the product explanation call.
  {
    id: "explain-trad", nodes: ["explain", "explain1", "explain2"], name: "Not convinced: explain the benefits, traditional", channel: "Voice", when: ["Traditional"], language: "English", version: 3, approvals: OK,
    text: "It may be that you did not get complete information when you bought the policy; the details are also in your welcome call and policy document. Please give me two minutes to explain. Your {plan} gives your family life cover of {sum_assured}. Bonuses are added every year the premium is paid, and the maturity benefit is paid at the end of the term. You get a tax benefit on this year's premium and can take a loan against the policy. If the premium is not paid by the end of the grace period, the cover stops and the benefits reduce. Paying within the grace period costs nothing extra.",
  },
  {
    id: "explain-ulip", nodes: ["explain", "explain1", "explain2"], name: "Not convinced: explain the benefits, ULIP", channel: "Voice", when: ["ULIP"], language: "English", version: 3, approvals: { marketing: "Approved", compliance: "Approved", legal: "In review" },
    text: "It may be that you did not get complete information when you bought the policy; please give me two minutes to explain. Your {plan} does two jobs: life cover of {sum_assured} for your family, and your premium invested in the funds you chose. If a premium is missed, your money moves to the discontinued fund and stops growing with your funds, and the life cover stops. When you pay, the discontinuance charges are added back to your fund. If the full amount is hard, you can change to a monthly or quarterly mode.",
  },
  // Grace Period: the post-due script.
  {
    id: "rehit-default", nodes: ["rehit"], name: "Grace Period call", channel: "Voice", when: [], language: "English", version: 4, approvals: OK,
    text: "Good morning, this is {agent} calling on behalf of Sample Life Insurance. May I speak to {name}? This call is recorded for quality and training. Your premium of {premium} was due on {due}, so we request you to pay within the grace period, until {grace_end}, to keep enjoying the benefits of your policy. Paying online is quickest; I can send the link now. I would also suggest auto-debit so future premiums go through on time.",
  },
  {
    id: "rehit-low-en", nodes: ["rehit"], name: "Grace Period call, firm (Low propensity)", channel: "Voice", when: ["Low propensity"], language: "English", version: 3, approvals: OK,
    text: "Good morning, this is {agent} calling on behalf of Sample Life Insurance. May I speak to {name}? This call is recorded for quality and training. Your premium of {premium} was due on {due}. The policy is in its grace period until {grace_end}; paying before then costs nothing extra, and after that the cover stops. May I send the link now, or would a monthly mode help?",
  },
  {
    id: "rehit-low-hi", nodes: ["rehit"], name: "Grace Period call, firm (Low propensity)", channel: "Voice", when: ["Low propensity"], language: "Hindi", version: 3, approvals: OK,
    text: "Namaste, main {agent}, Sample Life Insurance ki taraf se. Call record ho rahi hai. Aapka premium {premium} {due} ko due tha. Policy {grace_end} tak grace period mein hai; tab tak bharne par koi extra charge nahi, uske baad cover band ho jayega. Kya main abhi link bhej doon, ya monthly mode dekhein?",
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
  band: "Low propensity" | "Medium propensity" | "High propensity" | "Unscored";
  segment: string[];
  product: string;
  language: "English" | "Hindi";
}

/** The variant a step uses for this customer: the most specific approved match wins. */
export function pickScript(nodeId: string, ctx: ScriptContext): ScriptVariant | undefined {
  const pool = SCRIPT_LIBRARY.filter((s) => s.nodes.includes(nodeId));
  if (!pool.length) return undefined;
  const tags = new Set([ctx.band, ...ctx.segment, ctx.product]);
  const score = (s: ScriptVariant) => (s.when.some((w) => !tags.has(w)) ? -1 : s.when.length * 10 + (s.language === ctx.language ? 5 : 0));
  return [...pool].sort((a, b) => score(b) - score(a)).find((s) => score(s) >= 0);
}

export function fillScript(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/** Why this variant was chosen, in words: "Low propensity · Hindi". */
export function scriptRule(v: ScriptVariant): string {
  return [...(v.when.length ? v.when : ["Everyone"]), v.language].join(" · ");
}
