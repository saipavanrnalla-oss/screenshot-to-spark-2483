import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, NoteBanner, PageHeader, Panel } from "@/components/ds/primitives";
import { AXIS_TICK, GRID, SERIES, TOOLTIP_STYLE } from "@/components/ds/chart-theme";
import { RunRateChart, useMonth } from "@/components/persistency/month";
import { DataGrid } from "@/components/r1/data-grid";
import { StatusChip } from "@/components/r1/status-chip";
import { PageTabs, inputCls, selectCls } from "@/components/r1/tabs";
import { ConfirmDialog } from "@/components/r1/confirm";
import { NewList } from "@/components/r1/new-list";
import { nextRuleId } from "@/components/r1/rule-model";
import { DRILL_LEVELS, LEVEL_LABEL, TICKETS, isSpecialCare, levelValue, matchesPath, premiumAtRisk, type DrillLevel } from "@/components/r1/report-model";
import { CHANNELS, PRODUCTS, REGIONS, NOW_ISO, type Policy, type Rule } from "@/data/persistency";
import { MIN_GROUP, PACK_SECTIONS, PERIODS, PROPOSALS, persistencySeries, type Experiment, type ExperimentMethod, type Period, type SeriesFilter } from "@/data/persistency/r1/reports";
import { TASKS } from "@/data/persistency/r1/tasks";
import { CALL_RESULT_ROWS } from "@/data/persistency/r1/files";
import { addDays, fromIso, toIso } from "@/data/persistency/dates";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { croreValue, date, inr, num } from "@/lib/format";
import { useDecisions, usePersistencyStore, usePolicies } from "@/store/persistency";
import { useWork } from "@/store/work";

const TABS = ["persistency", "drill", "collection", "funnel", "executors", "experiments", "proposals", "packs"] as const;

const search = z.object({
  tab: fallback(z.enum(TABS).optional(), undefined),
  period: fallback(z.number().optional(), undefined),
  channel: fallback(z.string().optional(), undefined),
  product: fallback(z.string().optional(), undefined),
  ticket: fallback(z.string().optional(), undefined),
  region: fallback(z.string().optional(), undefined),
  branch: fallback(z.string().optional(), undefined),
  cohort: fallback(z.string().optional(), undefined),
  exp: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/reports")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("reports", search),
  head: () => ({
    meta: [
      { title: "Reports · Persistency · desible.ai" },
      { name: "description", content: "Persistency by period, drill-down, collection against plan, funnels, executors, experiments, proposed changes and report packs." },
      { property: "og:title", content: "Reports · Persistency · desible.ai" },
      { property: "og:description", content: "Persistency by period, drill-down, collection against plan, funnels, executors, experiments, proposed changes and report packs." },
    ],
  }),
  component: ReportsPage,
});

const FOOTNOTE = "13th-month persistency counts the 13th premium for monthly mode, the 5th for quarterly, the 3rd for half-yearly and the 2nd for annual. Figures are premium-weighted.";
const pctv = (v: number) => `${v.toFixed(1)}%`;

function ReportsPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab = s.tab ?? "persistency";
  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader title="Reports" meta="Month to date, 28 Oct 2026" />
      <PageTabs
        label="Reports"
        value={tab}
        onChange={(v) => navigate({ search: (p) => ({ ...p, tab: v === "persistency" ? undefined : v, exp: undefined }) })}
        tabs={[
          { id: "persistency", label: "Persistency" },
          { id: "drill", label: "Drill-down" },
          { id: "collection", label: "Collection against plan" },
          { id: "funnel", label: "Funnel" },
          { id: "executors", label: "Executor comparison" },
          { id: "experiments", label: "Experiments" },
          { id: "proposals", label: "Proposed changes" },
          { id: "packs", label: "Report packs" },
        ]}
      />
      {tab === "persistency" && <Persistency />}
      {tab === "drill" && <Drill />}
      {tab === "collection" && <Collection />}
      {tab === "funnel" && <Funnel />}
      {tab === "executors" && <ExecutorComparison />}
      {tab === "experiments" && <Experiments />}
      {tab === "proposals" && <Proposals />}
      {tab === "packs" && <Packs />}
    </div>
  );
}

function filterOf(s: SeriesFilter): SeriesFilter {
  const f: SeriesFilter = {};
  for (const k of ["channel", "product", "ticket", "region", "branch", "cohort"] as const) if (s[k]) f[k] = s[k];
  return f;
}

/* ---------- Persistency ---------- */

