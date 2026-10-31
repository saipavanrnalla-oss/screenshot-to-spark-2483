import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Eyebrow, NoteBanner, PageHeader, Panel, StatusPill } from "@/components/ds/primitives";
import { PersistencyTable } from "@/components/persistency/persistency-table";
import { RunRateChart, useMonth } from "@/components/persistency/month";
import { HoldoutCompare } from "@/components/persistency/holdout";
import { useScopedPolicies, useShell } from "@/hooks/use-shell";
import { UNIT_COSTS, type Policy, type Rule } from "@/data/persistency";
import { usePersistencyStore, type PendingChange, type ProofMethod } from "@/store/persistency";
import { croreValue, inr, money, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/persistency/measurement")({
  head: () => ({
    meta: [
      { title: "Measurement · Persistency · desible.ai" },
      { name: "description", content: "Premium-weighted persistency, collection funnel and the proof method behind any claimed uplift." },
      { property: "og:title", content: "Measurement · Persistency · desible.ai" },
      { property: "og:description", content: "Premium-weighted persistency, collection funnel and the proof method behind any claimed uplift." },
    ],
  }),
  component: MeasurementPage,
});

const METHODS: { id: Exclude<ProofMethod, "none">; label: string; needs: string[]; earliest: string }[] = [
  { id: "holdout", label: "15% random holdout", needs: ["A fixed 15% of policies get business-as-usual only", "At least one full monthly due cycle", "The holdout list frozen before the first action"], earliest: "30 Nov 2026" },
  { id: "staggered", label: "Staggered rollout by region", needs: ["A rollout order agreed by region (for example West, then South)", "Two regions per wave, at least one month apart", "No other change in those regions during the read"], earliest: "31 Dec 2026" },
  { id: "yoy", label: "Year-on-year", needs: ["Last year's persistency files for the same months", "Adjustment for product mix and mode changes", "Weakest method: other changes over the year are not separated out"], earliest: "30 Nov 2026" },
];

interface LearnProposal {
  id: string;
  title: string;
  rule: Rule;
  match: (p: Policy) => boolean;
  outcome: (p: Policy) => boolean;
  evidenceLabel: string;
}

const LEARN: LearnProposal[] = [
  {
    id: "R19",
    title: "Monthly Term on UPI autopay pays without a pre-due reminder",
    match: (p) => p.product === "Term" && p.paymentMode === "Monthly" && p.paymentMethod === "UPI autopay" && !!p.monthDue && p.monthDue.status !== "upcoming",
    outcome: (p) => p.monthDue?.status === "paid" && p.touchesLast30d === 0,
    evidenceLabel: "paid with no touch at all",
    rule: { id: "R19", name: "Monthly Term on UPI autopay: no pre-due reminder", stage: "Renewal window", level: "rule", priority: 26, source: "Proposed by Desible, insurer to confirm", when: { product: ["Term"], paymentMode: ["Monthly"], paymentMethod: ["UPI autopay"], stage: ["Renewal window"] }, then: { workflowId: "X2", action: "Watch only, autopay expected", executor: "Desible", delayHours: 24 }, effectiveFrom: "2026-11-01", needsApprovalFrom: "Head of Persistency" },
  },
  {
    id: "R20",
    title: "Traditional policies whose advisor left respond to a field visit before a call",
    match: (p) => p.product === "Traditional" && p.advisorStatus === "Left" && p.lastTouchChannel === "Field visit" && !!p.monthDue && p.monthDue.status !== "upcoming",
    outcome: (p) => p.monthDue?.status === "paid",
    evidenceLabel: "paid after a field visit",
    rule: { id: "R20", name: "Traditional, advisor left, grace: field visit before call", stage: "Renewal window", level: "rule", priority: 19, source: "Proposed by Desible, insurer to confirm", when: { product: ["Traditional"], advisorStatus: ["Left"], state: ["Grace"] }, then: { workflowId: "R5", action: "Field visit before any call", executor: "Sales officer", delayHours: 24 }, effectiveFrom: "2026-11-01", needsApprovalFrom: "Regional lead" },
  },
  {
    id: "R21",
    title: "Bengali-speaking customers in grace answer a Bengali voice bot first",
    match: (p) => p.language === "Bengali" && p.lastTouchChannel === "Voice bot" && !!p.monthDue && p.monthDue.status !== "upcoming",
    outcome: (p) => p.monthDue?.status === "paid" || p.monthDue?.status === "promised",
    evidenceLabel: "paid or promised after a voice-bot call",
    rule: { id: "R21", name: "Bengali, grace: Bengali voice bot first", stage: "Renewal window", level: "rule", priority: 22, source: "Proposed by Desible, insurer to confirm", when: { language: ["Bengali"], state: ["Grace"] }, then: { workflowId: "R2", action: "Voice bot in Bengali, then telecall", executor: "Ubona", delayHours: 2 }, effectiveFrom: "2026-11-01", needsApprovalFrom: "Head of Persistency" },
  },
];

