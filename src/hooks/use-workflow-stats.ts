import { useMemo } from "react";
import type { Policy } from "@/data/persistency";
import { useDecisions, usePersistencyStore } from "@/store/persistency";

/** Policies currently decided into each workflow, plus the latest decision time from the live ticker. */
export function useWorkflowStats(policies: Policy[]) {
  const decisions = useDecisions(policies);
  const ticker = usePersistencyStore((s) => s.ticker);
  return useMemo(() => {
    const count = new Map<string, number>();
    const cancelled = new Map<string, number>();
    for (const d of decisions.values()) {
      if (!d.workflowId) continue;
      count.set(d.workflowId, (count.get(d.workflowId) ?? 0) + 1);
      if (d.cancelledReason) cancelled.set(d.workflowId, (cancelled.get(d.workflowId) ?? 0) + 1);
    }
    const lastRun = new Map<string, string>();
    for (const t of ticker) if (!lastRun.has(t.decision.workflowId)) lastRun.set(t.decision.workflowId, t.at);
    return { count, cancelled, lastRun, decisions };
  }, [decisions, ticker]);
}
