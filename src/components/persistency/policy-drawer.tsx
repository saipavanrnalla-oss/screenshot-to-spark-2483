import { useMemo } from "react";
import { toast } from "sonner";
import { ChevronDown, Clock, GitBranch, History, MessageSquare, PhoneCall, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Chip, Eyebrow, StatusPill } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { DIMENSION_LABEL, SIMULATED_EVENTS, VENDORS, workflowById, type DimensionKey } from "@/data/persistency";
import { LEVEL_LABEL, baseTimeline, cohortLabel, evaluate } from "@/engine/persistency";
import { useEngineContext, usePersistencyStore, usePolicy } from "@/store/persistency";
import { date, dateTime, inr } from "@/lib/format";
import { StateBadge } from "./state-badge";

export function PolicyDrawer({ policyId, onClose }: { policyId: string | null; onClose: () => void }) {
  const policy = usePolicy(policyId);
  const rules = usePersistencyStore((s) => s.rules);
  const extra = usePersistencyStore((s) => (policyId ? s.extraTimeline[policyId] : undefined));
  const simulate = usePersistencyStore((s) => s.simulate);
  const vendorModes = usePersistencyStore((s) => s.vendorModes);
  const ctx = useEngineContext();

  const decision = useMemo(() => (policy ? evaluate(policy, rules, ctx) : null), [policy, rules, ctx]);
  const timeline = useMemo(() => (policy ? [...(extra ?? []), ...baseTimeline(policy)] : []), [policy, extra]);
  const rule = decision ? rules.find((r) => r.id === decision.ruleId) : undefined;
  const wf = decision ? workflowById(decision.workflowId) : undefined;

  return (
    <Sheet open={!!policyId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="scrollbar-prism w-full overflow-y-auto border-border bg-background p-0 sm:max-w-[480px]">
        {policy && decision && (
          <div className="flex flex-col">
            <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
              <Eyebrow>Policy</Eyebrow>
              <SheetTitle className="text-xl font-extrabold text-foreground">{policy.policyId}</SheetTitle>
              <SheetDescription className="text-xs text-subtle">
                {policy.customerName} · {policy.city} · {policy.language}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <StateBadge state={policy.state} />
                <Chip>{policy.lifecycleStage}</Chip>
                <Chip>Cohort {cohortLabel(policy, ctx.activeCohortSet[policy.product])}</Chip>
              </div>
            </SheetHeader>

            <dl className="grid grid-cols-3 gap-x-4 gap-y-3 border-b border-border px-6 py-4 text-xs">
              {[
                ["Product", policy.product],
                ["Premium (annual)", inr(policy.annualisedPremium)],
                ["Mode", policy.paymentMode],
                ["Method", policy.paymentMethod],
                ["Channel", policy.channel],
                ["Policy year", String(policy.policyYear)],
                ["Due date", date(policy.dueDate)],
                ["Grace ends", `${date(policy.graceEnd)} (${policy.graceDays} days)`],
                ["Advisor", policy.advisorStatus],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">{v}</dd>
                </div>
              ))}
            </dl>

            <section className="border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <Eyebrow>Why it is here</Eyebrow>
                <TierBadge tiers={["live-engine"]} />
              </div>
              <p className="mt-2 text-sm font-bold text-foreground">
                <span className="mr-1.5 rounded-sm bg-brand-tint px-1.5 py-0.5 text-[11px] text-primary">{decision.ruleId}</span>
                {decision.ruleName}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Precedence level {LEVEL_LABEL[decision.level]}
                {rule && ` · priority ${rule.priority}`}
                {rule && ` · ${rule.source}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(decision.matchedDimensions).map(([k, v]) => (
                  <Chip key={k} active>
                    <span className="text-muted-foreground">{DIMENSION_LABEL[k as DimensionKey]}:</span> {v}
                  </Chip>
                ))}
              </div>
              {decision.conflictWith && (
                <p className="mt-3">
                  <StatusPill status="attention">Conflict with {decision.conflictWith.join(", ")} at the same level and priority</StatusPill>
                </p>
              )}
            </section>

            <section className="border-b border-border px-6 py-4">
              <Eyebrow>What happens next</Eyebrow>
              <div className="mt-2 rounded-input border border-border bg-surface-translucent p-3">
                <p className="text-sm font-semibold text-foreground">{decision.action}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-subtle">
                  <span className="inline-flex items-center gap-1"><PhoneCall className="size-3" />{decision.executor}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="size-3" />{dateTime(decision.scheduledAt)}</span>
                  {wf && <span className="inline-flex items-center gap-1"><GitBranch className="size-3" />{wf.id} {wf.name}</span>}
                </p>
                {decision.frozen && <StatusPill status="failed" className="mt-2">Outreach frozen</StatusPill>}
                {decision.cancelledReason && <StatusPill status="attention" className="mt-2">Cancelled: {decision.cancelledReason}</StatusPill>}
                {(() => {
                  const v = VENDORS.find((x) => x.name === decision.executor);
                  return v && vendorModes[v.id] === "Observe" ? (
                    <p className="mt-2 text-[11px] text-subtle"><StatusPill status="simulated">Observe mode</StatusPill> Desible suggests this action; {v.name} acts on its own list.</p>
                  ) : null;
                })()}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="tint" size="sm" className="mt-3">
                    <Zap /> Record event <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 border-border bg-card">
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Record an event</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SIMULATED_EVENTS.map((ev) => (
                    <DropdownMenuItem
                      key={ev}
                      className="cursor-pointer text-xs"
                      onSelect={() => {
                        simulate(policy.policyId, ev);
                        toast(` recorded on `, { description: "State, next action and audit log updated." });
                      }}
                    >
                      {ev}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </section>

            <section className="px-6 py-4">
              <Eyebrow className="flex items-center gap-1.5"><History className="size-3" /> Timeline</Eyebrow>
              <ol className="mt-3 space-y-3 border-l border-border pl-4">
                {timeline.map((t, i) => (
                  <li key={`${t.at}-${i}`} className="relative">
                    <span
                      className={
                        "absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-background " +
                        (t.kind === "decision" ? "bg-primary" : t.kind === "state" ? "bg-attention" : t.kind === "touch" ? "bg-file" : "bg-subtle")
                      }
                      aria-hidden
                    />
                    <p className="text-[11px] text-muted-foreground">{dateTime(t.at)}{t.channel && ` · ${t.channel}`}</p>
                    <p className="text-[13px] font-semibold text-foreground">{t.title}</p>
                    {t.detail && <p className="text-xs text-subtle">{t.detail}</p>}
                  </li>
                ))}
              </ol>
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-dim">
                <MessageSquare className="size-3" /> Touches in last 30 days: {policy.touchesLast30d}
              </p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