function Persistency() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const policies = usePolicies();
  const f = filterOf(s);
  const series = useMemo(() => persistencySeries(f), [JSON.stringify(f)]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = series[series.length - 1]!;
  const prev = series[series.length - 13]!;
  const branches = useMemo(() => [...new Set(policies.filter((p) => matchesPath(p, { ...f, branch: undefined })).map((p) => levelValue(p, "branch")))].sort().slice(0, 200), [policies, f]);
  const sel = (k: keyof SeriesFilter, label: string, opts: readonly string[]) => (
    <select value={s[k] ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, [k]: e.target.value || undefined }) })} className={selectCls} aria-label={label}>
      <option value="">{label}: all</option>
      {opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sel("channel", "Channel", CHANNELS)}
        {sel("product", "Product", PRODUCTS)}
        {sel("ticket", "Ticket size", TICKETS)}
        {sel("region", "Region", REGIONS)}
        {sel("branch", "Branch", branches)}
        {sel("cohort", "Cohort", ["Highest propensity", "High propensity", "Moderate propensity", "Low propensity", "Lowest propensity"])}
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {PERIODS.map((p) => {
          const v = last[`p${p}` as keyof typeof last] as number;
          const d = v - (prev[`p${p}` as keyof typeof prev] as number);
          return (
            <button key={p} type="button" onClick={() => navigate({ search: (x) => ({ ...x, tab: "drill", period: p }) })} className="rounded-card border border-border bg-card p-4 text-left hover:border-primary">
              <p className="text-[12px] font-medium text-muted-foreground">{p}th month</p>
              <p className="mt-1 text-[24px] font-semibold text-foreground tabular">{pctv(v)}</p>
              <p className={`text-[12px] tabular ${d >= 0 ? "text-ok" : "text-destructive"}`}>{d >= 0 ? "+" : ""}{d.toFixed(1)} points on a year ago</p>
            </button>
          );
        })}
      </div>
      <Panel title="Trend, last 36 months">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} interval={5} />
              <YAxis tick={AXIS_TICK} domain={[40, 95]} unit="%" />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {PERIODS.map((p, i) => <Line key={p} type="monotone" dataKey={`p${p}`} name={`${p}th month`} stroke={SERIES[i % SERIES.length]} dot={false} strokeWidth={1.75} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">{FOOTNOTE}</p>
      </Panel>
    </div>
  );
}

/* ---------- Drill-down ---------- */

