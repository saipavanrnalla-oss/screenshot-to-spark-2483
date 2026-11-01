import { Rng } from "./rng";
import { NOW, addDays, addMonths, diffDays, monthsBetween, toIso } from "./dates";
import {
  BANK_PARTNERS,
  CITIES,
  EARLY_LAPSE_MAX_DAYS,
  FIRST_NAMES,
  GRACE_DAYS,
  LAST_NAMES,
  WARMING_STATIONS,
} from "./reference";
import { bandFor, scorePolicy } from "./scorecard";
import {
  INSTALMENTS_PER_YEAR,
  type AdvisorStatus,
  type Channel,
  type CustomerProfile,
  type InsurerCohort,
  type MonthDue,
  type PaymentMethod,
  type PaymentMode,
  type Policy,
  type PolicyState,
  type Product,
  type ReasonCode,
  type RulesCohort,
  type Stage,
} from "./types";

export const SEED = 20261028;
export const POLICY_COUNT = 12_000;

const LAPSED_SHARE = 0.18;
const EARLY_SHARE_OF_LAPSED = 10 / 18;
const SOURCING_SHARE_OF_INFORCE = 6 / 82;

const MODE_BY_PRODUCT: Record<Product, [PaymentMode, number][]> = {
  ULIP: [["Annual", 55], ["Half-yearly", 20], ["Quarterly", 10], ["Monthly", 15]],
  Traditional: [["Annual", 40], ["Half-yearly", 20], ["Quarterly", 15], ["Monthly", 25]],
  Term: [["Annual", 60], ["Half-yearly", 5], ["Quarterly", 5], ["Monthly", 30]],
};
const CHANNEL_BY_PRODUCT: Record<Product, [Channel, number][]> = {
  ULIP: [["Bancassurance", 45], ["Agency", 35], ["Online", 10], ["Direct", 10]],
  Traditional: [["Agency", 55], ["Bancassurance", 30], ["Direct", 10], ["Online", 5]],
  Term: [["Online", 50], ["Agency", 20], ["Bancassurance", 20], ["Direct", 10]],
};
const METHOD_BY_CHANNEL: Record<Channel, [PaymentMethod, number][]> = {
  Bancassurance: [["NACH/ECS mandate", 45], ["Bank branch", 30], ["UPI autopay", 15], ["Credit card SI", 5], ["Cash/cheque", 5]],
  Agency: [["NACH/ECS mandate", 35], ["Cash/cheque", 30], ["UPI autopay", 15], ["Credit card SI", 10], ["Bank branch", 10]],
  Online: [["UPI autopay", 40], ["Credit card SI", 35], ["NACH/ECS mandate", 25]],
  Direct: [["NACH/ECS mandate", 40], ["UPI autopay", 25], ["Credit card SI", 15], ["Cash/cheque", 15], ["Bank branch", 5]],
};

function premiumFor(rng: Rng, product: Product): number {
  const u = rng.next();
  let v: number;
  if (product === "ULIP") v = 50_000 + (1_000_000 - 50_000) * Math.pow(u, 2.6);
  else if (product === "Traditional") v = 25_000 + (300_000 - 25_000) * Math.pow(u, 1.8);
  else v = 8_000 + (80_000 - 8_000) * Math.pow(u, 1.5);
  return Math.round(v / 500) * 500;
}

function graceDaysFor(mode: PaymentMode): number {
  return mode === "Monthly" ? GRACE_DAYS.Monthly : GRACE_DAYS.other;
}

