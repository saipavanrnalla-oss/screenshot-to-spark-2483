import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { HeartCrack, LogOut, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eyebrow, PageHeader, Panel, StatusPill } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { PolicyDrawer } from "@/components/persistency/policy-drawer";
import { PolicyTable } from "@/components/persistency/policy-table";
import { SUB_STEPS, matchesSub, subLabel, trackStation } from "@/components/persistency/lifecycle-model";
import { useScopedPolicies } from "@/hooks/use-shell";
import { STAGE_COLUMNS, WARMING_STATIONS, stageColumn, type StageColumn } from "@/data/persistency";
import { usePersistencyStore, useStationLabel } from "@/store/persistency";
import { money, num } from "@/lib/format";
import { cn } from "@/lib/utils";

const lifecycleSearch = z.object({
  sub: fallback(z.string().optional(), undefined),
  q: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/stages")({
  beforeLoad: ({ search }) => gate("stages", search),
  validateSearch: zodValidator(lifecycleSearch),
  head: () => ({
    meta: [
      { title: "Lifecycle · Persistency · desible.ai" },
      { name: "description", content: "Sourcing, warming, renewal window, lapse and revival: counts, money at stake and every sub-step, with the policy list underneath." },
      { property: "og:title", content: "Policy lifecycle · Persistency control tower" },
      { property: "og:description", content: "Four stages, nine warming stations, grace and revival, with the rule behind every next action." },
    ],
  }),
  component: LifecyclePage,
});

const COLUMN_NOTES: Record<StageColumn, string> = {
  Sourcing: "Issue to end of free-look",
  Warming: "Nine stations, T-365 to T",
  "Renewal window": "T-90 to grace end",
  "Lapse and revival": "Early 180 days or less, late over 180",
};