function Drill() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const policies = usePolicies();
  const period = (PERIODS.includes(s.period as Period) ? s.period : 13) as Period;
  const path = filterOf(s);
  const depth = DRILL_LEVELS.findIndex((l) => !path[l]);
  const level: DrillLevel | undefined = depth === -1 ? undefined : DRILL_LEVELS[depth];
  const inPath = useMemo(() => policies.filter((p) => matchesPath(p, path)), [policies, JSON.stringify(path)]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = `p${period}` as const;
  const options = useMemo(() => {
    if (!level) return [];
    const vals = level === "channel" ? [...CHANNELS] : level === "product" ? [...PRODUCTS] : level === "ticket" ? [...TICKETS] : level === "region" ? [...REGIONS] : [...new Set(inPath.map((p) => levelValue(p, "branch")))];
    return vals
      .map((v) => {
        const sr = persistencySeries({ ...path, [level]: v });
        const risk = inPath.filter((p) => levelValue(p, level) === v).reduce((t, p) => t + premiumAtRisk(p), 0);
        return { v, value: sr[sr.length - 1]![key], policies: inPath.filter((p) => levelValue(p, level) === v).length, risk };
      })
      .filter((o) => o.policies > 0)
      .sort((a, b) => a.value - b.value);
  }, [level, inPath, JSON.stringify(path), key]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranked = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of inPath) {
      const r = premiumAtRisk(p);
      if (r) m.set(levelValue(p, "branch"), (m.get(levelValue(p, "branch")) ?? 0) + r);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [inPath]);
  const crumbs = DRILL_LEVELS.filter((l) => path[l]);
  const go = (patch: Partial<Record<DrillLevel, string | undefined>>) => navigate({ search: (p) => ({ ...p, ...patch }) });
  const clearFrom = (i: number) => Object.fromEntries(DRILL_LEVELS.slice(i).map((l) => [l, undefined])) as Partial<Record<DrillLevel, undefined>>;

  return (
    <div className="space-y-4">
      <nav aria-label="Drill path" className="flex flex-wrap items-center gap-1 text-[13px]">
        <button type="button" onClick={() => go(clearFrom(0))} className="text-primary hover:underline">{period}th month, all</button>
        {crumbs.map((l, i) => (
          <span key={l} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <button type="button" onClick={() => go(clearFrom(i + 1))} className={i === crumbs.length - 1 ? "text-foreground" : "text-primary hover:underline"}>{LEVEL_LABEL[l]}: {path[l]}</button>
          </span>
        ))}
        <select value={period} onChange={(e) => navigate({ search: (p) => ({ ...p, period: Number(e.target.value) }) })} className={`${selectCls} ml-auto`} aria-label="Period">
          {PERIODS.map((p) => <option key={p} value={p}>{p}th month</option>)}
        </select>
      </nav>
      {level ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title={`By ${LEVEL_LABEL[level].toLowerCase()}, lowest first`} bodyClassName="p-0">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">{LEVEL_LABEL[level]}</th><th className="px-3 py-2 text-right font-medium">{period}th month</th><th className="px-3 py-2 text-right font-medium">Policies</th><th className="px-3 py-2 text-right font-medium">Premium at risk</th></tr></thead>
              <tbody>
                {options.slice(0, 30).map((o) => (
                  <tr key={o.v} onClick={() => go({ [level]: o.v })} className="cursor-pointer border-t border-border/60 hover:bg-surface-translucent">
                    <td className="px-3 py-1.5 text-primary">{o.v}</td>
                    <td className="px-3 py-1.5 text-right tabular">{pctv(o.value)}</td>
                    <td className="px-3 py-1.5 text-right tabular">{num(o.policies)}</td>
                    <td className="px-3 py-1.5 text-right tabular">{inr(o.risk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <RankedBranches ranked={ranked} onPick={(b) => go({ ...Object.fromEntries(DRILL_LEVELS.filter((l) => !path[l] && l !== "branch").map((l) => [l, undefined])), branch: b })} />
        </div>
      ) : (
        <Segment path={path} policies={inPath} period={period} />
      )}
      <p className="text-[12px] text-muted-foreground">{FOOTNOTE}</p>
    </div>
  );
}

function RankedBranches({ ranked, onPick }: { ranked: [string, number][]; onPick: (b: string) => void }) {
  return (
    <Panel title="Ten branches with most premium at risk" bodyClassName="p-0">
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Branch</th><th className="px-3 py-2 text-right font-medium">Premium at risk</th></tr></thead>
        <tbody>
          {ranked.map(([b, v], i) => (
            <tr key={b} onClick={() => onPick(b)} className="cursor-pointer border-t border-border/60 hover:bg-surface-translucent">
              <td className="px-3 py-1.5 tabular">{i + 1}</td>
              <td className="px-3 py-1.5 text-primary">{b}</td>
              <td className="px-3 py-1.5 text-right tabular">{inr(v)}</td>
            </tr>
          ))}
          {!ranked.length && <tr><td colSpan={3} className="px-3 py-2 text-muted-foreground">No premium at risk here.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}

function Segment({ path, policies, period }: { path: SeriesFilter; policies: Policy[]; period: Period }) {
  const series = useMemo(() => persistencySeries(path), [JSON.stringify(path)]); // eslint-disable-line react-hooks/exhaustive-deps
  const decisions = useDecisions(policies);
  const mayList = useCan("lists.create");
  const [listOpen, setListOpen] = useState(false);
  const atRisk = policies.filter((p) => premiumAtRisk(p) > 0);
  const funnel: [string, number][] = [
    ["Due this cycle", policies.filter((p) => p.monthDue).length],
    ["Contacted in 30 days", policies.filter((p) => p.touchesLast30d > 0).length],
    ["Promised", policies.filter((p) => p.state === "Promised").length],
    ["Paid", policies.filter((p) => p.state === "Paid" || p.monthDue?.status === "paid").length],
  ];
  const split = new Map<string, number>();
  for (const p of policies) {
    const ex = decisions.get(p.policyId)?.executor;
    if (ex) split.set(ex, (split.get(ex) ?? 0) + 1);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-semibold">{path.branch} · {num(policies.length)} policies · {inr(atRisk.reduce((t, p) => t + premiumAtRisk(p), 0))} at risk</h2>
        {mayList && <Button size="sm" className="ml-auto" disabled={!atRisk.length} onClick={() => setListOpen(true)}><Plus /> Add to visit list</Button>}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={`${period}th month trend`}>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} interval={8} />
                <YAxis tick={AXIS_TICK} domain={["auto", "auto"]} unit="%" />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey={`p${period}`} stroke={SERIES[0]} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Funnel">
          <ul className="space-y-1.5 text-[13px]">{funnel.map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular">{num(v)}</span></li>)}</ul>
        </Panel>
        <Panel title="Executor split">
          <ul className="space-y-1.5 text-[13px]">{[...split.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular">{num(v)}</span></li>)}</ul>
        </Panel>
      </div>
      <DataGrid
        label="Policies behind this segment"
        rows={policies}
        rowKey={(p) => p.policyId}
        csvName="segment-policies.csv"
        columns={[
          { id: "id", label: "Policy", value: (p) => p.policyId, render: (p) => <Link to="/persistency/policies/$id" params={{ id: p.policyId }} className="text-primary hover:underline">{p.policyId}</Link> },
          { id: "name", label: "Customer", value: (p) => p.customerName },
          { id: "product", label: "Product", value: (p) => p.product },
          { id: "state", label: "State", value: (p) => p.state },
          { id: "due", label: "Due", value: (p) => p.dueDate, render: (p) => date(p.dueDate) },
          { id: "risk", label: "Premium at risk", align: "right", value: (p) => premiumAtRisk(p), render: (p) => inr(premiumAtRisk(p)) },
        ]}
      />
      {listOpen && <NewList open={listOpen} onOpenChange={setListOpen} preset={{ to: "Sales officer", workflow: "R5", policyIds: atRisk.map((p) => p.policyId), source: `${path.branch}, from Reports` }} />}
    </div>
  );
}

/* ---------- Collection ---------- */

function Collection() {
  const m = useMonth();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Collected this month", croreValue(m.col.collectedCr)],
            ["Plan for the month", croreValue(m.col.planCr)],
            ["Daily rate achieved", croreValue(m.runRate, 2)],
            ["Daily rate needed", croreValue(m.required, 2)],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-card border border-border bg-card p-4">
            <p className="text-[12px] font-medium text-muted-foreground">{k}</p>
            <p className="mt-1 text-[24px] font-semibold tabular">{v}</p>
          </div>
        ))}
      </div>
      <Panel title="Collection against plan">
        <RunRateChart height={300} />
        <p className="mt-2 text-[12px] text-muted-foreground">{m.daysLeft} days left. Gap to plan {croreValue(m.gap)}. {num(m.col.paidCount)} of {num(m.col.dueCount)} policies due this month have paid; {num(m.col.promisedCount)} have promised.</p>
      </Panel>
    </div>
  );
}

/* ---------- Funnel ---------- */

function Funnel() {
  const [wf, setWf] = useState("");
  const tasks = TASKS.filter((t) => !wf || t.workflow === wf);
  const msg = tasks.filter((t) => t.agentId === "message");
  const voice = tasks.filter((t) => t.agentId === "renewal-voice");
  const policies = usePolicies();
  const paid = useMemo(() => new Set(policies.filter((p) => p.state === "Paid" || p.monthDue?.status === "paid").map((p) => p.policyId)), [policies]);
  const mf: [string, number][] = [
    ["Sent", msg.length],
    ["Delivered", msg.filter((t) => t.msgStatus && t.msgStatus !== "Sent").length],
    ["Read", msg.filter((t) => t.msgStatus === "Read" || t.msgStatus === "Clicked").length],
    ["Clicked", msg.filter((t) => t.msgStatus === "Clicked").length],
    ["Paid", new Set(msg.filter((t) => paid.has(t.policyId)).map((t) => t.policyId)).size],
  ];
  const cc = CALL_RESULT_ROWS;
  const vf: [string, number][] = [
    ["Called", voice.length + cc.length],
    ["Connected", voice.filter((t) => t.result !== "No answer").length + cc.filter((r) => r.disposition !== "Not reachable").length],
    ["Promised", voice.filter((t) => t.disposition === "Promise to pay with date").length + cc.filter((r) => r.disposition === "Promise to pay with date").length],
    ["Paid", new Set([...voice.map((t) => t.policyId), ...cc.map((r) => r.policyId)].filter((id) => paid.has(id))).size],
  ];
  const bar = (rows: [string, number][]) => {
    const max = rows[0]?.[1] || 1;
    return (
      <ul className="space-y-2">
        {rows.map(([k, v]) => (
          <li key={k} className="text-[13px]">
            <div className="flex justify-between"><span>{k}</span><span className="tabular">{num(v)}</span></div>
            <div className="mt-1 h-2 rounded-pill bg-surface-translucent"><div className="h-2 rounded-pill bg-primary" style={{ width: `${Math.max(2, (v / max) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
    );
  };
  return (
    <div className="space-y-4">
      <select value={wf} onChange={(e) => setWf(e.target.value)} className={selectCls} aria-label="Workflow">
        <option value="">All workflows</option>
        {[...new Set(TASKS.map((t) => t.workflow))].sort().map((w) => <option key={w}>{w}</option>)}
      </select>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Messages: Renewal Reminder Agent">{bar(mf)}</Panel>
        <Panel title="Calls: Premium Renewal Voice Agent and call-centre vendors">{bar(vf)}</Panel>
      </div>
      <p className="text-[12px] text-muted-foreground">Last 30 days of agent tasks and the latest vendor results file.</p>
    </div>
  );
}

/* ---------- Executor comparison ---------- */

interface ExecRow {
  id: string;
  name: string;
  tasks: number;
  contacts: number;
  promises: number;
  payments: number;
  collected: number;
  cost: number;
  perRupee: number;
}

function ExecutorComparison() {
  const policies = usePolicies();
  const executors = useWork((s) => s.executors);
  const navigate = useNavigate();
  const rows = useMemo(() => {
    const byId = new Map(policies.map((p) => [p.policyId, p]));
    const isPaid = (id: string) => {
      const p = byId.get(id);
      return !!p && (p.state === "Paid" || p.monthDue?.status === "paid");
    };
    const build = (id: string, items: { policyId: string; connected: boolean; promise: boolean }[], unit: number): ExecRow => {
      const e = executors.find((x) => x.id === id)!;
      const paidIds = [...new Set(items.filter((i) => isPaid(i.policyId)).map((i) => i.policyId))];
      const collected = paidIds.reduce((t, pid) => t + (byId.get(pid)?.instalmentAmount ?? 0), 0);
      const cost = items.length * unit;
      return { id, name: e.name, tasks: items.length, contacts: items.filter((i) => i.connected).length, promises: items.filter((i) => i.promise).length, payments: paidIds.length, collected, cost, perRupee: collected ? cost / collected : 0 };
    };
    const agent = (aid: string) => TASKS.filter((t) => t.agentId === aid).map((t) => ({ policyId: t.policyId, connected: t.result !== "No answer" && t.result !== "Failed", promise: t.disposition === "Promise to pay with date" }));
    const vendor = (name: string) => CALL_RESULT_ROWS.filter((r) => r.vendor === name).map((r) => ({ policyId: r.policyId, connected: r.disposition !== "Not reachable", promise: r.disposition === "Promise to pay with date" }));
    const cost = (id: string) => executors.find((e) => e.id === id)?.costs.task ?? 0;
    return [
      build("renewal-voice", agent("renewal-voice"), cost("renewal-voice")),
      build("message", agent("message"), cost("message")),
      build("payment-assist", agent("payment-assist"), cost("payment-assist")),
      build("cc-fixed", vendor("Call-centre vendor (fixed payout)"), cost("cc-fixed")),
      build("cc-variable", vendor("Call-centre vendor (variable payout)"), cost("cc-variable")),
    ];
  }, [policies, executors]);
  return (
    <DataGrid
      label="Executor comparison"
      rows={rows}
      rowKey={(r) => r.id}
      csvName="executor-comparison.csv"
      columns={[
        { id: "name", label: "Executor", value: (r) => r.name, render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
        { id: "tasks", label: "Tasks", align: "right", value: (r) => r.tasks, render: (r) => num(r.tasks) },
        { id: "contacts", label: "Contacts", align: "right", value: (r) => r.contacts, render: (r) => num(r.contacts) },
        { id: "promises", label: "Promises", align: "right", value: (r) => r.promises, render: (r) => num(r.promises) },
        { id: "payments", label: "Payments", align: "right", value: (r) => r.payments, render: (r) => num(r.payments) },
        { id: "cost", label: "Cost", align: "right", value: (r) => r.cost, render: (r) => inr(Math.round(r.cost)) },
        { id: "per", label: "Cost per rupee collected", align: "right", value: (r) => r.perRupee, render: (r) => (r.perRupee ? `₹${r.perRupee.toFixed(3)}` : "None") },
        { id: "move", label: "", sortable: false, value: () => "", render: (r) => <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/persistency/data/executors/$id", params: { id: r.id } })}>Move volume</Button> },
      ]}
    />
  );
}

/* ---------- Experiments ---------- */

function Experiments() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const experiments = useWork((st) => st.experiments);
  const mayEdit = useCan("experiments.edit");
  const [newOpen, setNewOpen] = useState(false);
  const open = experiments.find((e) => e.id === s.exp);
  return (
    <div className="space-y-3">
      {mayEdit && <Button size="sm" onClick={() => setNewOpen(true)}><Plus /> New experiment</Button>}
      <DataGrid
        label="Experiments"
        rows={experiments}
        rowKey={(e) => e.id}
        onRowClick={(e) => navigate({ search: (p) => ({ ...p, exp: e.id }) })}
        columns={[
          { id: "id", label: "Experiment", value: (e) => `${e.id} ${e.name}`, render: (e) => <span><span className="mr-1.5 text-primary">{e.id}</span>{e.name}</span> },
          { id: "status", label: "Status", value: (e) => e.status, render: (e) => <StatusChip tone={e.status === "Finished" ? "ok" : e.status === "Draft" ? "neutral" : "accent"}>{e.status}</StatusChip> },
          { id: "method", label: "Method", value: (e) => e.method },
          { id: "share", label: "Untreated share", align: "right", value: (e) => e.share, render: (e) => `${e.share}%` },
          { id: "cohorts", label: "Cohorts", value: (e) => e.cohorts.join(", ") },
          { id: "dates", label: "Dates", value: (e) => e.start, render: (e) => `${date(e.start)} to ${date(e.end)}` },
        ]}
      />
      <NewExperiment open={newOpen} onOpenChange={setNewOpen} />
      <Sheet open={!!open} onOpenChange={(o) => !o && navigate({ search: (p) => ({ ...p, exp: undefined }) })}>
        <SheetContent side="right" className="w-full overflow-y-auto border-border bg-background sm:max-w-[560px]">{open && <ExperimentResult e={open} />}</SheetContent>
      </Sheet>
    </div>
  );
}

function ExperimentResult({ e }: { e: Experiment }) {
  const submit = useWork((s) => s.submit);
  const save = useWork((s) => s.saveExperiment);
  const mayEdit = useCan("experiments.edit");
  const user = useUser();
  const r = e.result;
  const rows: [string, [number, number], (v: number) => string][] = r
    ? [
        ["Persistency", r.persistency, pctv],
        ["Collection", r.collection, pctv],
        ["Contacts per policy", r.contacts, (v) => v.toFixed(1)],
        ["Cost to collect (paise per rupee)", r.costToCollect, (v) => v.toFixed(1)],
      ]
    : [];
  return (
    <div className="space-y-4">
      <SheetHeader className="text-left">
        <SheetTitle className="text-[16px]">{e.id} {e.name}</SheetTitle>
        <p className="text-[12px] text-muted-foreground">{e.method} · {e.share}% untreated · {e.cohorts.join(", ")} · {e.products.join(", ")} · {date(e.start)} to {date(e.end)}</p>
      </SheetHeader>
      {r ? (
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium" /><th className="text-right font-medium">Treated</th><th className="text-right font-medium">Untreated</th><th className="text-right font-medium">Difference</th></tr></thead>
          <tbody>
            {rows.map(([k, [a, b], f]) => <tr key={k} className="border-t border-border/60"><td className="py-1.5">{k}</td><td className="text-right tabular">{f(a)}</td><td className="text-right tabular">{f(b)}</td><td className="text-right tabular">{a - b >= 0 ? "+" : ""}{(a - b).toFixed(1)}</td></tr>)}
            <tr className="border-t border-border/60"><td className="py-1.5">Policies</td><td className="text-right tabular">{num(e.treated)}</td><td className="text-right tabular">{num(e.untreated)}</td><td /></tr>
          </tbody>
        </table>
      ) : (
        <p className="text-[13px] text-subtle">{e.status === "Draft" ? "Draft. Submit it for review to schedule it." : "Results appear when the experiment ends."}{e.treated ? ` Groups: ${num(e.untreated)} untreated, ${num(e.treated)} treated.` : ""}</p>
      )}
      {e.status === "Draft" && mayEdit && (
        <Button
          size="sm"
          onClick={() => {
            save({ ...e, status: "In review" });
            submit({ kind: "experiment", objectId: e.id, objectName: `${e.id} ${e.name}`, requestedBy: user?.name ?? "User", summary: `${e.method}, ${e.share}% untreated, ${num(e.untreated)} untreated and ${num(e.treated)} treated`, reach: e.treated + e.untreated, diff: [`Method: ${e.method}`, `Share: ${e.share}%`, `Cohorts: ${e.cohorts.join(", ")}`, `Products: ${e.products.join(", ")}`, `Dates: ${e.start} to ${e.end}`], conflicts: [], needs: ["head"] });
            toast.success(`${e.id} sent for review`);
          }}
        >
          Submit for review
        </Button>
      )}
    </div>
  );
}

const METHODS: ExperimentMethod[] = ["Random untreated holdout", "Staggered start by region or branch", "Same period last year"];

function NewExperiment({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const policies = usePolicies();
  const experiments = useWork((s) => s.experiments);
  const save = useWork((s) => s.saveExperiment);
  const submit = useWork((s) => s.submit);
  const user = useUser();
  const [name, setName] = useState("");
  const [method, setMethod] = useState<ExperimentMethod>(METHODS[0]!);
  const [share, setShare] = useState(15);
  const [cohorts, setCohorts] = useState<string[]>(["Low propensity", "Lowest propensity"]);
  const [products, setProducts] = useState<string[]>(["ULIP", "Traditional"]);
  const [start, setStart] = useState("2026-12-01");
  const [end, setEnd] = useState("2027-02-28");
  const [exclude, setExclude] = useState(true);
  const eligible = useMemo(() => policies.filter((p) => cohorts.includes(p.insurerCohort) && products.includes(p.product) && (!exclude || !isSpecialCare(p))).length, [policies, cohorts, products, exclude]);
  const untreated = Math.round((eligible * share) / 100);
  const treated = eligible - untreated;
  const small = untreated < MIN_GROUP || treated < MIN_GROUP;
  const toggle = (list: string[], v: string, set: (x: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const make = (): Experiment => ({ id: `EXP-${String(10 + experiments.length - 3 + 1).padStart(2, "0")}`, name: name.trim() || "New experiment", method, status: "Draft", share, cohorts, products, start, end, excludeSpecialCare: exclude, treated, untreated });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-card border-border bg-card">
        <DialogHeader><DialogTitle className="text-[14px] font-semibold">New experiment</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[13px]">
          <label className="block text-[12px] font-medium text-muted-foreground">Name<input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} /></label>
          <label className="block text-[12px] font-medium text-muted-foreground">Method
            <select value={method} onChange={(e) => setMethod(e.target.value as ExperimentMethod)} className={`${selectCls} mt-1 w-full`}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Cohorts</p>
            <div className="mt-1 flex gap-1.5">{["Highest propensity", "High propensity", "Moderate propensity", "Low propensity", "Lowest propensity"].map((c) => <button key={c} type="button" onClick={() => toggle(cohorts, c, setCohorts)} className={`rounded-pill border px-2.5 py-0.5 text-[12px] ${cohorts.includes(c) ? "border-primary" : "border-border text-subtle"}`}>{c}</button>)}</div>
          </div>
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Products</p>
            <div className="mt-1 flex gap-1.5">{PRODUCTS.map((c) => <button key={c} type="button" onClick={() => toggle(products, c, setProducts)} className={`rounded-pill border px-2.5 py-0.5 text-[12px] ${products.includes(c) ? "border-primary" : "border-border text-subtle"}`}>{c}</button>)}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-[12px] font-medium text-muted-foreground">Untreated share (%)<input type="number" min={1} max={50} value={share} onChange={(e) => setShare(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} className={`${inputCls} mt-1 tabular`} /></label>
            <label className="block text-[12px] font-medium text-muted-foreground">Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} mt-1`} /></label>
            <label className="block text-[12px] font-medium text-muted-foreground">End<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={`${inputCls} mt-1`} /></label>
          </div>
          <label className="flex items-center justify-between"><span>Exclude special-care cases</span><Switch checked={exclude} onCheckedChange={setExclude} /></label>
          <p className="rounded-input border border-border px-3 py-2"><span className="font-semibold tabular">{num(untreated)}</span> untreated, <span className="font-semibold tabular">{num(treated)}</span> treated</p>
          {small && <NoteBanner tone="attention">A group has fewer than {num(MIN_GROUP)} policies. The result may not be readable.</NoteBanner>}
          {end <= start && <p className="text-[12px] text-attention">The end date must be after the start.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" disabled={!cohorts.length || !products.length || end <= start} onClick={() => { const e = make(); save(e); toast.success(`${e.id} saved as a draft`); onOpenChange(false); }}>Save</Button>
          <Button
            disabled={!cohorts.length || !products.length || end <= start}
            onClick={() => {
              const e = { ...make(), status: "In review" as const };
              save(e);
              submit({ kind: "experiment", objectId: e.id, objectName: `${e.id} ${e.name}`, requestedBy: user?.name ?? "User", summary: `${e.method}, ${e.share}% untreated, ${num(untreated)} untreated and ${num(treated)} treated`, reach: eligible, diff: [`Method: ${e.method}`, `Share: ${e.share}%`, `Cohorts: ${cohorts.join(", ")}`, `Products: ${products.join(", ")}`, `Dates: ${start} to ${end}`, exclude ? "Special-care cases excluded" : "Special-care cases included"], conflicts: [], needs: ["head"] });
              toast.success(`${e.id} sent for review`);
              onOpenChange(false);
            }}
          >
            Save and submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Proposed changes ---------- */

function Proposals() {
  const states = useWork((s) => s.proposals);
  const decide = useWork((s) => s.decideProposal);
  const saveDraft = useWork((s) => s.saveDraft);
  const rules = usePersistencyStore((s) => s.rules);
  const upsertRule = usePersistencyStore((s) => s.upsertRule);
  const mayEdit = useCan("rules.edit");
  const user = useUser();
  const navigate = useNavigate();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const by = user?.name ?? "User";
  const hiddenUntil = (at: string) => toIso(addDays(fromIso(at.slice(0, 10)), 90));
  const visible = PROPOSALS.filter((p) => !(states[p.id]?.status === "Rejected" && hiddenUntil(states[p.id]!.at) > NOW_ISO.slice(0, 10)));
  return (
    <div className="space-y-3">
      {visible.length === 0 && <EmptyState title="No proposed changes right now." />}
      {visible.map((p) => {
        const st = states[p.id];
        return (
          <Panel key={p.id} title={p.title} actions={st ? <StatusChip tone="ok">{st.status}</StatusChip> : undefined}>
            <p className="text-[13px] text-subtle">{p.evidence}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Cohorts {p.cohort} · experiment {p.experimentId}</p>
            <div className="mt-3 flex gap-2">
              {st?.ruleId ? (
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/persistency/rules/$id", params: { id: st.ruleId! } })}>Open draft rule {st.ruleId}</Button>
              ) : mayEdit ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      const id = nextRuleId(rules);
                      const rule: Rule = { ...p.rule, id, level: "rule", effectiveFrom: "2026-11-01", needsApprovalFrom: "Head of Persistency", source: "Insurer rule", status: "Draft", version: 1, notes: `Evidence: ${p.evidence}`, lastChanged: NOW_ISO };
                      upsertRule(rule);
                      saveDraft(`rule:${id}`, rule, by, `From proposal ${p.id}`);
                      decide(p.id, { status: "Sent to rules", ruleId: id, by });
                      toast.success(`Draft rule ${id} created`);
                      navigate({ to: "/persistency/rules/$id", params: { id } });
                    }}
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(p.id)}>Reject</Button>
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground">Head of Persistency or MIS and analytics acts on proposals.</p>
              )}
            </div>
          </Panel>
        );
      })}
      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject proposal"
        body="The proposal is hidden for this cohort for 90 days."
        reason="required"
        confirmLabel="Reject"
        onConfirm={(r) => {
          if (!rejecting) return;
          decide(rejecting, { status: "Rejected", reason: r.reason, by });
          toast.success("Proposal rejected");
        }}
      />
    </div>
  );
}

/* ---------- Report packs ---------- */

const MONTHS = [
  { key: "2026-10", label: "October 2026" },
  { key: "2026-09", label: "September 2026" },
  { key: "2026-08", label: "August 2026" },
];

function usePackData(month: string) {
  const policies = usePolicies();
  const m = useMonth();
  return useMemo(() => {
    const byChannel = CHANNELS.map((c) => {
      const s = persistencySeries({ channel: c });
      const pt = s.find((x) => x.key === month) ?? s[s.length - 1]!;
      return [c, ...PERIODS.map((p) => pctv(pt[`p${p}` as const]))];
    });
    const all = persistencySeries({});
    const pt = all.find((x) => x.key === month) ?? all[all.length - 1]!;
    const reasons = new Map<string, number>();
    for (const p of policies) if (p.reasonCode !== "None") reasons.set(`${p.product}|${p.insurerCohort}|${p.reasonCode}`, (reasons.get(`${p.product}|${p.insurerCohort}|${p.reasonCode}`) ?? 0) + 1);
    const reasonRows = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [...k.split("|"), num(v)]);
    return {
      overall: ["All channels", ...PERIODS.map((p) => pctv(pt[`p${p}` as const]))],
      byChannel,
      collection: [["Collected", croreValue(m.col.collectedCr)], ["Plan", croreValue(m.col.planCr)], ["Daily rate achieved", croreValue(m.runRate, 2)], ["Daily rate needed", croreValue(m.required, 2)]],
      reasonRows,
    };
  }, [policies, m, month]);
}

function Packs() {
  const mayPack = useCan("reports.packs");
  const [pack, setPack] = useState<"Board pack" | "Regulator pack">("Board pack");
  const [sections, setSections] = useState<string[]>([...PACK_SECTIONS]);
  const [month, setMonth] = useState(MONTHS[0]!.key);
  const [preview, setPreview] = useState(false);
  const data = usePackData(month);
  const monthLabel = MONTHS.find((m) => m.key === month)!.label;
  const download = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    let y = 56;
    const line = (t: string, size = 10, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const parts = doc.splitTextToSize(t.replace(/₹/g, "Rs "), 500) as string[];
      for (const p of parts) {
        if (y > 790) {
          doc.addPage();
          y = 56;
        }
        doc.text(p, 48, y);
        y += size + 5;
      }
    };
    line(`${pack}, ${monthLabel}`, 16, true);
    line("Sample Life Insurance, persistency report", 10);
    y += 8;
    if (sections.includes(PACK_SECTIONS[0])) {
      line(PACK_SECTIONS[0], 12, true);
      line(`Channel | ${PERIODS.map((p) => `${p}th`).join(" | ")}`, 9, true);
      for (const r of [data.overall, ...data.byChannel]) line(r.join(" | "), 9);
      y += 6;
    }
    if (sections.includes(PACK_SECTIONS[1])) {
      line(PACK_SECTIONS[1], 12, true);
      for (const [k, v] of data.collection) line(`${k}: ${v}`, 9);
      y += 6;
    }
    if (sections.includes(PACK_SECTIONS[2])) {
      line(PACK_SECTIONS[2], 12, true);
      line("Product | Cohort | Reason | Policies", 9, true);
      for (const r of data.reasonRows) line(r.join(" | "), 9);
      y += 6;
    }
    line(FOOTNOTE, 8);
    doc.save(`${pack.toLowerCase().replace(/ /g, "-")}-${month}.pdf`);
    toast.success("PDF downloaded");
  };
  if (!mayPack) return <EmptyState title="Report packs are made by Head of Persistency, MIS and analytics, or Executive." />;
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Panel title="Pack">
        <div className="space-y-3 text-[13px]">
          <div className="flex gap-1.5">{(["Board pack", "Regulator pack"] as const).map((p) => <button key={p} type="button" onClick={() => setPack(p)} className={`rounded-pill border px-3 py-1 text-[12px] ${pack === p ? "border-primary" : "border-border text-subtle"}`}>{p}</button>)}</div>
          <div className="space-y-1.5">
            {PACK_SECTIONS.map((sec) => (
              <label key={sec} className="flex items-center gap-2"><input type="checkbox" checked={sections.includes(sec)} onChange={() => setSections(sections.includes(sec) ? sections.filter((x) => x !== sec) : [...sections, sec])} className="accent-[var(--primary)]" />{sec}</label>
            ))}
          </div>
          <label className="block text-[12px] font-medium text-muted-foreground">Month
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${selectCls} mt-1 w-full`}>{MONTHS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!sections.length} onClick={() => setPreview(true)}>Preview</Button>
            <Button size="sm" disabled={!sections.length} onClick={() => void download()}><Download /> Download PDF</Button>
          </div>
        </div>
      </Panel>
      {preview ? (
        <Panel title={`${pack}, ${monthLabel}`}>
          <div className="space-y-4 text-[13px]">
            {sections.includes(PACK_SECTIONS[0]) && (
              <div>
                <p className="font-semibold">{PACK_SECTIONS[0]}</p>
                <table className="mt-1 w-full"><thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium">Channel</th>{PERIODS.map((p) => <th key={p} className="text-right font-medium">{p}th</th>)}</tr></thead>
                  <tbody>{[data.overall, ...data.byChannel].map((r) => <tr key={r[0]} className="border-t border-border/60">{r.map((c, i) => <td key={i} className={`py-1 ${i ? "text-right tabular" : ""}`}>{c}</td>)}</tr>)}</tbody></table>
              </div>
            )}
            {sections.includes(PACK_SECTIONS[1]) && (
              <div><p className="font-semibold">{PACK_SECTIONS[1]}</p><ul className="mt-1">{data.collection.map(([k, v]) => <li key={k} className="flex max-w-sm justify-between"><span>{k}</span><span className="tabular">{v}</span></li>)}</ul></div>
            )}
            {sections.includes(PACK_SECTIONS[2]) && (
              <div>
                <p className="font-semibold">{PACK_SECTIONS[2]}</p>
                <table className="mt-1 w-full"><thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium">Product</th><th className="font-medium">Cohort</th><th className="font-medium">Reason</th><th className="text-right font-medium">Policies</th></tr></thead>
                  <tbody>{data.reasonRows.map((r, i) => <tr key={i} className="border-t border-border/60">{r.map((c, j) => <td key={j} className={`py-1 ${j === 3 ? "text-right tabular" : ""}`}>{c}</td>)}</tr>)}</tbody></table>
              </div>
            )}
            <p className="text-[12px] text-muted-foreground">{FOOTNOTE}</p>
          </div>
        </Panel>
      ) : (
        <EmptyState title="Choose the sections and month, then Preview." />
      )}
    </div>
  );
}
