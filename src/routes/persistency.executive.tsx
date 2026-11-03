import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, BadgeCheck, CalendarClock, CreditCard, Hourglass, LineChart as LineIcon, Workflow, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ds/primitives";
import { AXIS_TICK, GRID, SERIES, TOOLTIP_STYLE } from "@/components/ds/chart-theme";
import { Kpi } from "@/components/r1/kpi";
import { LastUpdated } from "@/components/r1/kpi";
import { useMonth } from "@/components/persistency/month";
import { PERIOD_FACTOR, computeFunnel } from "@/components/r1/funnel-model";
import { prepare, useWorkflowRows, wfVersions } from "@/components/r1/wf-model";
import { premiumAtRisk } from "@/components/r1/report-model";
import { COHORTS } from "@/components/r1/policy-model";
import { CHANNELS, PRODUCTS, REGIONS } from "@/data/persistency";
import { hashId } from "@/data/persistency/derived";
import { branchOf } from "@/data/persistency/r1/common";
import { persistencySeries } from "@/data/persistency/r1/reports";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { gate } from "@/lib/gate";
import { crore, money, num, pct } from "@/lib/format";
import { useWork } from "@/store/work";
import { AGENTS } from "@/data/persistency";

export const Route = createFileRoute("/persistency/executive")({
  beforeLoad: ({ search }) => gate("executive", search),
  head: () => ({
    meta: [
      { title: "Executive dashboard · Persistency · desible.ai" },
      { name: "description", content: "Persistency ratios, premium at risk, regional and cohort cuts, and workflow results for the Head of Persistency." },
      { property: "og:title", content: "Executive dashboard · Persistency · desible.ai" },
      { property: "og:description", content: "Persistency ratios, premium at risk, regional and cohort cuts, and workflow results for the Head of Persistency." },
    ],
  }),
  component: ExecutiveDashboard,
});

const last = <T,>(a: T[]) => a[a.length - 1]!;
const prev = <T,>(a: T[]) => a[a.length - 2]!;

function heatColor(v: number, lo: number, hi: number): string {
  const t = hi === lo ? 0.5 : (hi - v) / (hi - lo); // lower persistency is darker
  return `color-mix(in srgb, #8b1d1d ${Math.round(18 + t * 62)}%, #fbe9d3)`;
}

