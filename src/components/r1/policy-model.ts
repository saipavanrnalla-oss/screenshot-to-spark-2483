import { useMemo } from "react";
import { NOW_ISO, type Policy, type Stage } from "@/data/persistency";
import { stageUnder, DEFAULT_STAGE_SETTINGS, type StageSettings } from "@/data/persistency/r1/stage-settings";
import { branchOf, hasMandate, ticketLabel } from "@/data/persistency/r1/common";
import { usePolicies } from "@/store/persistency";
import { activeVersion, useVersions } from "@/store/work";
import type { Tone } from "./status-chip";

export const POLICY_STATUSES = ["New", "Warming", "Due", "In Grace Period", "Promised, not yet paid", "Paid", "Lapsed", "On hold", "Surrender in progress"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export function isOnHold(p: Pick<Policy, "state">): boolean {
  return p.state === "Complaint-hold" || p.state === "Bereavement-hold" || p.state === "Do-not-contact";
}

export function policyStatus(p: Policy): PolicyStatus {
  if (isOnHold(p)) return "On hold";
  if (p.state === "Surrender-intent") return "Surrender in progress";
  if (p.state === "Paid" || p.state === "Revived") return "Paid";
  if (p.state === "Promised") return "Promised, not yet paid";
  if (p.state === "Grace") return "In Grace Period";
  if (p.state === "Renewal window open") return "Due";
  if (p.state === "Lapsed early" || p.state === "Lapsed late" || p.state === "Revival offered") return "Lapsed";
  if (p.state.startsWith("Warming")) return "Warming";
  return "New";
}

export function statusTone(s: PolicyStatus): Tone {
  if (s === "Paid") return "ok";
  if (s === "In Grace Period" || s === "Promised, not yet paid" || s === "Due") return "risk";
  if (s === "Lapsed" || s === "On hold" || s === "Surrender in progress") return "off";
  return "neutral";
}

export const BOARD_COLUMNS = ["Sourcing", "Warming", "Renewal window", "Early lapse", "Late lapse", "On hold", "Surrender in progress"] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export function boardColumn(p: Policy, stage: Stage): BoardColumn {
  if (isOnHold(p)) return "On hold";
  if (p.state === "Surrender-intent") return "Surrender in progress";
  return stage;
}

export const METHOD_FILTER = ["NACH/ECS mandate", "UPI autopay", "Credit card SI", "Cash/cheque", "Bank branch", "None (no mandate)"] as const;

export function matchesMethod(p: Policy, v: string): boolean {
  return v === "None (no mandate)" ? !hasMandate(p) : p.paymentMethod === v;
}

/** Stage settings in force today: an approved version with a later effective date waits. */
export function useStageSettingsInForce(): { settings: StageSettings; pending?: { no: number; from: string } | undefined } {
  const list = useVersions<StageSettings>("stage:settings");
  return useMemo(() => {
    const active = activeVersion(list);
    if (active && active.effectiveFrom && active.effectiveFrom > NOW_ISO) {
      const prev = [...list].reverse().find((v) => v.no < active.no && (v.status === "Retired" || v.status === "Active"));
      return { settings: prev?.data ?? DEFAULT_STAGE_SETTINGS, pending: { no: active.no, from: active.effectiveFrom } };
    }
    return { settings: active?.data ?? DEFAULT_STAGE_SETTINGS };
  }, [list]);
}

export interface BoardPolicy {
  p: Policy;
  stage: Stage;
  column: BoardColumn;
}

/** Policies with their stage under the stage settings in force. */
export function useStagedPolicies(): BoardPolicy[] {
  const policies = usePolicies();
  const { settings } = useStageSettingsInForce();
  return useMemo(() => {
    const s = isDefault(settings) ? DEFAULT_STAGE_SETTINGS : settings;
    return policies.map((p) => {
      const stage = stageUnder(p, s);
      return { p, stage, column: boardColumn(p, stage) };
    });
  }, [policies, settings]);
}

function isDefault(s: StageSettings): boolean {
  const d = DEFAULT_STAGE_SETTINGS;
  return s.warmingStart === d.warmingStart && s.windowOpens === d.windowOpens && s.graceMonthly === d.graceMonthly && s.graceOther === d.graceOther && s.lapseBoundary === d.lapseBoundary;
}

export interface PolicyFilters {
  stage?: string | undefined;
  product?: string | undefined;
  channel?: string | undefined;
  region?: string | undefined;
  branch?: string | undefined;
  cohort?: string | undefined;
  method?: string | undefined;
  status?: string | undefined;
  due?: string | undefined;
  hold?: string | undefined;
  ticket?: string | undefined;
}

export function matchesFilters(bp: BoardPolicy, f: PolicyFilters): boolean {
  const { p } = bp;
  if (f.stage && bp.column !== f.stage && bp.stage !== f.stage) return false;
  if (f.product && p.product !== f.product) return false;
  if (f.channel && p.channel !== f.channel) return false;
  if (f.region && p.region !== f.region) return false;
  if (f.cohort && p.insurerCohort !== f.cohort) return false;
  if (f.method && !matchesMethod(p, f.method)) return false;
  if (f.status && policyStatus(p) !== f.status) return false;
  if (f.hold && (f.hold === "Yes") !== isOnHold(p)) return false;
  if (f.branch && branchOf(p) !== f.branch) return false;
  if (f.ticket && ticketLabel(p.annualisedPremium) !== f.ticket) return false;
  if (f.due) {
    const [a, b] = f.due.split("..");
    if (a && p.dueDate < a) return false;
    if (b && p.dueDate > b) return false;
  }
  return true;
}

export const COHORTS = ["Highest propensity", "High propensity", "Moderate propensity", "Low propensity", "Lowest propensity", "Unscored"] as const;