function MeasurementPage() {
  const { scoped } = useScopedPolicies();
  const { persona } = useShell();
  const m = useMonth();
  const proof = usePersistencyStore((s) => s.proofMethod);
  const setProof = usePersistencyStore((s) => s.setProofMethod);
  const rules = usePersistencyStore((s) => s.rules);
  const pending = usePersistencyStore((s) => s.pending);
  const applyNow = usePersistencyStore((s) => s.applyNow);
  const approve = usePersistencyStore((s) => s.approve);
  const [costs, setCosts] = useState<Record<string, number>>(() => Object.fromEntries(Object.entries(UNIT_COSTS).map(([k, v]) => [k, v.cost])));

  const funnel = useMemo(() => {
    let due = 0, reached = 0, promised = 0, paid = 0;
    for (const p of scoped) {
      const d = p.monthDue;
      if (!d || d.status === "upcoming") continue;
      due++;
      const isPaid = d.status === "paid";
      const isPromised = d.status === "promised" || p.state === "Promised";
      if (p.touchesLast30d > 0 || isPaid) reached++;
      if (isPromised || isPaid) promised++;
      if (isPaid) paid++;
    }
    return [
      { step: "Due so far", n: due, def: "Instalments due this month up to today" },
      { step: "Reached", n: reached, def: "At least one touch in 30 days, or paid (autopay counts)" },
      { step: "Promised or paid", n: promised, def: "Gave a date, or already paid" },
      { step: "Paid", n: paid, def: "Receipt in the receipts file" },
    ];
  }, [scoped]);

  const cost = useMemo(() => {
    let spend = 0;
    const rows = Object.keys(UNIT_COSTS).map((v) => {
      const touches = scoped.filter((p) => p.assignedVendor === v).reduce((s, p) => s + p.touchesLast30d, 0);
      const s = touches * (costs[v] ?? 0) * m.col.scale;
      spend += s;
      return { v, touches, s };
    });
    const collected = m.col.collectedCr * 1e7;
    return { rows, spend, perRupee: collected ? spend / collected : 0 };
  }, [scoped, costs, m.col.scale, m.col.collectedCr]);

  const learnPending = pending.filter((c) => c.source === "Learn step");
  const learn = useMemo(
    () =>
      LEARN.map((l) => {
        const base = scoped.filter(l.match);
        return { l, base: base.length, hits: base.filter(l.outcome).length };
      }),
    [scoped],
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader eyebrow="Measurement" title="Measurement and proof" description="What is happening, computed from the seeded book, and how any uplift would be proven." tiers={["live-engine", "simulated"]} />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel eyebrow="Persistency" title="Premium-weighted, 13M to 61M" tiers={["live-engine"]}>
          <PersistencyTable policies={scoped} />
        </Panel>
        <Panel eyebrow="Renewal collection" title={`${croreValue(m.col.collectedCr)} of ${croreValue(m.col.planCr)} plan · run-rate ${croreValue(m.runRate, 2)} a day`} tiers={["live-engine", "simulated"]}>
          <RunRateChart height={250} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Funnel" title="Due, reached, promised, paid" tiers={["live-engine"]}>
          <ul className="space-y-2.5">
            {funnel.map((f, i) => {
              const prev = i === 0 ? f.n : funnel[i - 1]!.n;
              return (
                <li key={f.step}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-foreground">{f.step}</span>
                    <span className="text-subtle tabular">{num(f.n)}{i > 0 && ` · ${pct(f.n / Math.max(prev, 1))} of previous step`}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-translucent"><div className="h-full rounded-full bg-primary" style={{ width: `${(f.n / Math.max(funnel[0]!.n, 1)) * 100}%` }} /></div>
                  <p className="mt-0.5 text-[11px] text-dim">{f.def}</p>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel eyebrow="Cost per rupee collected" title={`${inr(cost.perRupee * 100)} spent per ₹100 collected`} tiers={["simulated"]}>
          <NoteBanner tone="attention" className="mb-3">Illustrative inputs. Replace with your vendor rates; nothing here is a saving claim.</NoteBanner>
          <DataTable head={["Vendor", "Unit cost (₹)", "Touches (30 days)", "Spend this month"]} minWidth={460}>
            {cost.rows.map((r) => (
              <tr key={r.v}>
                <td className="font-semibold text-foreground">{r.v} <span className="text-[11px] font-normal text-muted-foreground">{UNIT_COSTS[r.v]?.unit}</span></td>
                <td>
                  <Input type="number" min={0} step={0.5} value={costs[r.v] ?? 0} onChange={(e) => setCosts((c) => ({ ...c, [r.v]: Number(e.target.value) }))} aria-label={`Unit cost for ${r.v}`} className="h-7 w-20 rounded-input border-border bg-surface-translucent text-xs tabular" />
                </td>
                <td className="text-subtle tabular">{num(r.touches)}</td>
                <td className="text-subtle tabular">{money(r.s)}</td>
              </tr>
            ))}
          </DataTable>
          <p className="mt-2 text-xs text-subtle">Total spend {money(cost.spend)} against {croreValue(m.col.collectedCr)} collected, scaled to the book.</p>
        </Panel>
      </div>

      <Panel eyebrow="Proof method" title="How any uplift would be proven" tiers={["live-engine", "simulated"]}>
        <div className="grid gap-3 md:grid-cols-3">
          {METHODS.map((mm) => (
            <button
              key={mm.id}
              type="button"
              onClick={() => setProof(proof === mm.id ? "none" : mm.id)}
              aria-pressed={proof === mm.id}
              className={cn("cursor-pointer rounded-input border p-4 text-left transition-colors", proof === mm.id ? "border-primary bg-brand-tint" : "border-border bg-surface-translucent hover:border-brand-tint-border")}
            >
              <p className="text-[13px] font-bold text-foreground">{mm.label}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-subtle">{mm.needs.map((n) => <li key={n}>{n}</li>)}</ul>
              <p className="mt-2 text-[11px] text-muted-foreground">Earliest read: {mm.earliest}</p>
            </button>
          ))}
        </div>
        <div className="mt-5">
          {proof === "none" ? (
            <NoteBanner tone="attention"><span className="font-semibold">No uplift is claimed until a proof method is agreed.</span> Pick one above to see what it needs and when it can first be read.</NoteBanner>
          ) : proof === "holdout" ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <HoldoutCompare policies={scoped} />
              <div className="space-y-2 text-xs text-subtle">
                <Eyebrow>How to read this</Eyebrow>
                <p>Bars show the share of this month's due instalments paid so far, for the treatment group and the fixed 15% holdout. The whisker is the 95% range.</p>
                <p>In this demo nothing has been run against the holdout yet, so any gap is noise in synthetic data. The first real read is due on 30 Nov 2026.</p>
              </div>
            </div>
          ) : (
            <NoteBanner>Agreed: {METHODS.find((x) => x.id === proof)?.label}. No result yet; the first read is on {METHODS.find((x) => x.id === proof)?.earliest}. No uplift is shown before then.</NoteBanner>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Learn" title="Rule changes proposed from outcomes" tiers={["live-engine"]}>
        <ul className="space-y-3">
          {learnPending.map((c: PendingChange) => (
            <li key={c.id} className="rounded-input border border-border bg-surface-translucent p-3">
              <p className="text-[13px] font-semibold text-foreground">{c.title}</p>
              <p className="text-xs text-subtle">{c.effect}. Waiting in Head of Persistency approvals.</p>
              <Button size="sm" className="mt-2" disabled={persona.id !== "head"} onClick={() => { approve(c.id); toast(`Approved: ${c.title}`); }}><Check /> Approve</Button>
            </li>
          ))}
          {learn.map(({ l, base, hits }) => {
            const live = rules.some((r) => r.id === l.id);
            return (
              <li key={l.id} className="rounded-input border border-border bg-surface-translucent p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-sm bg-brand-tint px-1.5 text-[11px] font-bold text-primary">{l.id}</span>
                  <p className="text-[13px] font-semibold text-foreground">{l.title}</p>
                  {live && <StatusPill status="healthy">Live</StatusPill>}
                </div>
                <p className="mt-1 text-xs text-subtle">Evidence: {num(hits)} of {num(base)} matching policies {l.evidenceLabel} this month (synthetic). {base < 30 ? "Too few to act on yet." : ""}</p>
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={live || base < 30 || persona.id !== "head"}
                  onClick={() => {
                    applyNow({ id: `PC-${l.id}`, title: l.title, source: "Learn step", proposedBy: "Desible (from outcomes)", at: new Date().toISOString(), rule: l.rule }, persona.label);
                    toast(`Approved: ${l.title}`, { description: `${l.id} is live from the next decision.` });
                  }}
                >
                  <Check /> Approve
                </Button>
              </li>
            );
          })}
        </ul>
        {persona.id !== "head" && <p className="mt-2 text-[11px] text-muted-foreground">Only the Head of Persistency can approve. Switch persona to try it.</p>}
      </Panel>
    </div>
  );
}
