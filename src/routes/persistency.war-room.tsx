import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NoteBanner, PageHeader, Panel, DataTable } from "@/components/ds/primitives";
import { AXIS_TICK, GRID, SERIES, TOOLTIP_STYLE } from "@/components/ds/chart-theme";
import { RunRateChart, TODAY, useMonth } from "@/components/persistency/month";
import { RecommendationsList } from "@/components/persistency/recommendations";
import { PanelDataContext, PANEL_COMPONENTS } from "@/components/persistency/persona-panels";
import { PolicyDrawer } from "@/components/persistency/policy-drawer";
import { useScopedPolicies } from "@/hooks/use-shell";
import { cohortLabel } from "@/engine/persistency";
import { useDecisions, usePersistencyStore } from "@/store/persistency";
import { croreValue, num, pct } from "@/lib/format";

export const Route = createFileRoute("/persistency/war-room")({
  head: () => ({
    meta: [
      { title: "Month-end war room · Persistency · desible.ai" },
      { name: "description", content: "Collection against plan, run-rate and rule-based reallocations for the last days of the month." },
      { property: "og:title", content: "Month-end war room · Persistency · desible.ai" },
      { property: "og:description", content: "Collection against plan, run-rate and rule-based reallocations for the last days of the month." },
    ],
  }),
  component: WarRoomPage,
});

function Gauge({ value, max }: { value: number; max: number }) {
  const share = Math.max(0, Math.min(1, value / Math.max(max, 0.0001)));
  const r = 80, cx = 100, cy = 95;
  const angle = Math.PI * (1 - share);
  const x = cx + r * Math.cos(angle), y = cy - r * Math.sin(angle);
  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[280px]" role="img" aria-label={`Collected ${pct(share, 0)} of plan`}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--border)" strokeWidth="14" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`} fill="none" stroke="var(--primary)" strokeWidth="14" strokeLinecap="round" />
      <text x={cx} y={cy - 18} textAnchor="middle" className="fill-foreground" style={{ fontSize: 26, fontWeight: 800 }}>{pct(share, 0)}</text>
      <text x={cx} y={cy} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted-foreground)" }}>of plan collected</text>
    </svg>
  );
}

function WarRoomPage() {
  const m = useMonth();
  const { scoped, all, product } = useScopedPolicies();
  const decisions = useDecisions(scoped);
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);
  const ctx = useMemo(() => ({ scoped, all, product, decisions, openPolicy: setOpenPolicy }), [scoped, all, product, decisions]);
  const Leaderboard = PANEL_COMPONENTS["team-collection"];

  const daily = m.chart.filter((d) => d.day <= TODAY).map((d) => ({ label: d.label, collected: d.daily ?? 0 }));

  const week = useMemo(() => {
    const map = new Map<string, { due: number; paidWeek: number; paid: number }>();
    for (const p of scoped) {
      const d = p.monthDue;
      if (!d || d.status === "upcoming") continue;
      const c = cohortLabel(p, activeCohortSet[p.product]);
      const r = map.get(c) ?? { due: 0, paidWeek: 0, paid: 0 };
      r.due++;
      if (d.status === "paid") {
        r.paid++;
        if (d.paidOn && d.paidOn >= "2026-10-22") r.paidWeek++;
      }
      map.set(c, r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [scoped, activeCohortSet]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <PageHeader
        eyebrow="Month-end war room · October 2026"
        title="Month-end war room"
        description={`${m.daysLeft} days left after today. ${product === "All" ? "All products" : product}.`}
        tiers={["live-engine", "simulated"]}
      />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Panel eyebrow="Collection vs plan" title={`${croreValue(m.col.collectedCr)} of ${croreValue(m.col.planCr)}`} tiers={["live-engine", "simulated"]}>
          <div className="flex justify-center"><Gauge value={m.col.collectedCr} max={m.col.planCr} /></div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            {[
              ["Gap to plan", croreValue(m.gap)],
              ["Run-rate per day", croreValue(m.runRate, 2)],
              ["Needed per day", croreValue(m.required, 2)],
              ["Month-end at run-rate", croreValue(m.projected)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-input border border-border bg-surface-translucent p-2.5">
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="text-base font-extrabold text-foreground tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel eyebrow="Run-rate" title="Cumulative collection vs plan and required rate" tiers={["live-engine", "simulated"]}>
          <RunRateChart height={280} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Day by day" title="Collected each day vs the rate now needed" tiers={["simulated"]}>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} interval={3} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" Cr" width={56} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => `₹${v.toFixed(2)} Cr`} />
                <ReferenceLine y={+m.required.toFixed(2)} stroke={SERIES[3]} strokeDasharray="4 4" label={{ value: `Needed ₹${m.required.toFixed(1)} Cr a day`, fill: "var(--muted-foreground)", fontSize: 10, position: "insideTopRight" }} />
                <Bar dataKey="collected" name="Collected" fill={SERIES[0]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel eyebrow="Cohort performance this week" title="Paid since 22 Oct, by cohort of the active set" tiers={["live-engine"]}>
          <DataTable head={["Cohort", "Due so far", "Paid this week", "Paid this month", "Paid rate"]} minWidth={440} maxHeight={240}>
            {week.map(([c, r]) => (
              <tr key={c}>
                <td className="font-semibold text-foreground">{c}</td>
                <td className="text-subtle tabular">{num(r.due)}</td>
                <td className="text-subtle tabular">{num(r.paidWeek)}</td>
                <td className="text-subtle tabular">{num(r.paid)}</td>
                <td className="font-semibold text-foreground tabular">{pct(r.paid / Math.max(r.due, 1))}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Panel eyebrow="Team leaderboard" title="Collection by telecalling team" tiers={["live-engine"]}>
          <PanelDataContext.Provider value={ctx}>
            <Leaderboard />
          </PanelDataContext.Provider>
        </Panel>
        <Panel eyebrow="Recommendations" title="Rule-based moves for the last days" tiers={["live-engine"]}>
          <NoteBanner className="mb-3">Rule-based, not AI. Each effect is a range with its assumption. Approving writes a pending change; nothing moves until it is approved.</NoteBanner>
          <RecommendationsList />
        </Panel>
      </div>

      <PolicyDrawer policyId={openPolicy} onClose={() => setOpenPolicy(null)} />
    </div>
  );
}
