import { hashId } from "@/data/persistency/derived";
import { hasMandate } from "@/data/persistency/r1/common";
import { PALETTE_BY_TYPE, type WfEdge, type WfGraph, type WfNode } from "@/data/persistency/r1/wf";
import type { Policy } from "@/data/persistency";
import { isOutcome } from "@/engine/workflow";

/** What the customer does in an example run. "Follow the policy" lets the policy's own facts decide. */
export const EXAMPLE_BEHAVIOURS = [
  "Follow the policy",
  "Pays by the due date",
  "Pays in the Grace Period",
  "Lapses, then revives",
  "Refuses and is closed",
  "Traditional plan goes Reduced Paid-up",
] as const;
export type ExampleBehaviour = (typeof EXAMPLE_BEHAVIOURS)[number];

export const END_STATES = ["Renewed", "Renewed in the Grace Period", "Revived", "Closed with reason"] as const;

export interface WalkStep {
  nodeId: string;
  label: string;
  who: string;
  /** The branch taken out of this step. */
  result: string;
}

export interface WalkResult {
  policyId: string;
  steps: WalkStep[];
  endNodeId: string;
  endState: string;
  /** Reason tag for a closed case. */
  reason?: string | undefined;
  /** False when the walk could not reach an outcome. */
  complete: boolean;
}

const FORCED: Record<Exclude<ExampleBehaviour, "Follow the policy">, Record<string, string>> = {
  "Pays by the due date": { paid: "Yes", debDec: "Yes", balDec: "Yes", out1: "Will pay", out2: "Will pay" },
  "Pays in the Grace Period": { paid: "No", debDec: "Bounced", balDec: "No", out1: "Will pay", out2: "Will pay", resp: "Will pay", gpaid: "Yes" },
  "Lapses, then revives": { paid: "No", debDec: "Bounced", resp: "Refuses", third: "Yes", days: "Under 180", vres: "Yes", rein: "Yes", out1: "Refused", out2: "Refused" },
  "Refuses and is closed": { paid: "No", debDec: "Bounced", resp: "Refuses", third: "Yes", days: "180 and over", vres: "No", out1: "Refused", out2: "Refused" },
  "Traditional plan goes Reduced Paid-up": { paid: "No", debDec: "Bounced", resp: "No response", gpaid: "No", prod: "Traditional", days: "180 and over", vres: "No" },
};

const REASONS = ["Financial", "Service", "Product", "Mis-selling", "Not contactable"] as const;

