/**
 * Worth Pursuing Model: the chance this premium is still collected by the in-house team, and whether
 * to keep spending calls on it or hand it to the variable-payout vendor, who is paid only on recovery.
 * The insurer's own propensity band is the starting point; what happened on every contact since then
 * moves the chance up or down. Each factor is shown so the decision can be checked.
 */

export const HAND_OVER_BELOW = 0.25;
export const MAX_REFUSALS = 3;
/** Cost of one more in-house round: AI call, human callback, brief and messages (Rs). */
export const IN_HOUSE_ROUND_COST = 120;
/** Variable-payout vendor fee, charged only on what it recovers. */
export const VENDOR_FEE = 0.12;

export interface WorthInput {
  band: number | null;
  calls: number;
  unanswered: number;
  refusals: number;
  promise: boolean;
  brokenPromises: number;
  daysPastDue: number;
  unpaidLinks: number;
  reason?: string | undefined;
  annualPremium: number;
}

export interface WorthFactor {
  label: string;
  effect: number;
}

export interface WorthResult {
  chance: number;
  factors: WorthFactor[];
  expectedInHouse: number;
  costInHouse: number;
  expectedVendorNet: number;
  handOver: boolean;
  recommendation: string;
  why: string;
}

const BASE: Record<number, number> = { 1: 0.4, 2: 0.45, 3: 0.5, 4: 0.56, 5: 0.6, 6: 0.7, 7: 0.76, 8: 0.82, 9: 0.87, 10: 0.9 };

export function worthScore(x: WorthInput): WorthResult {
  const factors: WorthFactor[] = [];
  const base = x.band == null ? 0.6 : BASE[x.band] ?? 0.6;
  factors.push({ label: x.band == null ? "Not scored: book average" : `Propensity band P${x.band}`, effect: base });
  if (x.refusals) factors.push({ label: `${x.refusals} refusal${x.refusals > 1 ? "s" : ""} on calls`, effect: -0.06 * x.refusals });
  if (x.unanswered) factors.push({ label: `${x.unanswered} call${x.unanswered > 1 ? "s" : ""} not answered`, effect: -0.03 * Math.min(x.unanswered, 5) });
  if (x.unpaidLinks) factors.push({ label: `${x.unpaidLinks} payment link${x.unpaidLinks > 1 ? "s" : ""} not paid`, effect: -0.02 * Math.min(x.unpaidLinks, 4) });
  if (x.promise) factors.push({ label: "Promise to pay on record", effect: 0.08 });
  if (x.brokenPromises) factors.push({ label: `${x.brokenPromises} broken promise${x.brokenPromises > 1 ? "s" : ""}`, effect: -0.06 * x.brokenPromises });
  if (x.daysPastDue > 0) factors.push({ label: `${x.daysPastDue} days past the due date`, effect: -0.002 * x.daysPastDue });
  if (x.reason === "Financial") factors.push({ label: "Reason: money is tight", effect: -0.03 });
  if (x.reason === "Mis-selling") factors.push({ label: "Reason: says it was mis-sold", effect: -0.1 });
  const chance = Math.max(0.02, Math.min(0.98, factors.reduce((a, f) => a + f.effect, 0)));
  const expectedInHouse = chance * x.annualPremium;
  const costInHouse = IN_HOUSE_ROUND_COST;
  const expectedVendorNet = chance * x.annualPremium * (1 - VENDOR_FEE);
  const refusedOut = x.refusals >= MAX_REFUSALS;
  const handOver = refusedOut || chance < HAND_OVER_BELOW;
  const pctS = `${Math.round(chance * 100)}%`;
  return {
    chance,
    factors,
    expectedInHouse,
    costInHouse,
    expectedVendorNet,
    handOver,
    recommendation: handOver ? "Stop in-house calls. Hand to the variable-payout vendor" : "Keep with the in-house team",
    why: refusedOut
      ? `${x.refusals} refusals: the hard rule hands the case over whatever the score`
      : handOver
        ? `Chance to collect is ${pctS}, below the ${Math.round(HAND_OVER_BELOW * 100)}% line. More in-house calls cost Rs ${IN_HOUSE_ROUND_COST} a round and rarely change the answer; the vendor is paid only if it recovers`
        : `Chance to collect is ${pctS}, above the ${Math.round(HAND_OVER_BELOW * 100)}% line. One more in-house round costs Rs ${IN_HOUSE_ROUND_COST} against Rs ${Math.round(expectedInHouse).toLocaleString("en-IN")} of expected premium`,
  };
}