function ExecutiveDashboard() {
  const { scoped } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const { col } = useMonth();
  const rows = useWorkflowRows().filter((r) => !r.archived);
  const saved = useWork((s) => s.versions);
  const approvals = useWork((s) => s.approvals);
  const pauses = useWork((s) => s.agentPause);

  const series = useMemo(() => persistencySeries({}), []);
  const now = last(series);
  const before = prev(series);
  const trend = series.slice(-12);

  const risk = useMemo(() => scoped.reduce((a, p) => a + premiumAtRisk(p), 0), [scoped]);
  const grace = useMemo(() => scoped.filter((p) => p.state === "Grace").length, [scoped]);
  const promised = useMemo(() => scoped.filter((p) => p.state === "Promised").length, [scoped]);
  const inWorkflows = useMemo(() => [...stats.count.values()].reduce((a, b) => a + b, 0), [stats.count]);

  const byRegion = useMemo(
    () => REGIONS.map((r) => ({ name: r, p13: last(persistencySeries({ region: r })).p13, risk: scoped.filter((p) => p.region === r).reduce((a, p) => a + premiumAtRisk(p), 0) })),
    [scoped],
  );
  const lo = Math.min(...byRegion.map((r) => r.p13));
  const hi = Math.max(...byRegion.map((r) => r.p13));
  const byProduct = PRODUCTS.map((x) => ({ name: x, "13th month": last(persistencySeries({ product: x })).p13, "25th month": last(persistencySeries({ product: x })).p25 }));
  const byChannel = CHANNELS.map((x) => ({ name: x, "13th month": last(persistencySeries({ channel: x })).p13, "25th month": last(persistencySeries({ channel: x })).p25 }));
  const byCohort = COHORTS.filter((c) => c !== "Unscored").map((c) => ({ name: c.replace(" propensity", ""), "13th month": last(persistencySeries({ cohort: c })).p13 }));

  const branches = useMemo(() => {
    const m = new Map<string, { risk: number; n: number }>();
    for (const p of scoped) {
      const r = premiumAtRisk(p);
      if (!r) continue;
      const b = branchOf(p);
      const x = m.get(b) ?? { risk: 0, n: 0 };
      x.risk += r;
      x.n++;
      m.set(b, x);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.risk - a.risk).slice(0, 6);
  }, [scoped]);

  const wf = useMemo(
    () =>
      rows
        .map((r) => {
          const list = wfVersions(saved, r.code);
          const g = (list.find((v) => v.status === "Active") ?? list[list.length - 1])?.data;
          if (!g) return null;
          const base = Math.max(stats.count.get(r.code) ?? 0, 140 + (hashId(r.code) % 220));
          const f = computeFunnel(prepare(g), base * PERIOD_FACTOR["Last 7 days"], scoped, r.code + "Last 7 days");
          const paid = f.outcomes.filter((o) => o.type === "outcome.paid").reduce((a, o) => a + o.count, 0);
          const canPay = g.nodes.some((n) => n.type === "outcome.paid");
          return canPay ? { code: r.code, name: r.name, started: f.total, paid } : null;
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => b.started - a.started)
        .slice(0, 6),
    [rows, saved, scoped, stats.count],
  );

  const waiting = approvals.filter((a) => a.status === "waiting").length;
  const live = AGENTS.filter((a) => a.status === "Active");
  const paused = live.filter((a) => pauses[a.id]).length;
  const d = (a: number, b: number) => `${a >= b ? "+" : ""}${(a - b).toFixed(1)} points since last month`;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <PageHeader title="Executive dashboard" meta={<><span>Persistency health overview</span> · <LastUpdated /></>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<LineIcon className="size-4" />} accent="#E8501A" label="13th month persistency" value={`${now.p13.toFixed(1)}%`} change={d(now.p13, before.p13)} good={now.p13 >= before.p13} />
        <Kpi icon={<LineIcon className="size-4" />} accent="#8B5A2B" label="25th month persistency" value={`${now.p25.toFixed(1)}%`} change={d(now.p25, before.p25)} good={now.p25 >= before.p25} />
        <Kpi icon={<LineIcon className="size-4" />} accent="#5B7F3A" label="61st month persistency" value={`${now.p61.toFixed(1)}%`} change={d(now.p61, before.p61)} good={now.p61 >= before.p61} />
        <Kpi icon={<AlertTriangle className="size-4" />} accent="#B3261E" label="Premium at risk" value={money(risk)} change="Unpaid, in grace or recently lapsed" />
        <Kpi icon={<Hourglass className="size-4" />} accent="#E8A23A" label="Policies in grace" value={num(grace)} change="Grace period open" />
        <Kpi icon={<CalendarClock className="size-4" />} accent="#8B5A2B" label="Promised, not yet paid" value={num(promised)} change="Follow-up due" />
        <Kpi icon={<CreditCard className="size-4" />} accent="#5B7F3A" label="Collection against plan" value={pct(col.collectedCr / Math.max(0.01, col.planCr))} change={`${crore(col.collectedCr * 1e7)} of ${crore(col.planCr * 1e7)}`} />
        <Kpi icon={<Workflow className="size-4" />} accent="#E8501A" label="Policies in workflows now" value={num(inWorkflows)} change={`${rows.length} workflows`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="panel p-5">
          <h2 className="text-[14px] font-semibold text-foreground">Persistency ratio trend, 12 months</h2>
          <div className="mt-3 h-[300px]" role="img" aria-label="Persistency ratios by month">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} domain={[40, 90]} unit="%" width={44} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line isAnimationActive={false} name="13th month" dataKey="p13" stroke={SERIES[0]} strokeWidth={1.75} dot={false} />
                <Line isAnimationActive={false} name="25th month" dataKey="p25" stroke={SERIES[1]} strokeWidth={1.75} dot={false} />
                <Line isAnimationActive={false} name="37th month" dataKey="p37" stroke={SERIES[2]} strokeWidth={1.75} strokeDasharray="5 3" dot={false} />
                <Line isAnimationActive={false} name="61st month" dataKey="p61" stroke={SERIES[3]} strokeWidth={1.75} strokeDasharray="2 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">Premium-weighted. The 13th month counts the 13th premium for monthly, the 5th for quarterly, the 3rd for half-yearly and the 2nd for annual.</p>
        </section>
        <section className="panel p-5">
          <h2 className="text-[14px] font-semibold text-foreground">13th month by region</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {byRegion.map((r) => (
              <Link key={r.name} to="/persistency/reports" search={{ region: r.name } as never} className="rounded-xl p-4 text-white transition-transform hover:-translate-y-0.5" style={{ background: heatColor(r.p13, lo, hi) }}>
                <p className="text-[12px] font-medium opacity-90">{r.name}</p>
                <p className="text-[22px] font-semibold tabular">{r.p13.toFixed(1)}%</p>
                <p className="text-[11px] opacity-90">{money(r.risk)} at risk</p>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">Darker means lower persistency.</p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "By product", data: byProduct, keys: ["13th month", "25th month"] },
          { title: "By channel", data: byChannel, keys: ["13th month", "25th month"] },
          { title: "By renewal propensity", data: byCohort, keys: ["13th month"] },
        ].map((c) => (
          <section key={c.title} className="panel p-5">
            <h2 className="text-[14px] font-semibold text-foreground">{c.title}</h2>
            <div className="mt-3 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.data} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
                  <YAxis tick={AXIS_TICK} domain={[40, 95]} unit="%" width={44} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  {c.keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                  {c.keys.map((k, i) => <Bar isAnimationActive={false} key={k} dataKey={k} fill={SERIES[i]} radius={[4, 4, 0, 0]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-foreground">Top at-risk branches</h2>
            <span className="rounded-pill bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-primary">By premium at risk</span>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {branches.map((b) => (
              <li key={b.name} className="flex items-center justify-between py-2.5 text-[13px]">
                <div>
                  <p className="font-medium text-foreground">{b.name}</p>
                  <p className="text-[12px] text-muted-foreground">{num(b.n)} policies</p>
                </div>
                <p className="font-semibold text-failed tabular">{money(b.risk)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-foreground">Workflow results, last 7 days</h2>
            <Link to="/persistency/performance" className="text-[12px] text-primary hover:underline">Open workflow performance</Link>
          </div>
          <table className="mt-2 w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                <th className="py-1.5 font-medium">Workflow</th>
                <th className="py-1.5 text-right font-medium">Started</th>
                <th className="py-1.5 text-right font-medium">Paid or revived</th>
                <th className="py-1.5 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {wf.map((w) => (
                <tr key={w.code} className="border-t border-border/60">
                  <td className="py-2 font-medium text-foreground">{w.name}</td>
                  <td className="py-2 text-right tabular">{num(w.started)}</td>
                  <td className="py-2 text-right tabular">{num(w.paid)}</td>
                  <td className="py-2 text-right tabular">{pct(w.paid / Math.max(1, w.started))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3 text-[13px]">
        <span className="flex items-center gap-2"><BadgeCheck className="size-4 text-healthy" /> {live.length - paused} agents running{paused ? `, ${paused} paused` : ""}</span>
        <span className="flex items-center gap-2"><Wallet className="size-4 text-primary" /> {waiting} {waiting === 1 ? "change" : "changes"} waiting for approval</span>
        <Link to="/persistency/approvals" className="ml-auto text-primary hover:underline">Open approvals</Link>
      </section>
    </div>
  );
}
