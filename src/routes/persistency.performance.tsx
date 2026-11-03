import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Fragment, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel, SegmentedControl } from "@/components/ds/primitives";
import { CanvasBox } from "@/components/r1/canvas-box";
import { DataGrid, type Column } from "@/components/r1/data-grid";
import { Kpi } from "@/components/r1/kpi";
import { StatusChip, versionTone } from "@/components/r1/status-chip";
import { PageTabs } from "@/components/r1/tabs";
import { PERIODS, PERIOD_FACTOR, computeFunnel, type Funnel, type Period } from "@/components/r1/funnel-model";
import { useWorkflowRows, wfVersions } from "@/components/r1/wf-model";
import { layoutGraph } from "@/engine/workflow";
import { AGENTS } from "@/data/persistency";
import { PALETTE_BY_TYPE, type WfGraph } from "@/data/persistency/r1/wf";
import { TASKS, type AgentTask } from "@/data/persistency/r1/tasks";
import { NOW } from "@/data/persistency/dates";
import { hashId } from "@/data/persistency/derived";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { gate } from "@/lib/gate";
import { dateTime, num, pct } from "@/lib/format";
import { useWork } from "@/store/work";

const TABS = ["flow", "agents", "history", "outcomes"] as const;
const search = z.object({
  wf: fallback(z.string().optional(), undefined),
  period: fallback(z.enum(PERIODS).optional(), undefined),
  tab: fallback(z.enum(TABS).optional(), undefined),
  view: fallback(z.enum(["Steps", "Diagram"]).optional(), undefined),
  node: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/performance")({
  beforeLoad: ({ search }) => gate("performance", search),
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "Workflow performance · Persistency · desible.ai" },
      { name: "description", content: "How many policies entered each workflow, where they went, which agents worked them and what came out." },
      { property: "og:title", content: "Workflow performance · Persistency · desible.ai" },
      { property: "og:description", content: "How many policies entered each workflow, where they went, which agents worked them and what came out." },
    ],
  }),
  component: PerformancePage,
});

/** Lifecycle groups, taken from the workflow code. */
const GROUPS: { key: string; label: string; blurb: string }[] = [
  { key: "S", label: "New business", blurb: "PIVC, Welcome Calling and the Free Look Period" },
  { key: "W", label: "Before the due date", blurb: "Warming, mandate readiness and early protection" },
  { key: "R", label: "Due and Grace Period", blurb: "Renewal Premium collection, from first reminder to recovery" },
  { key: "L", label: "Lapsed", blurb: "Revival / Reinstatement and Surrender prevention" },
  { key: "X", label: "Always-on guards", blurb: "Events that stop or override every other workflow" },
];

const AGENT_BY_NODE: Record<string, string> = {
  "agent.message": "message",
  "agent.voice": "renewal-voice",
  "agent.classifier": "reason-classifier",
  "agent.payment": "payment-assist",
  "agent.summariser": "handoff-summariser",
  "agent.quality": "quality",
};
const agentName = (id: string) => AGENTS.find((a) => a.id === id)?.name ?? id;
const DAY = 86_400_000;

function sum(f: Funnel | undefined, type: string) {
  return f?.outcomes.filter((o) => o.type === type).reduce((a, o) => a + o.count, 0) ?? 0;
}

function Spark({ code, total }: { code: string; total: number }) {
  const pts = Array.from({ length: 7 }, (_, i) => total * (0.8 + (((hashId(code + i) % 100) / 100) * 0.4)));
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const d = pts.map((v, i) => `${(i / 6) * 60},${22 - ((v - min) / Math.max(1, max - min)) * 18}`).join(" ");
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" aria-label="Policies entered per day, last 7 days" role="img">
      <polyline points={d} fill="none" stroke="var(--primary)" strokeWidth="1.6" />
    </svg>
  );
}

