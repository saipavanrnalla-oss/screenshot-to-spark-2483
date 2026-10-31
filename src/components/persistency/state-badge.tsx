import { StatusPill, type Status } from "@/components/ds/primitives";
import type { PolicyState } from "@/data/persistency";

export function stateStatus(state: PolicyState): Status {
  if (state === "Paid" || state === "Revived") return "healthy";
  if (state === "Complaint-hold" || state === "Bereavement-hold" || state === "Do-not-contact" || state === "Lapsed late") return "failed";
  if (state === "Grace" || state === "Promised" || state === "Lapsed early" || state === "Surrender-intent" || state === "Revival offered") return "attention";
  return "live";
}

export function StateBadge({ state }: { state: PolicyState }) {
  return <StatusPill status={stateStatus(state)}>{state}</StatusPill>;
}
