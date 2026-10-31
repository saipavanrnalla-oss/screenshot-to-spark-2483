import type { Policy, StarterBand } from "./types";

export type ScoreFactorKey =
  | "paymentMode"
  | "paymentMethod"
  | "policyYear"
  | "ticketSize"
  | "advisorStatus"
  | "channel"
  | "priorLate"
  | "region"
  | "customerProfile"
  | "bureau";

export interface ScoreFactor {
  key: ScoreFactorKey;
  label: string;
  weight: number;
  disabled?: boolean | undefined;
  disabledNote?: string | undefined;
}

export const DEFAULT_WEIGHTS: ScoreFactor[] = [
  { key: "paymentMode", label: "Payment mode", weight: 18 },
  { key: "paymentMethod", label: "Payment method / mandate", weight: 16 },
  { key: "policyYear", label: "Policy year", weight: 14 },
  { key: "ticketSize", label: "Ticket size", weight: 12 },
  { key: "advisorStatus", label: "Advisor status", weight: 10 },
  { key: "channel", label: "Channel", weight: 8 },
  { key: "priorLate", label: "Prior late payments", weight: 8 },
  { key: "region", label: "Region", weight: 5 },
  { key: "customerProfile", label: "Customer profile", weight: 5 },
  {
    key: "bureau",
    label: "Bureau signals",
    weight: 4,
    disabled: true,
    disabledNote: "Needs bureau fields from your file",
  },
];

export const DEFAULT_BAND_CUTOFFS = [34, 42, 50, 57] as const;

export const STARTER_LABEL =
  "Starter scorecard. Weights shown. Trained later on your outcomes.";

type ScoreInput = Pick<
  Policy,
  | "paymentMode"
  | "paymentMethod"
  | "policyYear"
  | "annualisedPremium"
  | "advisorStatus"
  | "channel"
  | "priorLatePayments"
  | "region"
  | "customerProfile"
>;

/** Risk fraction 0..1 per factor. Higher means more likely to lapse. */
export function factorRisk(key: ScoreFactorKey, p: ScoreInput): number {
  switch (key) {
    case "paymentMode":
      return { Monthly: 1, Quarterly: 0.7, "Half-yearly": 0.4, Annual: 0.15 }[p.paymentMode];
    case "paymentMethod":
      return {
        "Cash/cheque": 1,
        "Bank branch": 0.75,
        "Credit card SI": 0.45,
        "UPI autopay": 0.4,
        "NACH/ECS mandate": 0.15,
      }[p.paymentMethod];
    case "policyYear":
      return p.policyYear <= 1 ? 1 : p.policyYear === 2 ? 0.85 : p.policyYear === 3 ? 0.6 : p.policyYear <= 5 ? 0.4 : 0.2;
    case "ticketSize":
      return p.annualisedPremium < 25000 ? 1 : p.annualisedPremium < 100000 ? 0.7 : p.annualisedPremium < 500000 ? 0.4 : 0.15;
    case "advisorStatus":
      return { Left: 1, Inactive: 0.6, Active: 0.1 }[p.advisorStatus];
    case "channel":
      return { Bancassurance: 0.9, Online: 0.6, Agency: 0.5, Direct: 0.3 }[p.channel];
    case "priorLate":
      return Math.min(p.priorLatePayments, 3) / 3;
    case "region":
      return { East: 0.8, North: 0.6, West: 0.4, South: 0.3 }[p.region];
    case "customerProfile":
      return { "Self-employed": 0.9, NRI: 0.7, Senior: 0.6, Salaried: 0.4, HNI: 0.2 }[p.customerProfile];
    case "bureau":
      return 0;
  }
}

export interface ScoreBreakdown {
  score: number;
  maxAvailable: number;
  parts: { key: ScoreFactorKey; label: string; points: number; weight: number; disabled?: boolean }[];
}

export function scorePolicy(p: ScoreInput, weights: ScoreFactor[] = DEFAULT_WEIGHTS): ScoreBreakdown {
  let score = 0;
  let maxAvailable = 0;
  const parts = weights.map((f) => {
    if (f.disabled) return { key: f.key, label: f.label, points: 0, weight: f.weight, disabled: true };
    const points = Math.round(f.weight * factorRisk(f.key, p) * 10) / 10;
    score += points;
    maxAvailable += f.weight;
    return { key: f.key, label: f.label, points, weight: f.weight };
  });
  return { score: Math.round(score), maxAvailable, parts };
}

export function bandFor(score: number, cutoffs: readonly number[] = DEFAULT_BAND_CUTOFFS): StarterBand {
  let band = 1;
  for (const c of cutoffs) if (score >= c) band++;
  return band as StarterBand;
}