function LifecyclePage() {
  const search = Route.useSearch();
  const sub = search.sub ?? "";
  const q = search.q ?? "";
  const navigate = useNavigate({ from: "/persistency/stages" });
  const { scoped } = useScopedPolicies();
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const stationLabel = useStationLabel();
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);
  const [query, setQuery] = useState(q);

  const setSub = (next: string) => navigate({ search: (prev) => ({ ...prev, sub: prev.sub === next ? undefined : next }) });

  const counts = useMemo(() => {
    const col: Record<StageColumn, { count: number; premium: number }> = {
      Sourcing: { count: 0, premium: 0 },
      Warming: { count: 0, premium: 0 },
      "Renewal window": { count: 0, premium: 0 },
      "Lapse and revival": { count: 0, premium: 0 },
    };
    const subs: Record<string, number> = {};
    const allSubs = Object.values(SUB_STEPS).flat().map((s) => s.key).concat(["wants-out", "holds"]);
    for (const p of scoped) {
      const c = col[stageColumn(p.lifecycleStage)];
      c.count++;
      c.premium += p.annualisedPremium;
      for (const k of allSubs) {
        if (k.startsWith("station-")) continue;
        if (matchesSub(p, k, activeCohortSet)) subs[k] = (subs[k] ?? 0) + 1;
      }
      const st = trackStation(p);
      if (st) subs[`station-${st}`] = (subs[`station-${st}`] ?? 0) + 1;
    }
    return { col, subs };
  }, [scoped, activeCohortSet]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return scoped.filter((p) => matchesSub(p, sub, activeCohortSet) && (!needle || p.policyId.includes(needle) || p.customerName.toUpperCase().includes(needle)));
  }, [scoped, sub, q, activeCohortSet]);

  const maxStation = Math.max(1, ...WARMING_STATIONS.map((s) => counts.subs[`station-${s.n}`] ?? 0));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Lifecycle"
        title="Every policy, four stages"
        description="Click a stage or sub-step to filter the policy list. Click a policy to see why it is where it is."
        tiers={["live-engine"]}
      />

      {/* Interrupts drawn across all stages */}
      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setSub("wants-out")}
          aria-pressed={sub === "wants-out"}
          className={cn("flex cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors", sub === "wants-out" ? "border-primary bg-brand-tint" : "border-attention/40 bg-attention/10 hover:border-attention")}
        >
          <LogOut className="size-4 shrink-0 text-attention" aria-hidden />
          <span className="flex-1">
            <span className="block text-[13px] font-bold text-foreground">Interrupt: Wants out</span>
            <span className="block text-xs text-subtle">Any stage. Routes to surrender retention, no collection calls.</span>
          </span>
          <span className="text-lg font-extrabold text-foreground tabular">{num(counts.subs["wants-out"] ?? 0)}</span>
        </button>
        <button
          type="button"
          onClick={() => setSub("holds")}
          aria-pressed={sub === "holds"}
          className={cn("flex cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors", sub === "holds" ? "border-primary bg-brand-tint" : "border-failed/40 bg-failed/10 hover:border-failed")}
        >
          <HeartCrack className="size-4 shrink-0 text-failed" aria-hidden />
          <span className="flex-1">
            <span className="block text-[13px] font-bold text-foreground">Interrupt: Complaint, bereavement or stop-calling</span>
            <span className="block text-xs text-subtle">Any stage. Freezes the policy; all outreach stops.</span>
          </span>
          <span className="text-lg font-extrabold text-foreground tabular">{num(counts.subs["holds"] ?? 0)}</span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {STAGE_COLUMNS.map((c, i) => {
          const colActive = sub === `stage:${c}`;
          return (
            <section key={c} className={cn("panel flex flex-col", colActive && "border-primary")}>
              <button type="button" onClick={() => setSub(`stage:${c}`)} aria-pressed={colActive} className="cursor-pointer border-b border-border px-5 py-4 text-left transition-colors hover:bg-brand-tint">
                <div className="flex items-center justify-between">
                  <Eyebrow>{i + 1} · {c}</Eyebrow>
                  <span className="text-[10px] text-dim">{COLUMN_NOTES[c]}</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="stat-number">{num(counts.col[c].count)}</span>
                  <span className="stat-label">policies</span>
                </div>
                <p className="text-xs text-subtle tabular">{money(counts.col[c].premium)} annual premium at stake</p>
              </button>

              <div className="flex-1 p-3">
                {c === "Warming" ? (
                  <div className="px-2 py-1">
                    <div className="flex items-end justify-between gap-1" role="list" aria-label="Nine warming stations">
                      {WARMING_STATIONS.map((s) => {
                        const k = `station-${s.n}`;
                        const n = counts.subs[k] ?? 0;
                        const size = 10 + Math.round((n / maxStation) * 14);
                        return (
                          <button
                            key={s.n}
                            role="listitem"
                            type="button"
                            onClick={() => setSub(k)}
                            aria-pressed={sub === k}
                            title={`Station ${s.n} (T${s.dayOffset}): ${stationLabel(s.n, s.label)}`}
                            className="group flex cursor-pointer flex-col items-center gap-1"
                          >
                            <span className="text-[10px] font-semibold text-subtle tabular">{num(n)}</span>
                            <span
                              className={cn("rounded-full border transition-colors", sub === k ? "border-primary bg-primary" : s.n >= 7 ? "border-brand-tint-border bg-brand-tint group-hover:bg-primary" : "border-primary/60 bg-primary/50 group-hover:bg-primary")}
                              style={{ width: size, height: size }}
                            />
                            <span className="text-[10px] text-muted-foreground">{s.n}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-dim">Stations 7 to 9 run inside the renewal window.</p>
                    <table className="mt-3 w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          <th className="py-1 font-bold">#</th>
                          <th className="py-1 font-bold">Day</th>
                          <th className="py-1 font-bold">Channel</th>
                          <th className="py-1 font-bold">Content</th>
                        </tr>
                      </thead>
                      <tbody>
                        {WARMING_STATIONS.map((s) => (
                          <tr key={s.n} className="border-t border-border/60 align-top">
                            <td className="py-1 pr-2 text-subtle">{s.n}</td>
                            <td className="py-1 pr-2 text-subtle tabular">T{s.dayOffset}</td>
                            <td className="py-1 pr-2 text-subtle">{s.channel}</td>
                            <td className="py-1 text-subtle"><span className="font-semibold text-foreground">{stationLabel(s.n, s.label)}</span> · {s.content}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {SUB_STEPS[c].map((s) => (
                      <li key={s.key}>
                        <button
                          type="button"
                          onClick={() => setSub(s.key)}
                          aria-pressed={sub === s.key}
                          className={cn("flex w-full cursor-pointer items-center justify-between gap-3 rounded-input px-3 py-2 text-left transition-colors", sub === s.key ? "bg-brand-tint ring-1 ring-brand-tint-border" : "hover:bg-surface-translucent")}
                        >
                          <span>
                            <span className="block text-[13px] font-semibold text-foreground">{s.label}</span>
                            {s.hint && <span className="block text-[11px] text-muted-foreground">{s.hint}</span>}
                          </span>
                          <span className="text-sm font-bold text-foreground tabular">{num(counts.subs[s.key] ?? 0)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {c === "Renewal window" && (
                  <p className="mt-2 px-3 text-[10px] text-dim">Grace is computed from payment mode: 15 days for Monthly, 30 days for every other mode.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Panel
        eyebrow="Policies"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {subLabel(sub)}
            <span className="text-xs font-semibold text-muted-foreground tabular">{num(filtered.length)}</span>
            {sub && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => navigate({ search: (prev) => ({ ...prev, sub: undefined }) })}>
                <X className="size-3" /> Clear filter
              </Button>
            )}
          </span>
        }
        actions={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ search: (prev) => ({ ...prev, q: query || undefined }) });
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Policy number or name"
              aria-label="Search policies"
              className="h-8 w-56 rounded-input border-border bg-surface-translucent pl-8 text-xs"
            />
          </form>
        }
      >
        <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          Next action and executor come from the live engine <TierBadge tiers={["live-engine"]} />
          <StatusPill status="simulated" className="ml-1">Payments simulated</StatusPill>
        </div>
        <PolicyTable key={`${sub}|${q}`} policies={filtered} onOpen={setOpenPolicy} emptyAction={
          <Button variant="outline" size="sm" onClick={() => navigate({ search: (prev) => ({ ...prev, sub: undefined, q: undefined }) })}>Show all policies</Button>
        } />
      </Panel>

      <PolicyDrawer policyId={openPolicy} onClose={() => setOpenPolicy(null)} />
    </div>
  );
}