function PerformancePage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const rows = useWorkflowRows().filter((r) => !r.archived);
  const saved = useWork((st) => st.versions);
  const { scoped } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const period: Period = s.period ?? "Last 7 days";

  const funnelFor = (c: string, per: Period) => {
    const list = wfVersions(saved, c);
    const g = (list.find((v) => v.status === "Active") ?? list[list.length - 1])?.data;
    if (!g) return undefined;
    const base = Math.max(stats.count.get(c) ?? 0, 140 + (hashId(c) % 220));
    const graph = layoutGraph(g, "TB");
    return { graph, f: computeFunnel(graph, base * PERIOD_FACTOR[per], scoped, c + per) };
  };

  const table = useMemo(
    () =>
      rows.map((r) => {
        const x = funnelFor(r.code, period);
        const agents = [...new Set((x?.graph.nodes ?? []).map((n) => AGENT_BY_NODE[n.type]).filter((a): a is string => !!a))];
        const canPay = !!x?.graph.nodes.some((n) => n.type === "outcome.paid");
        return {
          r,
          total: x?.f.total ?? 0,
          now: stats.count.get(r.code) ?? 0,
          paid: sum(x?.f, "outcome.paid"),
          person: sum(x?.f, "outcome.handoff"),
          routed: sum(x?.f, "outcome.routed"),
          canPay,
          agents,
        };
      }),
    [rows, period, saved, scoped, stats.count], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const set = (patch: Record<string, unknown>) => navigate({ search: (p) => ({ ...p, ...patch }) });
  const code = s.wf;
  const periodControl = <SegmentedControl label="Period" value={period} options={PERIODS} onChange={(v) => set({ period: v })} />;

  if (!code || !rows.some((r) => r.code === code)) {
    const entered = table.reduce((a, t) => a + t.total, 0);
    const paid = table.reduce((a, t) => a + t.paid, 0);
    const person = table.reduce((a, t) => a + t.person, 0);
    const days = period === "Today" ? 1 : period === "Last 7 days" ? 7 : 30;
    const tasks = TASKS.filter((t) => !t.test && NOW.getTime() - new Date(t.at).getTime() <= days * DAY).length;
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <PageHeader title="Workflow performance" meta={`${rows.length} workflows · ${period}`} actions={periodControl} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Policies entered" value={num(entered)} change="Across all workflows" />
          <Kpi label="Paid or revived" value={num(paid)} change={`${pct(paid / Math.max(1, entered))} of entered`} accent="#3fb968" />
          <Kpi label="With a person" value={num(person)} change={`${pct(person / Math.max(1, entered))} of entered`} accent="#E8A21A" />
          <Kpi label="Agent tasks" value={num(tasks)} change="See Agent activity" accent="#8B5A2B" />
        </div>
        <section className="panel overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">Workflow</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Entered</th>
                <th className="px-3 py-2 text-right font-medium">In progress now</th>
                <th className="px-3 py-2 text-right font-medium">Paid or revived</th>
                <th className="px-3 py-2 text-right font-medium">With a person</th>
                <th className="px-3 py-2 text-right font-medium">Moved on</th>
                <th className="px-3 py-2 font-medium">Daily trend</th>
                <th className="px-3 py-2 font-medium">Agents used</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => {
                const list = table.filter((t) => t.r.code.startsWith(g.key));
                if (!list.length) return null;
                return (
                  <Fragment key={g.key}>
                    <tr className="border-t border-border bg-surface-translucent">
                      <td colSpan={9} className="px-4 py-1.5">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-foreground">{g.label}</span>
                        <span className="ml-2 text-[12px] text-muted-foreground">{g.blurb}</span>
                      </td>
                    </tr>
                    {list.map((t) => (
                      <tr key={t.r.code} onClick={() => set({ wf: t.r.code, tab: undefined, node: undefined })} className="cursor-pointer border-t border-border/60 hover:bg-surface-translucent">
                        <td className="px-4 py-2"><span className="font-medium text-foreground">{t.r.name}</span> <span className="text-subtle">{t.r.code}</span></td>
                        <td className="px-3 py-2"><StatusChip tone={versionTone(t.r.status)}>{t.r.status}</StatusChip></td>
                        <td className="px-3 py-2 text-right tabular">{num(t.total)}</td>
                        <td className="px-3 py-2 text-right tabular">{num(t.now)}</td>
                        <td className="px-3 py-2 text-right tabular">{t.canPay ? <>{num(t.paid)} <span className="text-subtle">({pct(t.paid / Math.max(1, t.total), 0)})</span></> : <span className="text-subtle">n/a</span>}</td>
                        <td className="px-3 py-2 text-right tabular">{num(t.person)}</td>
                        <td className="px-3 py-2 text-right tabular">{num(t.routed)}</td>
                        <td className="px-3 py-2"><Spark code={t.r.code} total={Math.max(1, t.total / (days || 1))} /></td>
                        <td className="px-3 py-2 text-[12px] text-subtle">{t.agents.length ? t.agents.map(agentName).join(", ") : "None"}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  return <Detail code={code} period={period} periodControl={periodControl} funnelFor={funnelFor} set={set} tab={s.tab ?? "flow"} view={s.view ?? "Steps"} node={s.node} />;
}

type FunnelFor = (c: string, p: Period) => { graph: WfGraph; f: Funnel } | undefined;

function Detail({ code, period, periodControl, funnelFor, set, tab, view, node }: { code: string; period: Period; periodControl: React.ReactNode; funnelFor: FunnelFor; set: (p: Record<string, unknown>) => void; tab: (typeof TABS)[number]; view: "Steps" | "Diagram"; node: string | undefined }) {
  const rows = useWorkflowRows();
  const saved = useWork((st) => st.versions);
  const row = rows.find((r) => r.code === code)!;
  const cur = useMemo(() => funnelFor(code, period), [code, period, saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = cur?.f;
  const paid = sum(f, "outcome.paid");
  const person = sum(f, "outcome.handoff");
  const routed = sum(f, "outcome.routed");
  const canPay = !!cur?.graph.nodes.some((n) => n.type === "outcome.paid");
  const days = period === "Today" ? 1 : period === "Last 7 days" ? 7 : 30;
  const tasks = useMemo(() => TASKS.filter((t) => !t.test && t.workflow === code && NOW.getTime() - new Date(t.at).getTime() <= days * DAY), [code, days]);

  const steps = useMemo(() => {
    if (!cur || !f) return [];
    return cur.graph.nodes
      .filter((n) => !n.type.startsWith("outcome.") && !n.type.startsWith("trigger."))
      .map((n) => ({ n, count: f.nodes[n.id] ?? 0 }))
      .sort((a, b) => a.n.y - b.n.y || a.n.x - b.n.x);
  }, [cur, f]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div>
        <Link to="/persistency/performance" search={{ period: period === "Last 7 days" ? undefined : period }} className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline"><ArrowLeft className="size-3.5" aria-hidden />All workflows</Link>
      </div>
      <PageHeader title={row.name} meta={<span>{row.code} · {period} · <StatusChip tone={versionTone(row.status)}>{row.status}</StatusChip></span>} actions={periodControl} />
      {f && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Entered" value={num(f.total)} />
          <Kpi label="Paid or revived" value={canPay ? num(paid) : "n/a"} change={canPay ? `${pct(paid / Math.max(1, f.total))} of entered` : "This workflow does not collect"} accent="#3fb968" />
          <Kpi label="With a person" value={num(person)} change={`${pct(person / Math.max(1, f.total))} of entered`} accent="#E8A21A" />
          <Kpi label="Moved to another workflow" value={num(routed)} change={`${pct(routed / Math.max(1, f.total))} of entered`} accent="#8B5A2B" />
        </div>
      )}
      <PageTabs
        label="Workflow performance"
        value={tab}
        onChange={(v) => set({ tab: v === "flow" ? undefined : v })}
        tabs={[
          { id: "flow", label: "Flow" },
          { id: "agents", label: "Agents" },
          { id: "history", label: "History" },
          { id: "outcomes", label: "Outcomes by reason" },
        ]}
      />
      {tab === "flow" && cur && f && (
        <>
          <div className="flex items-center justify-between">
            <SegmentedControl label="View" value={view} options={["Steps", "Diagram"] as const} onChange={(v) => set({ view: v === "Steps" ? undefined : v })} size="sm" />
            <Link to="/persistency/workflows/$id" params={{ id: code }} className="text-[13px] text-primary hover:underline">Open the workflow</Link>
          </div>
          {view === "Steps" ? (
            <Panel title="Steps, in order" eyebrow="How many policies reached each step">
              <ul className="space-y-1.5">
                {steps.map(({ n, count }) => {
                  const w = (count / Math.max(1, f.total)) * 100;
                  return (
                    <li key={n.id} className="grid grid-cols-[minmax(220px,1.2fr)_3fr_90px] items-center gap-3 text-[13px]">
                      <span className="text-foreground">{n.label}<span className="ml-2 text-[11px] text-subtle">{PALETTE_BY_TYPE[n.type]?.group}</span></span>
                      <span className="h-3 rounded-sm bg-border/50"><span className="block h-3 rounded-sm bg-primary/80" style={{ width: `${Math.min(100, w)}%` }} /></span>
                      <span className="text-right tabular text-foreground">{num(count)} <span className="text-subtle">{pct(count / Math.max(1, f.total), 0)}</span></span>
                    </li>
                  );
                })}
              </ul>
              <h3 className="mb-1 mt-5 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Where policies ended</h3>
              <ul className="space-y-1 text-[13px]">
                {f.outcomes.filter((o) => o.count > 0).sort((a, b) => b.count - a.count).map((o) => (
                  <li key={o.id} className="flex justify-between"><span className="text-subtle">{o.label}</span><span className="tabular text-foreground">{num(o.count)} · {pct(o.count / Math.max(1, f.total), 0)}</span></li>
                ))}
              </ul>
            </Panel>
          ) : (
            <CanvasBox graph={cur.graph} funnel={{ total: f.total, edges: f.edges, vertical: true }} counts={f.nodes} selectedId={node ?? null} height={900} onSelectNode={(n) => set({ node: n ?? undefined })} />
          )}
        </>
      )}
      {tab === "agents" && cur && f && <AgentsTab code={code} graph={cur.graph} f={f} tasks={tasks} />}
      {tab === "history" && <HistoryTab code={code} tasks={tasks} />}
      {tab === "outcomes" && f && <OutcomesTab f={f} tasks={tasks} />}
    </div>
  );
}

function AgentsTab({ code, graph, f, tasks }: { code: string; graph: WfGraph; f: Funnel; tasks: AgentTask[] }) {
  const pauses = useWork((st) => st.agentPause);
  const used = [...new Set(graph.nodes.map((n) => AGENT_BY_NODE[n.type]).filter((a): a is string => !!a))];
  const rows = used.map((id) => {
    const mine = tasks.filter((t) => t.agentId === id);
    const nodes = graph.nodes.filter((n) => AGENT_BY_NODE[n.type] === id);
    const handled = Math.max(...nodes.map((n) => f.nodes[n.id] ?? 0));
    const done = mine.filter((t) => t.result === "Completed" || t.result === "Handed off").length;
    return { id, steps: nodes.map((n) => n.label), handled, tasks: mine.length, rate: mine.length ? done / mine.length : 1, handoffs: mine.filter((t) => t.result === "Handed off").length, paused: !!pauses[id] };
  });
  const columns: Column<(typeof rows)[number]>[] = [
    { id: "agent", label: "Agent", value: (r) => agentName(r.id), render: (r) => <Link to="/persistency/agents/$id" params={{ id: r.id }} className="text-primary hover:underline">{agentName(r.id)}</Link> },
    { id: "status", label: "Status", value: (r) => (r.paused ? "Paused" : "Running"), render: (r) => <StatusChip tone={r.paused ? "off" : "ok"}>{r.paused ? "Paused" : "Running"}</StatusChip> },
    { id: "steps", label: "Steps it works", value: (r) => r.steps.join(", "), render: (r) => <span className="text-[12px] text-subtle">{r.steps.join(" · ")}</span> },
    { id: "handled", label: "Policies handled", value: (r) => r.handled, align: "right", render: (r) => <span className="tabular">{num(r.handled)}</span> },
    { id: "tasks", label: "Tasks in the period", value: (r) => r.tasks, align: "right", render: (r) => <span className="tabular">{num(r.tasks)}</span> },
    { id: "rate", label: "Finished", value: (r) => r.rate, align: "right", render: (r) => <span className="tabular">{pct(r.rate, 0)}</span> },
    { id: "ho", label: "Handed on", value: (r) => r.handoffs, align: "right", render: (r) => <span className="tabular">{num(r.handoffs)}</span> },
  ];
  return (
    <Panel title="Agents in this workflow" eyebrow={`Who worked the policies in ${code}`}>
      <DataGrid label="Agents in this workflow" columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={10} emptyText="No agents work in this workflow. Its steps are done by people or vendors." />
    </Panel>
  );
}

function HistoryTab({ code, tasks }: { code: string; tasks: AgentTask[] }) {
  const saved = useWork((st) => st.versions);
  const versions = [...wfVersions(saved, code)].reverse();
  const columns: Column<AgentTask>[] = [
    { id: "at", label: "When", value: (t) => t.at, render: (t) => <span className="tabular">{dateTime(t.at)}</span> },
    { id: "agent", label: "Agent", value: (t) => agentName(t.agentId) },
    { id: "step", label: "What it did", value: (t) => t.step },
    { id: "policy", label: "Policy", value: (t) => t.policyId, render: (t) => <Link to="/persistency/policies/$id" params={{ id: t.policyId }} search={{ tab: "activity" }} className="text-primary hover:underline tabular">{t.policyId}</Link> },
    { id: "result", label: "Result", value: (t) => t.result, render: (t) => <StatusChip tone={t.result === "Failed" ? "off" : t.result === "No answer" ? "risk" : t.result === "Handed off" ? "accent" : "ok"}>{t.result}</StatusChip> },
  ];
  return (
    <div className="space-y-4">
      <Panel title="Versions" eyebrow="Every change to this workflow">
        <ul className="divide-y divide-border/60 text-[13px]">
          {versions.map((v) => (
            <li key={v.no} className="flex flex-wrap items-center gap-3 py-2">
              <span className="w-12 font-medium text-foreground">v{v.no}</span>
              <StatusChip tone={versionTone(v.status)}>{v.status}</StatusChip>
              <span className="text-subtle">{v.note}</span>
              <span className="ml-auto text-[12px] text-muted-foreground">{v.author} · {dateTime(v.at)}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Recent runs" eyebrow="Agent tasks in this workflow">
        <DataGrid label="Agent tasks in this workflow" columns={columns} rows={tasks} rowKey={(t) => t.id} pageSize={10} defaultSort={{ id: "at", dir: "desc" }} maxHeight={480} emptyText="No agent tasks in this period." />
      </Panel>
    </div>
  );
}

function OutcomesTab({ f, tasks }: { f: Funnel; tasks: AgentTask[] }) {
  const reasons = new Map<string, number>();
  for (const t of tasks) if (t.reason) reasons.set(t.reason, (reasons.get(t.reason) ?? 0) + 1);
  const list = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...list.map(([, v]) => v));
  const ends = f.outcomes.filter((o) => o.count > 0).sort((a, b) => b.count - a.count);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="How policies ended" eyebrow="Share of policies that entered">
        <ul className="space-y-1.5 text-[13px]">
          {ends.map((o) => (
            <li key={o.id} className="grid grid-cols-[1fr_2fr_90px] items-center gap-3">
              <span className="text-foreground">{o.label}</span>
              <span className="h-3 rounded-sm bg-border/50"><span className="block h-3 rounded-sm bg-primary/80" style={{ width: `${(o.count / Math.max(1, f.total)) * 100}%` }} /></span>
              <span className="text-right tabular">{num(o.count)} <span className="text-subtle">{pct(o.count / Math.max(1, f.total), 0)}</span></span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Lapse reasons heard" eyebrow="Tagged by the Lapse Reason Classifier and the calls">
        {list.length ? (
          <ul className="space-y-1.5 text-[13px]">
            {list.map(([k, v]) => (
              <li key={k} className="grid grid-cols-[1fr_2fr_60px] items-center gap-3">
                <span className="text-foreground">{k}</span>
                <span className="h-3 rounded-sm bg-border/50"><span className="block h-3 rounded-sm bg-attention" style={{ width: `${(v / max) * 100}%` }} /></span>
                <span className="text-right tabular">{num(v)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">No reasons were tagged in this period.</p>
        )}
      </Panel>
    </div>
  );
}