/** Latent risk used only to decide who lapses; built without policy age. */
function latentRisk(p: {
  paymentMode: PaymentMode;
  paymentMethod: PaymentMethod;
  channel: Channel;
  customerProfile: CustomerProfile;
  advisorStatus: AdvisorStatus;
  priorLatePayments: number;
  annualisedPremium: number;
  product: Product;
}): number {
  let r = 0;
  r += { Monthly: 0.6, Quarterly: 0.35, "Half-yearly": 0.15, Annual: 0 }[p.paymentMode];
  r += { "Cash/cheque": 0.7, "Bank branch": 0.4, "Credit card SI": 0.2, "UPI autopay": 0.15, "NACH/ECS mandate": 0 }[p.paymentMethod];
  r += { Bancassurance: 0.25, Online: 0.15, Agency: 0.1, Direct: 0 }[p.channel];
  r += { "Self-employed": 0.2, NRI: 0.15, Senior: 0.1, Salaried: 0, HNI: -0.2 }[p.customerProfile];
  r += { Left: 0.6, Inactive: 0.3, Active: 0 }[p.advisorStatus];
  r += p.priorLatePayments * 0.15;
  const lowTicket = p.product === "ULIP" ? p.annualisedPremium < 90_000 : p.product === "Traditional" ? p.annualisedPremium < 50_000 : p.annualisedPremium < 15_000;
  if (lowTicket) r += 0.1;
  return r;
}

function instalmentStepMonths(mode: PaymentMode): number {
  return 12 / INSTALMENTS_PER_YEAR[mode];
}

function stationFor(daysToDue: number): number {
  // Latest station already passed for this due date.
  let station = 1;
  for (const s of WARMING_STATIONS) if (-daysToDue >= s.dayOffset) station = s.n;
  return station;
}

