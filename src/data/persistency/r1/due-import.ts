import { BASE_POLICIES } from "../index";
import { NOW, addDays, diffDays, fromIso, toIso } from "../dates";
import type { Policy } from "../types";

export const DUE_COUNTS = { rows: 12_000, rejects: 32, newPolicies: 214, updated: 11_754, stageChanges: 61 } as const;

/** 61 warming policies whose due date in the sample file moves them into the renewal window. */
export const STAGE_CHANGE_IDS: string[] = BASE_POLICIES.filter((p) => {
  if (p.lifecycleStage !== "Warming") return false;
  const d = diffDays(fromIso(p.dueDate), NOW);
  return d > 90 && d <= 120;
})
  .slice(0, DUE_COUNTS.stageChanges)
  .map((p) => p.policyId);

export function newDueDate(p: Policy): string {
  return toIso(addDays(fromIso(p.dueDate), -35));
}

/** The 214 policies that are new in the sample due list. */
export const NEW_POLICIES: Policy[] = Array.from({ length: DUE_COUNTS.newPolicies }, (_, i) => {
  const src = BASE_POLICIES[(i * 53) % BASE_POLICIES.length]!;
  return { ...src, policyId: `SLI0251${String(i).padStart(5, "0")}`, customerName: BASE_POLICIES[(i * 97 + 11) % BASE_POLICIES.length]!.customerName };
});
