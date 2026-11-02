import { useMemo } from "react";
import { seedActivity } from "@/data/persistency/r1/activity";
import type { ActivityRow } from "@/data/persistency/r1/types";
import { usePolicy } from "@/store/persistency";
import { useWork } from "@/store/work";

const AGENT_IDS: Record<string, string> = { "Renewal voice agent": "renewal-voice", "Message agent": "message", "Payment assist agent": "payment-assist" };

/** Seeded and in-session Activity rows for one policy, newest first. Rows are never edited or deleted. */
export function usePolicyActivity(policyId: string): ActivityRow[] {
  const policy = usePolicy(policyId);
  const added = useWork((s) => s.activity[policyId]);
  const pauses = useWork((s) => s.agentPause);
  return useMemo(() => {
    if (!policy) return [];
    const seeded = seedActivity(policy);
    return [...(added ?? []), ...seeded].filter((r) => {
      const id = AGENT_IDS[r.executor];
      const p = id ? pauses[id] : undefined;
      return !p || r.at < p.at || r.executorKind !== "agent";
    });
  }, [policy, added, pauses]);
}