export function generatePolicies(): Policy[] {
  const rng = new Rng(SEED);
  type Draft = Omit<
    Policy,
    | "lifecycleStage"
    | "state"
    | "issueDate"
    | "monthsSinceIssue"
    | "dueDate"
    | "graceEnd"
    | "instalmentsPaid"
    | "policyYear"
    | "insurerCohort"
    | "rulesCohort"
    | "starterScore"
    | "starterBand"
    | "lastTouch"
    | "lastTouchChannel"
    | "touchesLast30d"
    | "reasonCode"
    | "assignedVendor"
    | "graceDays"
    | "lapseDate"
    | "lapseMonth"
    | "warmingStation"
    | "monthDue"
    | "revivedOn"
  > & { noise: number };

  const drafts: Draft[] = [];
  for (let i = 0; i < POLICY_COUNT; i++) {
    const product = rng.weighted<Product>([["ULIP", 50], ["Traditional", 35], ["Term", 15]]);
    const paymentMode = rng.weighted(MODE_BY_PRODUCT[product]);
    const channel = rng.weighted(CHANNEL_BY_PRODUCT[product]);
    const paymentMethod = rng.weighted(METHOD_BY_CHANNEL[channel]);
    const annualisedPremium = premiumFor(rng, product);
    const cityRef = rng.weighted(CITIES.map((c) => [c, c.weight] as const));
    const language = rng.weighted(cityRef.languages);
    const customerProfile: CustomerProfile =
      annualisedPremium >= 500_000 && rng.chance(0.6)
        ? "HNI"
        : rng.weighted<CustomerProfile>([["Salaried", 50], ["Self-employed", 25], ["Senior", 10], ["HNI", 4], ["NRI", 7]]);
    const advisorStatus: AdvisorStatus =
      channel === "Online"
        ? "Active"
        : rng.weighted<AdvisorStatus>([["Active", 70], ["Inactive", 18], ["Left", 12]]);
    const priorLatePayments = rng.weighted([[0, 60], [1, 22], [2, 11], [3, 5], [4, 2]] as const);
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const sourceBankOrAdvisor =
      channel === "Bancassurance"
        ? rng.pick(BANK_PARTNERS)
        : channel === "Agency"
          ? `Advisor ${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)} (AG${rng.int(10000, 99999)})`
          : channel === "Online"
            ? "Website"
            : "Direct sales team";
    const base = {
      product,
      paymentMode,
      paymentMethod,
      channel,
      customerProfile,
      advisorStatus,
      priorLatePayments,
      annualisedPremium,
    };
    drafts.push({
      ...base,
      policyId: `SLI${String(2_400_000 + i * 7 + (i % 5)).padStart(8, "0")}`,
      customerName: `${first} ${last}`,
      sourceBankOrAdvisor,
      instalmentAmount: Math.round(annualisedPremium / INSTALMENTS_PER_YEAR[paymentMode]),
      city: cityRef.city,
      region: cityRef.region,
      language,
      latentRisk: latentRisk(base),
      noise: rng.normal() * 0.55,
    });
  }

  // Highest latent risk (plus noise) lapses, so cohorts correlate with lapse.
  const order = drafts
    .map((d, idx) => ({ idx, v: d.latentRisk + d.noise }))
    .sort((a, b) => b.v - a.v);
  const lapsedCount = Math.round(POLICY_COUNT * LAPSED_SHARE);
  const lapsedSet = new Set(order.slice(0, lapsedCount).map((o) => o.idx));

  const policies: Policy[] = drafts.map((d, idx) => {
    const r = new Rng(SEED + idx * 31 + 7);
    const grace = graceDaysFor(d.paymentMode);
    const step = instalmentStepMonths(d.paymentMode);
    let stage: Stage;
    let state: PolicyState;
    let issue: Date;
    let lapseMonth: number | undefined;
    let lapseDate: Date | undefined;
    let dueDate: Date;
    let warmingStation: number | undefined;
    let monthDue: MonthDue | undefined;
    let revivedOn: string | undefined;
    let reasonCode: ReasonCode = "None";

    if (lapsedSet.has(idx)) {
      const early = r.chance(EARLY_SHARE_OF_LAPSED);
      stage = early ? "Early lapse" : "Late lapse";
      // Pick the policy's current age band first so persistency by period stays plausible.
      const band = r.weighted([[0, 3], [1, 26], [2, 23], [3, 16], [4, 17], [5, 23], [6, 2]] as const);
      const ageMonths = band * 12 + r.next() * 12;
      const maxLateDays = Math.floor(ageMonths * 30.44 - grace - step * 30.44);
      const daysSince = early
        ? r.int(1, EARLY_LAPSE_MAX_DAYS)
        : maxLateDays > EARLY_LAPSE_MAX_DAYS + 30
          ? r.int(EARLY_LAPSE_MAX_DAYS + 1, Math.min(1800, maxLateDays))
          : r.int(EARLY_LAPSE_MAX_DAYS + 1, 400);
      const monthsSinceMissed = (daysSince + grace) / 30.44;
      lapseMonth = Math.max(step, Math.floor((ageMonths - monthsSinceMissed) / step) * step);
      lapseDate = addDays(NOW, -daysSince);
      const missedDue = addDays(lapseDate, -grace);
      issue = addMonths(missedDue, -lapseMonth);
      dueDate = missedDue;
      const roll = r.next();
      if (early) state = roll < 0.09 ? "Revived" : roll < 0.34 ? "Revival offered" : "Lapsed early";
      else state = roll < 0.05 ? "Revived" : roll < 0.25 ? "Revival offered" : "Lapsed late";
      if (state === "Revived") revivedOn = toIso(addDays(NOW, -r.int(0, 26)));
      reasonCode = r.weighted<ReasonCode>([
        ["Money problem", 30],
        ["Lost interest", 18],
        ["Not reached", 20],
        ["Mis-sold", 8],
        ["Forgot", 10],
        ["Will pay later", 10],
        ["Mandate failed", 4],
      ]);
    } else if (r.chance(SOURCING_SHARE_OF_INFORCE)) {
      stage = "Sourcing";
      const daysSinceIssue = r.int(1, 45);
      issue = addDays(NOW, -daysSinceIssue);
      dueDate = addMonths(issue, 12);
      if (daysSinceIssue <= 6) state = "Welcome pending";
      else if (daysSinceIssue <= 20) state = r.chance(0.6) ? "PIVC pending" : "Free-look open";
      else if (daysSinceIssue <= 30) state = "Free-look open";
      else state = r.chance(0.3) ? "PIVC pending" : "Free-look open";
    } else {
      const year = r.weighted([[1, 32], [2, 25], [3, 17], [4, 11], [5, 7], [6, 3], [7, 2], [8, 1], [9, 1], [10, 1]] as const);
      const ageDays = Math.max(60, Math.floor(((year - 1) * 12 + r.next() * 12) * 30.44));
      issue = addDays(NOW, -ageDays);
      const ageMonths = monthsBetween(issue, NOW);
      const lastAnniv = addMonths(issue, Math.floor(ageMonths / 12) * 12);
      const nextAnniv = addMonths(issue, (Math.floor(ageMonths / 12) + 1) * 12);
      const sinceLast = diffDays(NOW, lastAnniv);
      const toNext = diffDays(nextAnniv, NOW);
      if (ageMonths >= 12 && sinceLast <= grace) {
        stage = "Renewal window";
        dueDate = lastAnniv;
        const roll = r.next() + d.latentRisk * 0.12;
        state = roll < 0.86 ? "Paid" : roll < 0.93 ? "Promised" : "Grace";
      } else if (toNext <= 90) {
        stage = "Renewal window";
        dueDate = nextAnniv;
        const roll = r.next();
        state = toNext <= 30 && roll < 0.14 ? "Paid" : toNext <= 30 && roll < 0.27 ? "Promised" : "Renewal window open";
      } else {
        stage = "Warming";
        dueDate = nextAnniv;
        warmingStation = stationFor(toNext);
        state = `Warming station ${warmingStation}`;
      }
      if (state === "Promised") reasonCode = r.weighted<ReasonCode>([["Will pay later", 60], ["Money problem", 25], ["Forgot", 15]]);
      if (state === "Grace") reasonCode = r.weighted<ReasonCode>([["Not reached", 35], ["Money problem", 25], ["Forgot", 15], ["Mandate bounce", 15], ["Will pay later", 10]]);

      // Instalment falling due this month (collection view).
      const stepMonths = step;
      const totalSteps = Math.floor(monthsBetween(issue, new Date(Date.UTC(2026, 10, 0))) / stepMonths);
      const octDue = addMonths(issue, totalSteps * stepMonths);
      if (octDue.getUTCFullYear() === 2026 && octDue.getUTCMonth() === 9 && totalSteps > 0) {
        const isAnniv = (totalSteps * stepMonths) % 12 === 0;
        let status: MonthDue["status"];
        if (isAnniv && stage === "Renewal window") {
          status = state === "Paid" ? "paid" : state === "Promised" ? "promised" : octDue > NOW ? "upcoming" : "unpaid";
          if (status === "unpaid" && state !== "Grace") status = "upcoming";
        } else if (octDue > NOW) {
          status = "upcoming";
        } else {
          const autopay = d.paymentMethod === "NACH/ECS mandate" || d.paymentMethod === "UPI autopay" || d.paymentMethod === "Credit card SI";
          const pPay = (autopay ? 0.97 : 0.88) - d.latentRisk * 0.03;
          const roll = r.next();
          status = roll < pPay ? "paid" : roll < pPay + 0.07 ? "promised" : "unpaid";
        }
        // Paid ahead of an upcoming due date: spread over the last few weeks rather than landing on today.
        const offset = status === "paid" ? r.int(0, 6) : 0;
        const sinceDue = diffDays(NOW, octDue);
        const paidOn = status === "paid" ? toIso(sinceDue >= 0 ? addDays(octDue, sinceDue >= 6 ? offset : Math.round((offset * sinceDue) / 6)) : addDays(NOW, -((idx * 7) % 21))) : undefined;
        monthDue = {
          date: toIso(octDue),
          amount: d.instalmentAmount,
          status,
          paidOn,
          branchPayment: status === "paid" && d.paymentMethod === "Bank branch",
        };
      }
    }

    // Interrupts and holds can happen in any stage.
    const interrupt = r.next();
    if (interrupt < 0.006) state = "Complaint-hold";
    else if (interrupt < 0.008) state = "Bereavement-hold";
    else if (interrupt < 0.016) state = "Do-not-contact";
    else if (interrupt < 0.028 && stage !== "Sourcing" && stage !== "Late lapse") {
      state = "Surrender-intent";
      reasonCode = "Wants to surrender";
    }

    const graceEnd = addDays(dueDate, grace);
    const monthsSinceIssue = monthsBetween(issue, NOW);
    const policyYear = Math.min(10, Math.floor(Math.max(0, monthsSinceIssue) / 12) + 1);
    const instalmentsPaid =
      lapseMonth !== undefined
        ? Math.round(lapseMonth / step)
        : Math.floor(Math.max(0, monthsSinceIssue) / step) + 1;

    const starter = scorePolicy({ ...d, policyYear });
    const unscoredInsurer = r.chance(0.04);
    const unscoredRules = r.chance(0.04);
    const unscoredStarter = r.chance(0.04);

    const insurerVal = d.latentRisk * 0.8 + r.normal() * 0.45 + (policyYear <= 2 ? 0.25 : 0);
    const insurerCohort: InsurerCohort = unscoredInsurer
      ? "Unscored"
      : insurerVal < 0.35 ? "A1" : insurerVal < 0.7 ? "A2" : insurerVal < 1.05 ? "A3" : insurerVal < 1.45 ? "A4" : "A5";

    const highFlags =
      (d.paymentMode === "Monthly" ? 1 : 0) +
      (d.paymentMethod === "Cash/cheque" || d.paymentMethod === "Bank branch" ? 1 : 0) +
      (d.advisorStatus === "Left" ? 1 : 0) +
      (policyYear <= 2 ? 1 : 0) +
      (d.priorLatePayments >= 2 ? 1 : 0);
    const rulesCohort: RulesCohort = unscoredRules ? "Unscored" : highFlags >= 3 ? "High" : highFlags >= 1 ? "Medium" : "Low";

    const touches = stage === "Warming" ? r.int(0, 2) : stage === "Sourcing" ? r.int(0, 3) : r.weighted([[0, 10], [1, 20], [2, 22], [3, 18], [4, 12], [5, 8], [6, 5], [8, 3], [9, 2]] as const);
    const lastTouchDays = touches > 0 ? r.int(0, 12) : null;
    const lastTouchChannel = touches > 0 ? r.weighted([["WhatsApp", 45], ["Telecall", 30], ["Voice bot", 15], ["Field visit", 5], ["Bank relationship manager", 5]] as const) : null;

    const assignedVendor =
      stage === "Early lapse" || stage === "Late lapse"
        ? r.weighted([["Call-centre vendor (variable payout)", 60], ["Call-centre vendor (fixed payout)", 25], ["Desible", 15]] as const)
        : stage === "Renewal window"
          ? r.weighted([["Call-centre vendor (fixed payout)", 50], ["WhatsApp vendor", 20], ["Voice bot vendor", 15], ["Desible", 15]] as const)
          : r.weighted([["WhatsApp vendor", 60], ["Desible", 40]] as const);

    const { noise: _noise, ...rest } = d;
    void _noise;
    return {
      ...rest,
      policyYear,
      insurerCohort,
      rulesCohort,
      starterScore: unscoredStarter ? null : starter.score,
      starterBand: unscoredStarter ? null : bandFor(starter.score),
      lifecycleStage: stage,
      state,
      issueDate: toIso(issue),
      monthsSinceIssue,
      dueDate: toIso(dueDate),
      graceEnd: toIso(graceEnd),
      graceDays: grace,
      lapseDate: lapseDate ? toIso(lapseDate) : undefined,
      lapseMonth,
      instalmentsPaid,
      warmingStation,
      lastTouch: lastTouchDays === null ? null : toIso(addDays(NOW, -lastTouchDays)),
      lastTouchChannel,
      touchesLast30d: touches,
      reasonCode,
      monthDue,
      revivedOn,
      assignedVendor,
    };
  });

  return policies;
}