/** Deterministic: the same policy and behaviour always take the same path. */
export function walkPolicy(graph: WfGraph, p: Policy, behaviour: ExampleBehaviour = "Follow the policy"): WalkResult {
  const forced = behaviour === "Follow the policy" ? {} : FORCED[behaviour];
  const r = (salt: string) => hashId(p.policyId + salt) % 100;
  const out = new Map<string, WfEdge[]>();
  for (const e of graph.edges) out.set(e.from, [...(out.get(e.from) ?? []), e]);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const start = graph.nodes.find((n) => n.type.startsWith("trigger."));
  const steps: WalkStep[] = [];
  const visits = new Map<string, number>();
  const lowBand = p.insurerCohort === "Low propensity" || p.insurerCohort === "Lowest propensity" || p.insurerCohort === "Unscored";
  const mandate = hasMandate(p);
  const goodPayer = !lowBand && p.priorLatePayments === 0;
  let reason: string | undefined;

  const pickAuto = (n: WfNode, labels: string[], visit: number): string | undefined => {
    const has = (l: string) => labels.includes(l);
    switch (n.id) {
      case "hni": return p.annualisedPremium > 200_000 ? "Yes" : "No";
      case "band": return lowBand ? "P1 to P5" : "P6 to P10";
      case "seg": {
        if (p.revivedOn || p.priorLatePayments >= 3) return "Pays very late or revived";
        if (mandate && r("bounced") < 10) return "Debit bounced before";
        return p.priorLatePayments >= 1 ? "Pays late" : "Pays on time";
      }
      case "out1": { const x = r("o1"); return x < 45 ? "Will pay" : x < 62 ? "Raised an issue" : x < 85 ? "Not reached" : "Refused"; }
      case "out2": { const x = r("o2"); return x < 45 ? "Will pay" : x < 60 ? "Callback asked" : x < 85 ? "Not reached" : "Refused"; }
      case "rdec": { const x = r("rd"); return x < 45 ? "Financial" : x < 75 ? "Service or product" : "Mis-selling"; }
      case "ad": return mandate ? "Yes" : "No";
      case "balDec": return r("bal") < 85 ? "Yes" : "No";
      case "debDec": return r("deb") < 88 ? "Yes" : "Bounced";
      case "paid": return r("paid") < (goodPayer ? (mandate ? 94 : 82) : mandate ? 72 : 52) ? "Yes" : "No";
      case "resp": { const x = r("resp"); return x < 35 ? "Will pay" : x < 60 ? "Refuses" : x < 75 ? "Needs a person" : "No response"; }
      case "third": return r("third") < 50 ? "Yes" : "No";
      case "cont": return r("cont") < 45 ? "Yes" : "Stop";
      case "gpaid": return r("gp") < 40 ? "Yes" : "No";
      case "prod": return p.product === "ULIP" ? "ULIP" : "Traditional";
      case "days": return r("days") < 55 ? "Under 180" : "180 and over";
      case "vres": return r("vres") < 28 ? "Yes" : "No";
      case "rein": return r("rein") < 70 ? "Yes" : "No";
      case "cb": return visit === 0 && r("cb") < 50 ? "Call again" : "Still not reached";
      case "reinFix": return visit === 0 && r("rf") < 65 ? "Documents in" : "Not completed";
      default: return has("Default") ? "Default" : undefined;
    }
  };

  let cur: WfNode | undefined = start;
  while (cur && steps.length < 90) {
    const visit = visits.get(cur.id) ?? 0;
    visits.set(cur.id, visit + 1);
    const edges = out.get(cur.id) ?? [];
    const item = PALETTE_BY_TYPE[cur.type];
    const who = cur.config.executor ?? item?.executor ?? (cur.type.startsWith("people.") ? "Person" : "Platform");
    if (isOutcome(cur)) {
      steps.push({ nodeId: cur.id, label: cur.label, who: "Outcome", result: "End" });
      if (cur.label === "Closed with reason") reason = reason ?? "Declined after the vendor attempts";
      return { policyId: p.policyId, steps, endNodeId: cur.id, endState: cur.label, ...(reason ? { reason } : {}), complete: true };
    }
    let chosen: WfEdge | undefined;
    if (edges.length === 1) chosen = edges[0];
    else if (edges.length > 1) {
      const labels = edges.map((e) => e.label ?? "Default");
      const want = forced[cur.id] ?? pickAuto(cur, labels, visit);
      chosen = edges.find((e) => (e.label ?? "Default") === want) ?? edges.find((e) => !e.label) ?? edges[0];
    }
    if (cur.id === "rdec") reason = chosen?.label;
    if (cur.id === "out1" && chosen?.label === "Refused") reason = reason ?? "Refused to pay";
    if (!chosen) {
      steps.push({ nodeId: cur.id, label: cur.label, who, result: "No next step" });
      break;
    }
    steps.push({ nodeId: cur.id, label: cur.label, who, result: chosen.label ?? (edges.length > 1 ? "Default" : "Next") });
    cur = byId.get(chosen.to);
  }
  const last = steps[steps.length - 1];
  return { policyId: p.policyId, steps, endNodeId: last?.nodeId ?? "", endState: "Did not reach an outcome", complete: false };
}

export { REASONS as REASON_TAXONOMY };
