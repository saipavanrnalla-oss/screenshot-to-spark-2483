import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { DataGrid, type Column } from "@/components/r1/data-grid";
import { Kpi } from "@/components/r1/kpi";
import { StatusChip } from "@/components/r1/status-chip";
import { selectCls } from "@/components/r1/tabs";
import { ConfirmDialog } from "@/components/r1/confirm";
import { AGENTS, WORKFLOWS } from "@/data/persistency";
import { TASKS, type AgentTask } from "@/data/persistency/r1/tasks";
import { NOW } from "@/data/persistency/dates";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { dateTime, num, pct } from "@/lib/format";
import { useWork } from "@/store/work";

const search = z.object({
  agent: fallback(z.string().optional(), undefined),
  wf: fallback(z.string().optional(), undefined),
  result: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/activity")({
  beforeLoad: ({ search }) => gate("activity", search),
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "AI work logs · Persistency · desible.ai" },
      { name: "description", content: "Which agents are running, what each is working on, and the history of what they did." },
      { property: "og:title", content: "AI work logs · Persistency · desible.ai" },
      { property: "og:description", content: "Which agents are running, what each is working on, and the history of what they did." },
    ],
  }),
  component: ActivityPage,
});

const HOUR = 3_600_000;
const wfName = (code: string) => WORKFLOWS.find((w) => w.id === code)?.name ?? code;
const agentLabel = (id: string) => AGENTS.find((a) => a.id === id)?.name ?? id;

function ActivityPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const pauses = useWork((st) => st.agentPause);
  const pause = useWork((st) => st.pauseAgent);
  const resume = useWork((st) => st.resumeAgent);
  const mayPause = useCan("agents.pause");
  const user = useUser();
  const [target, setTarget] = useState<string | null>(null);

  const live = useMemo(() => TASKS.filter((t) => !t.test), []);
  const last24 = useMemo(() => live.filter((t) => NOW.getTime() - new Date(t.at).getTime() <= 24 * HOUR), [live]);
  const enabled = AGENTS.filter((a) => a.status === "Active");
  const running = enabled.filter((a) => !pauses[a.id]);

  const cards = enabled.map((a) => {
    const mine = live.filter((t) => t.agentId === a.id);
    const day = last24.filter((t) => t.agentId === a.id);
    const latest = mine[0];
    const buckets = Array.from({ length: 24 }, (_, i) => day.filter((t) => Math.floor((NOW.getTime() - new Date(t.at).getTime()) / HOUR) === 23 - i).length);
    const done = day.filter((t) => t.result === "Completed" || t.result === "Handed off").length;
    return { a, latest, day, buckets, rate: day.length ? done / day.length : 1, lastHour: day.filter((t) => NOW.getTime() - new Date(t.at).getTime() <= HOUR).length };
  });

  const failed24 = last24.filter((t) => t.result === "Failed").length;
  const handed24 = last24.filter((t) => t.result === "Handed off").length;
  const paused = enabled.filter((a) => pauses[a.id]).length;

  const history = useMemo(
    () =>
      live.filter(
        (t) =>
          NOW.getTime() - new Date(t.at).getTime() <= 7 * 24 * HOUR &&
          (!s.agent || t.agentId === s.agent) &&
          (!s.wf || t.workflow === s.wf) &&
          (!s.result || t.result === s.result),
      ),
    [live, s.agent, s.wf, s.result],
  );

  const columns: Column<AgentTask>[] = [
    { id: "at", label: "When", value: (t) => t.at, render: (t) => <span className="tabular">{dateTime(t.at)}</span> },
    { id: "agent", label: "Agent", value: (t) => agentLabel(t.agentId), render: (t) => <span>{agentLabel(t.agentId)} <span className="text-subtle">v{t.agentVersion}</span></span> },
    { id: "wf", label: "Workflow", value: (t) => t.workflow, render: (t) => <span>{t.workflow} · {wfName(t.workflow)}</span> },
    { id: "step", label: "What it did", value: (t) => t.step },
    { id: "policy", label: "Policy", value: (t) => t.policyId, render: (t) => <Link to="/persistency/policies/$id" params={{ id: t.policyId }} search={{ tab: "activity" }} className="text-primary hover:underline tabular">{t.policyId}</Link> },
    { id: "result", label: "Result", value: (t) => t.result, render: (t) => <StatusChip tone={t.result === "Failed" ? "off" : t.result === "No answer" ? "risk" : t.result === "Handed off" ? "accent" : "ok"}>{t.result}</StatusChip> },
    { id: "to", label: "Went to", value: (t) => t.handoffTo ?? "", render: (t) => t.handoffTo ?? <span className="text-subtle">—</span> },
    { id: "dur", label: "Seconds", value: (t) => t.durationSec, align: "right", render: (t) => <span className="tabular">{t.durationSec}</span> },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader title="AI work logs" meta={`${running.length} of ${enabled.length} agents running · as of ${dateTime(NOW)}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Agents running" value={`${running.length} of ${enabled.length}`} change={paused ? `${paused} paused` : "None paused"} accent="#3fb968" />
        <Kpi label="Tasks, last 24 hours" value={num(last24.length)} change="Across all agents" />
        <Kpi label="Finished or handed on" value={pct(last24.length ? (last24.length - failed24 - last24.filter((t) => t.result === "No answer").length) / last24.length : 1)} change="Excludes no answer and failed" />
        <Kpi label="Handed to a person or agent" value={num(handed24)} change="Last 24 hours" accent="#E8A21A" />
        <Kpi label="Failed" value={num(failed24)} change="Last 24 hours" good={failed24 === 0 ? true : undefined} accent="#D64545" />
      </div>

      <Panel title="Running now" eyebrow="Each agent, what it last worked on and the last 24 hours">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ a, latest, buckets, rate, lastHour, day }) => {
            const isPaused = !!pauses[a.id];
            const max = Math.max(1, ...buckets);
            return (
              <div key={a.id} className="rounded-card border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to="/persistency/agents/$id" params={{ id: a.id }} className="text-[14px] font-semibold text-foreground hover:underline">{a.name}</Link>
                    <div className="text-[12px] text-muted-foreground">{a.type} · version {a.version}</div>
                  </div>
                  <StatusChip tone={isPaused ? "off" : "ok"}>{isPaused ? "Paused" : "Running"}</StatusChip>
                </div>
                <div className="mt-2 text-[12px] text-muted-foreground">
                  {isPaused ? (
                    <>Paused by {pauses[a.id]!.by}: {pauses[a.id]!.reason}</>
                  ) : latest ? (
                    <>Last task: <span className="text-foreground">{latest.step}</span> in {latest.workflow} · {wfName(latest.workflow)}</>
                  ) : (
                    "No tasks yet"
                  )}
                </div>
                <div className="mt-3 flex h-10 items-end gap-[2px]" aria-label="Tasks per hour, last 24 hours">
                  {buckets.map((b, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${Math.max(6, (b / max) * 100)}%`, opacity: isPaused ? 0.25 : 1 }} title={`${b} tasks`} />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground"><span className="tabular text-foreground">{num(day.length)}</span> in 24 hours · <span className="tabular text-foreground">{num(lastHour)}</span> in the last hour · <span className="tabular text-foreground">{pct(rate, 0)}</span> finished</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate({ search: { agent: a.id } })}>See its history</Button>
                  {mayPause && (isPaused ? (
                    <Button size="sm" variant="outline" onClick={() => { resume(a.id, user?.name ?? "User"); toast.success(`${a.name} resumed`); }}><Play className="mr-1 size-3.5" aria-hidden />Resume</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setTarget(a.id)}><Pause className="mr-1 size-3.5" aria-hidden />Pause</Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="History" eyebrow="Every task in the last 7 days">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select aria-label="Agent" value={s.agent ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, agent: e.target.value || undefined }) })} className={selectCls}>
            <option value="">All agents</option>
            {enabled.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label="Workflow" value={s.wf ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, wf: e.target.value || undefined }) })} className={selectCls}>
            <option value="">All workflows</option>
            {WORKFLOWS.map((w) => <option key={w.id} value={w.id}>{w.id} · {w.name}</option>)}
          </select>
          <select aria-label="Result" value={s.result ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, result: e.target.value || undefined }) })} className={selectCls}>
            <option value="">All results</option>
            {["Completed", "Handed off", "No answer", "Failed"].map((r) => <option key={r}>{r}</option>)}
          </select>
          <span className="text-[12px] text-muted-foreground">{num(history.length)} tasks</span>
        </div>
        <DataGrid label="Agent task history" columns={columns} rows={history} rowKey={(t) => t.id} pageSize={15} csvName="agent-activity" defaultSort={{ id: "at", dir: "desc" }} maxHeight={560} />
      </Panel>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Pause ${target ? agentLabel(target) : ""}`}
        body="No new tasks go to this agent until it is resumed. Workflows that use it show it as paused."
        reason="required"
        confirmLabel="Pause"
        destructive
        onConfirm={(r) => {
          if (!target) return;
          pause(target, user?.name ?? "User", r.reason);
          toast.success(`${agentLabel(target)} paused`);
        }}
      />
    </div>
  );
}
