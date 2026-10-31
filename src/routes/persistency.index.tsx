import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, FileWarning, GitMerge, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard, StatusPill, Eyebrow, EmptyState } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { PolicyDrawer } from "@/components/persistency/policy-drawer";
import { useScopedPolicies, useShell } from "@/hooks/use-shell";
import { FILE_ADAPTERS, NOW_ISO, collection, headline, stageSummary, workflowById } from "@/data/persistency";
import type { Tier } from "@/data/persistency/workflows";
import { cohortLabel } from "@/engine/persistency";
import { TICK_MS, useDecisions, usePersistencyStore } from "@/store/persistency";
import { croreValue, money, num, pct, time } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/persistency/")({
  head: () => ({
    meta: [
      { title: "Control Tower · Persistency · desible.ai" },
      { name: "description", content: "Every policy from sourcing to revival on one screen: lifecycle, live decisions, approvals and the six-step spine." },
      { property: "og:title", content: "Persistency Control Tower" },
      { property: "og:description", content: "Every policy from sourcing to revival on one screen, with the rule behind each decision." },
    ],
  }),
  component: ControlTower,
});

interface SpineStep {
  key: string;
  label: string;
  value: string;
  caption: string;
  explain: string;
  tiers: Tier[];
}

function ControlTower() {
  const { scoped, all, product } = useScopedPolicies();
  const { persona } = useShell();
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);
  const [spineOpen, setSpineOpen] = useState<SpineStep | null>(null);

  const pending = usePersistencyStore((s) => s.pending);
  const approve = usePersistencyStore((s) => s.approve);
  const reject = usePersistencyStore((s) => s.reject);
  const receipts = usePersistencyStore((s) => s.receipts);
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const killedWorkflows = usePersistencyStore((s) => s.killedWorkflows);
  const tick = usePersistencyStore((s) => s.tick);
  const ticker = usePersistencyStore((s) => s.ticker);

  useEffect(() => {
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  const stats = useMemo(() => headline(scoped), [scoped]);
  const col = useMemo(() => collection(all, product), [all, product]);
  const stages = useMemo(() => stageSummary(scoped), [scoped]);
  const decisions = useDecisions(scoped);

  const spine = useMemo(() => {
    const receiptSet = new Set(receipts);
    const enabled = FILE_ADAPTERS.filter((a) => a.enabled);
    const filesToday = enabled.filter((a) => a.lastReceived.startsWith("28 Oct 2026")).length;
    const cohorted = scoped.filter((p) => cohortLabel(p, activeCohortSet[p.product]) !== "Unscored").length;
    let decided = 0, sent = 0, conflicts = 0, capHeld = 0;
    for (const p of scoped) {
      const d = decisions.get(p.policyId)!;
      if (d.conflictWith) conflicts++;
      if (d.ruleId === "G2") capHeld++;
      if (p.lifecycleStage === "Warming" || d.ruleId === "none") continue;
      decided++;
      if (!d.frozen && !d.cancelledReason && d.executor !== "None") sent++;
    }
    const verified = scoped.filter((p) => p.monthDue?.paidOn === NOW_ISO || receiptSet.has(p.policyId)).length;
    const steps: SpineStep[] = [
      { key: "ingest", label: "Ingest", value: `${filesToday} of ${enabled.length}`, caption: "files received today", explain: "Reads your extracts (due list, receipts, bounces, mandates, advisors, vendor dispositions) over SFTP or a database view. A late file pauses only the decisions that depend on it.", tiers: ["simulated"] },
      { key: "cohort", label: "Cohort", value: num(cohorted), caption: "policies cohorted", explain: "Every policy gets a cohort from the set active for its product: your own file, your rules, or the Desible starter score. Policies without a score stay visible as Unscored.", tiers: ["live-engine"] },
      { key: "decide", label: "Decide", value: num(decided), caption: "decisions made today", explain: "Deterministic rules pick the next action. Guardrails win, then insurer defaults, then the rule matching the most dimensions, then the priority number.", tiers: ["live-engine"] },
      { key: "act", label: "Act", value: num(sent), caption: "actions sent", explain: "Actions go out through your own vendors and teams, or Desible where you have agreed a slice. Holds, kill switch and stale inputs stop actions before they leave.", tiers: ["live-channels", "simulated"] },
      { key: "verify", label: "Verify", value: num(verified), caption: "outcomes verified today", explain: "Each outcome is checked against the next receipts and dispositions file, so a promise only counts once money arrives. Paid-meanwhile cases are cancelled automatically.", tiers: ["simulated"] },
      { key: "learn", label: "Learn", value: num(pending.length), caption: "rule changes proposed", explain: "Outcomes turn into proposed rule changes with the evidence count shown. Nothing changes until a named person approves it.", tiers: ["live-engine"] },
    ];
    return { steps, conflicts, capHeld };
  }, [scoped, decisions, receipts, activeCohortSet, pending.length]);

  const staleAdapters = FILE_ADAPTERS.filter((a) => a.stale);
  const visibleTicker = ticker.filter((t) => product === "All" || t.product === product).slice(0, 8);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow={persona.id === "head" ? "Control Tower · Head of Persistency" : "Control Tower"}
        title="Persistency control tower"
        description={`Every policy from sourcing to revival. Showing ${product === "All" ? "all products" : product}, as of 28 Oct 2026.`}
        tiers={["live-engine", "simulated"]}
      />

      {staleAdapters.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-attention/40 bg-attention/10 px-4 py-2.5 text-[13px] text-foreground">
          <StatusPill status="attention">Decisions paused for stale input</StatusPill>
          <span className="text-subtle">
            {staleAdapters.map((a) => (
              <span key={a.id}>
                <code className="font-semibold text-foreground">{a.name}</code> last arrived {a.lastReceived}. Paused:{" "}
                {a.feeds.map((f) => `${f} ${workflowById(f)?.name} (${workflowById(f)?.stage})`).join(", ")}. Other stages run normally.
              </span>
            ))}
          </span>
          <Link to="/persistency/data" className="ml-auto text-xs font-semibold text-primary hover:underline">Open data and integrations</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Policies in flight" value={num(stats.inFlight)} sub={`of ${num(scoped.length)} on book`} />
        <StatCard label="Due this month" value={num(stats.dueThisMonth)} sub={`${num(col.paidCount)} paid, ${num(col.upcomingCount)} not yet due`} />
        <StatCard
          label="Collected vs plan"
          value={croreValue(col.collectedCr)}
          sub={`of ${croreValue(col.planCr)} plan · ${pct(col.collectedCr / Math.max(col.planCr, 0.0001), 0)} · gap ${croreValue(col.planCr - col.collectedCr)}`}
        />
        <StatCard label="Promised not paid" value={num(stats.promisedNotPaid)} sub="Promise-to-pay follow-up running" />
        <StatCard label="Held" value={num(stats.held)} sub="Complaint, bereavement or do-not-contact" />
      </div>

      {/* Six-step spine */}
      <Panel eyebrow="How it runs" title="Six-step spine" tiers={["live-engine"]} bodyClassName="p-0">
        <ol className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {spine.steps.map((s, i) => (
            <li key={s.key} className="relative border-border max-xl:border-b xl:border-r xl:last:border-r-0">
              <button type="button" onClick={() => setSpineOpen(s)} className="group flex w-full cursor-pointer flex-col items-start gap-1 px-5 py-4 text-left transition-colors hover:bg-brand-tint">
                <span className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full border border-brand-tint-border bg-brand-tint text-[11px] font-bold text-primary">{i + 1}</span>
                  <span className="text-[13px] font-bold text-foreground">{s.label}</span>
                  {i < 5 && <ArrowRight className="size-3.5 text-dim max-xl:hidden" aria-hidden />}
                </span>
                <span className="stat-number mt-1">{s.value}</span>
                <span className="stat-label">{s.caption}</span>
              </button>
            </li>
          ))}
        </ol>
      </Panel>

      {/* Lifecycle strip */}
      <Panel
        eyebrow="Lifecycle"
        title="All four stages, live"
        tiers={["live-engine"]}
        actions={<Link to="/persistency/lifecycle" className="text-xs font-semibold text-primary hover:underline">Open lifecycle</Link>}
        bodyClassName="p-0"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {stages.map((s, i) => (
            <Link
              key={s.column}
              to="/persistency/lifecycle"
              search={(prev) => ({ ...prev, sub: `stage:${s.column}` })}
              className="group relative border-border px-5 py-4 transition-colors hover:bg-brand-tint max-lg:border-b lg:border-r lg:last:border-r-0"
            >
              <Eyebrow>{i + 1} · {s.column}</Eyebrow>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[22px] font-extrabold text-foreground tabular">{num(s.count)}</span>
                <span className="text-[11px] text-muted-foreground">policies</span>
              </div>
              <p className="text-xs text-subtle tabular">{money(s.premium)} annual premium at stake</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-translucent">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(s.count / Math.max(scoped.length, 1)) * 100}%` }} />
              </div>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        <Panel eyebrow="Needs a decision" title="Approvals, breaches and stale files" tiers={["live-engine"]}>
          <ul className="space-y-3">
            {pending.map((c) => (
              <li key={c.id} className="rounded-input border border-border bg-surface-translucent p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status="attention">Approval waiting</StatusPill>
                  <span className="text-[11px] text-muted-foreground">{c.source} · {c.proposedBy}</span>
                </div>
                <p className="mt-1.5 text-[13px] font-semibold text-foreground">{c.title}</p>
                {c.effect && <p className="text-xs text-subtle">{c.effect}</p>}
                <div className="mt-2.5 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      approve(c.id);
                      toast(`Approved: ${c.title}`, { description: `${c.rule.id} is now live. Counts and the decisions feed use it from the next decision.` });
                    }}
                  >
                    <Check /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reject(c.id)}>
                    <X /> Reject
                  </Button>
                </div>
              </li>
            ))}
            {staleAdapters.map((a) => (
              <li key={a.id} className="flex gap-3 rounded-input border border-border bg-surface-translucent p-3">
                <FileWarning className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{a.name} is late</p>
                  <p className="text-xs text-subtle">Expected by {a.expectedBy}, last arrived {a.lastReceived}. {a.feeds.join(", ")} paused until it arrives.</p>
                </div>
              </li>
            ))}
            {spine.capHeld > 0 && (
              <li className="flex gap-3 rounded-input border border-border bg-surface-translucent p-3">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{num(spine.capHeld)} policies at the contact cap</p>
                  <p className="text-xs text-subtle">G2 holds outreach after 8 touches in 30 days. Check whether vendor dialling caused it.</p>
                </div>
              </li>
            )}
            {spine.conflicts > 0 && (
              <li className="flex gap-3 rounded-input border border-border bg-surface-translucent p-3">
                <GitMerge className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{num(spine.conflicts)} policies match two rules equally</p>
                  <p className="text-xs text-subtle">Same level, same dimension count, same priority. The first by rule order is used and the tie is logged. Set a priority to resolve.</p>
                </div>
              </li>
            )}
            {killedWorkflows.length > 0 && (
              <li className="flex gap-3 rounded-input border border-border bg-surface-translucent p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-failed" aria-hidden />
                <p className="text-[13px] font-semibold text-foreground">Paused workflows: {killedWorkflows.join(", ")}</p>
              </li>
            )}
            {pending.length === 0 && staleAdapters.length === 0 && spine.capHeld === 0 && spine.conflicts === 0 && (
              <EmptyState title="Nothing needs a decision right now." />
            )}
          </ul>
        </Panel>

        <Panel
          eyebrow="Today's decisions"
          title={
            <span className="flex items-center gap-2">
              Live from the engine
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-primary" aria-hidden /> every 6 seconds
              </span>
            </span>
          }
          tiers={["live-engine"]}
          bodyClassName="p-0"
        >
          {visibleTicker.length === 0 ? (
            <div className="p-5"><EmptyState title={`No ${product} decisions yet in this session. The next one arrives within a few seconds.`} /></div>
          ) : (
            <ul aria-live="polite" className="divide-y divide-border/70">
              {visibleTicker.map((t) => (
                <li key={t.id} className="animate-ticker-in">
                  <button type="button" onClick={() => setOpenPolicy(t.decision.policyId)} className="grid w-full cursor-pointer grid-cols-[64px_1fr] gap-3 px-5 py-2.5 text-left transition-colors hover:bg-brand-tint">
                    <span className="pt-0.5 text-[11px] text-muted-foreground tabular">{time(t.at)}</span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                        <span className="font-semibold text-foreground tabular">{t.decision.policyId}</span>
                        <span className="text-dim">·</span>
                        <span className="text-muted-foreground">{t.product}</span>
                        <span className="rounded-sm bg-brand-tint px-1.5 text-[10px] font-bold text-primary">{t.decision.ruleId}</span>
                        <span className="truncate text-subtle">{t.decision.ruleName}</span>
                      </span>
                      <span className={cn("mt-0.5 flex flex-wrap items-center gap-2 text-[12px]", t.decision.cancelledReason || t.decision.frozen ? "text-muted-foreground" : "text-foreground")}>
                        {t.decision.action} <span className="text-dim">via</span> {t.decision.executor}
                        {t.decision.cancelledReason && <StatusPill status="attention">Cancelled: {t.decision.cancelledReason}</StatusPill>}
                        {t.decision.frozen && <StatusPill status="failed">Frozen</StatusPill>}
                        {t.note && !t.decision.frozen && <StatusPill status="healthy">{t.note}</StatusPill>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Sheet open={!!spineOpen} onOpenChange={(o) => !o && setSpineOpen(null)}>
        <SheetContent side="right" className="w-full border-border bg-background sm:max-w-[480px]">
          {spineOpen && (
            <>
              <SheetHeader className="text-left">
                <Eyebrow>Spine step</Eyebrow>
                <SheetTitle className="text-xl font-extrabold text-foreground">{spineOpen.label}</SheetTitle>
                <SheetDescription className="text-sm text-subtle">{spineOpen.explain}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="panel accent-left px-4 py-3">
                  <div className="stat-number">{spineOpen.value}</div>
                  <div className="stat-label">{spineOpen.caption}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Tier for this step <TierBadge tiers={spineOpen.tiers} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <PolicyDrawer policyId={openPolicy} onClose={() => setOpenPolicy(null)} />
    </div>
  );
}
