import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DIMENSION_LABEL, type DimensionKey } from "@/data/persistency";
import { evaluate } from "@/engine/persistency";
import { useEngineContext, usePersistencyStore, usePolicy } from "@/store/persistency";
import { useWork } from "@/store/work";
import { date, dateTime, inr } from "@/lib/format";
import { Field } from "./tabs";
import { StatusChip } from "./status-chip";
import { policyStatus, statusTone } from "./policy-model";
import { PolicyActions } from "./policy-actions";

export function WhyHere({ policyId }: { policyId: string }) {
  const policy = usePolicy(policyId);
  const rules = usePersistencyStore((s) => s.rules);
  const ctx = useEngineContext();
  const d = useMemo(() => (policy ? evaluate(policy, rules, ctx) : null), [policy, rules, ctx]);
  if (!d) return null;
  return (
    <div className="rounded-card border border-border p-3">
      <p className="text-[13px] font-semibold text-foreground">
        <span className="mr-1.5 text-primary">{d.ruleId}</span>
        {d.ruleName}
      </p>
      <ul className="mt-2 space-y-1 text-[13px]">
        {Object.entries(d.matchedDimensions).map(([k, v]) => (
          <li key={k} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{DIMENSION_LABEL[k as DimensionKey]}</span>
            <span className="text-right text-foreground">{v}</span>
          </li>
        ))}
        {Object.keys(d.matchedDimensions).length === 0 && <li className="text-muted-foreground">No rule conditions matched.</li>}
      </ul>
      {d.conflictWith && <p className="mt-2 text-[12px] text-attention">Tied with {d.conflictWith.join(", ")} on dimensions and priority.</p>}
    </div>
  );
}

export function useNextStep(policyId: string | null) {
  const policy = usePolicy(policyId);
  const rules = usePersistencyStore((s) => s.rules);
  const ctx = useEngineContext();
  const owners = useWork((s) => s.owners);
  return useMemo(() => {
    if (!policy) return null;
    const d = evaluate(policy, rules, ctx);
    return { decision: d, owner: owners[policy.policyId] ?? d.executor };
  }, [policy, rules, ctx, owners]);
}

/** Right-side panel for a policy row (420px). */
export function PolicyPanel({ policyId, onClose }: { policyId: string | null; onClose: () => void }) {
  const policy = usePolicy(policyId);
  const next = useNextStep(policyId);
  return (
    <Sheet open={!!policyId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="scrollbar-prism w-full overflow-y-auto border-border bg-background p-0 sm:max-w-[420px]">
        {policy && next && (
          <div>
            <SheetHeader className="space-y-1 border-b border-border px-5 py-4 text-left">
              <SheetTitle className="text-[20px] font-semibold text-foreground">{policy.policyId}</SheetTitle>
              <SheetDescription className="text-[13px] text-subtle">
                {policy.customerName} · {policy.product} · {inr(policy.instalmentAmount)} {policy.paymentMode.toLowerCase()}
              </SheetDescription>
              <div className="pt-1">
                <StatusChip tone={statusTone(policyStatus(policy))}>{policyStatus(policy)}</StatusChip>
              </div>
            </SheetHeader>
            <dl className="grid grid-cols-2 gap-3 border-b border-border px-5 py-4">
              <Field label="Due date">{date(policy.dueDate)}</Field>
              <Field label="Grace ends">{date(policy.graceEnd)}</Field>
              <Field label="Stage">{policy.lifecycleStage}</Field>
              <Field label="Cohort">{policy.insurerCohort}</Field>
              <Field label="Payment method">{policy.paymentMethod}</Field>
              <Field label="Channel">{policy.channel}</Field>
            </dl>
            <section className="space-y-2 border-b border-border px-5 py-4">
              <h3 className="text-[14px] font-semibold">Next step</h3>
              <p className="text-[13px] text-foreground">{next.decision.action}</p>
              <p className="text-[12px] text-muted-foreground">
                {next.owner} · by {dateTime(next.decision.scheduledAt)}
                {next.decision.cancelledReason && ` · cancelled: ${next.decision.cancelledReason}`}
                {next.decision.frozen && " · outreach stopped"}
              </p>
            </section>
            <section className="space-y-2 border-b border-border px-5 py-4">
              <h3 className="text-[14px] font-semibold">Why this policy is here</h3>
              <WhyHere policyId={policy.policyId} />
            </section>
            <section className="space-y-3 px-5 py-4">
              <h3 className="text-[14px] font-semibold">Quick actions</h3>
              <PolicyActions policy={policy} />
              <Link to="/persistency/policies/$id" params={{ id: policy.policyId }} className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline">
                Open policy page <ExternalLink className="size-3.5" />
              </Link>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
