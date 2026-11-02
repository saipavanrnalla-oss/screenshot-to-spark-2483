import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NoteBanner, PageHeader, Panel } from "@/components/ds/primitives";
import { DataGrid } from "@/components/r1/data-grid";
import { StatusChip } from "@/components/r1/status-chip";
import { PageTabs, inputCls, selectCls } from "@/components/r1/tabs";
import { ConfirmDialog } from "@/components/r1/confirm";
import { agentVersions } from "@/components/r1/agent-model";
import { AGENTS } from "@/data/persistency";
import { HANDOFFS, TASKS, agentStats, type Handoff, type HandoffRule, type QueueTask } from "@/data/persistency/r1/tasks";
import { NOW } from "@/data/persistency/dates";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { dateTime, inr, num, pct } from "@/lib/format";
import { usePersistencyStore, usePolicy } from "@/store/persistency";
import { useQueue, useWork, type Orchestration } from "@/store/work";

const search = z.object({
  tab: fallback(z.enum(["library", "handoffs", "queue", "settings"]).optional(), undefined),
  status: fallback(z.string().optional(), undefined),
  type: fallback(z.string().optional(), undefined),
  handoff: fallback(z.string().optional(), undefined),
  sub: fallback(z.enum(["cases", "rules"]).optional(), undefined),
});

export const Route = createFileRoute("/persistency/agents")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("agents", search),
  head: () => ({
    meta: [
      { title: "Agents · Persistency · desible.ai" },
      { name: "description", content: "Agents, handoffs, the task queue and orchestration settings." },
      { property: "og:title", content: "Agents · Persistency · desible.ai" },
      { property: "og:description", content: "Agents, handoffs, the task queue and orchestration settings." },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab = s.tab ?? "library";
  const queue = useQueue();
  const overdue = queue.filter((q) => !q.closed && q.status === "Overdue").length;
  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader title="Agents" meta={`${AGENTS.filter((a) => a.status === "Active").length} active · ${AGENTS.filter((a) => a.status === "Not enabled").length} not enabled`} />
      <PageTabs
        label="Agents"
        value={tab}
        onChange={(v) => navigate({ search: { tab: v === "library" ? undefined : v } })}
        tabs={[
          { id: "library", label: "Library" },
          { id: "handoffs", label: "Handoffs", count: HANDOFFS.filter((h) => h.status !== "Closed").length },
          { id: "queue", label: "Task queue", count: overdue || undefined },
          { id: "settings", label: "Orchestration" },
        ]}
      />
      {tab === "library" && <Library />}
      {tab === "handoffs" && <Handoffs />}
      {tab === "queue" && <Queue />}
      {tab === "settings" && <Settings />}
    </div>
  );
}

/* ---------- Library ---------- */

interface AgentRow {
  id: string;
  name: string;
  type: string;
  status: "Active" | "Paused" | "Not enabled";
  version: number;
  workflows: string[];
  tasks: number;
  success: number;
  handoffs: number;
  aht: number;
  conduct: number;
  cost: number;
}

function Library() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const pauses = useWork((st) => st.agentPause);
  const saved = useWork((st) => st.versions);
  const pause = useWork((st) => st.pauseAgent);
  const resume = useWork((st) => st.resumeAgent);
  const mayPause = useCan("agents.pause");
  const user = useUser();
  const [target, setTarget] = useState<AgentRow | null>(null);
  const rows: AgentRow[] = useMemo(
    () =>
      AGENTS.map((a) => {
        const st = agentStats(a.id, 30);
        const list = agentVersions(saved, a.id);
        return {
          id: a.id,
          name: a.name,
          type: a.type,
          status: a.status === "Not enabled" ? "Not enabled" : pauses[a.id] ? "Paused" : "Active",
          version: list.find((v) => v.status === "Active")?.no ?? a.version,
          workflows: a.workflows,
          tasks: st.tasks,
          success: st.success,
          handoffs: st.handoffs,
          aht: st.aht,
          conduct: st.conduct,
          cost: st.cost,
        };
      }),
    [pauses, saved],
  );
  const filtered = rows.filter((r) => (!s.type || r.type === s.type) && (!s.status || r.status === s.status));
  const enabled = (r: AgentRow) => r.status !== "Not enabled";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select value={s.type ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, type: e.target.value || undefined }) })} className={selectCls} aria-label="Type">
          <option value="">All types</option>
          {[...new Set(AGENTS.map((a) => a.type))].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={s.status ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, status: e.target.value || undefined }) })} className={selectCls} aria-label="Status">
          <option value="">All statuses</option>
          {["Active", "Paused", "Not enabled"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <DataGrid
        label="Agents"
        rows={filtered}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate({ to: "/persistency/agents/$id", params: { id: r.id } })}
        rowClassName={(r) => (r.status === "Paused" ? "bg-destructive/10" : r.status === "Not enabled" ? "text-muted-foreground" : undefined)}
        csvName="agents.csv"
        columns={[
          { id: "name", label: "Name", value: (r) => r.name, render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
          { id: "type", label: "Type", value: (r) => r.type },
          { id: "status", label: "Status", value: (r) => r.status, render: (r) => <StatusChip tone={r.status === "Active" ? "ok" : r.status === "Paused" ? "risk" : "off"}>{r.status}</StatusChip> },
          { id: "version", label: "Version", align: "right", value: (r) => r.version, render: (r) => (enabled(r) ? `v${r.version}` : "None") },
          { id: "workflows", label: "Workflows served", value: (r) => r.workflows.join(", ") },
          { id: "tasks", label: "Tasks (30 days)", align: "right", value: (r) => r.tasks, render: (r) => num(r.tasks) },
          { id: "success", label: "Success rate", align: "right", value: (r) => r.success, render: (r) => (r.tasks ? pct(r.success * 100) : "None") },
          { id: "handoff", label: "Handoff rate", align: "right", value: (r) => r.handoffs, render: (r) => (r.tasks ? pct(r.handoffs * 100) : "None") },
          { id: "aht", label: "Average handling time", align: "right", value: (r) => r.aht, render: (r) => (r.aht ? `${Math.round(r.aht)} s` : "None") },
          { id: "conduct", label: "Conduct score", align: "right", value: (r) => r.conduct, render: (r) => (r.tasks ? pct(r.conduct * 100) : "None") },
          { id: "cost", label: "Cost (30 days)", align: "right", value: (r) => r.cost, render: (r) => (r.tasks ? inr(Math.round(r.cost)) : "None") },
          {
            id: "pause",
            label: "Pause",
            sortable: false,
            value: (r) => r.status,
            render: (r) =>
              enabled(r) ? (
                <span onClick={(e) => e.stopPropagation()}>
                  <Switch
                    aria-label={`Pause ${r.name}`}
                    checked={r.status === "Paused"}
                    disabled={!mayPause}
                    onCheckedChange={(on) => {
                      if (on) setTarget(r);
                      else {
                        resume(r.id, user?.name ?? "User");
                        toast.success(`${r.name} resumed`);
                      }
                    }}
                  />
                </span>
              ) : null,
          },
        ]}
      />
      {!mayPause && <p className="text-[12px] text-muted-foreground">Only Compliance and quality can pause an agent.</p>}
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Pause ${target?.name ?? ""}`}
        body="No new tasks go to this agent until it is resumed. Workflows that use it show it as paused."
        reason="required"
        confirmLabel="Pause"
        destructive
        onConfirm={(r) => {
          if (!target) return;
          pause(target.id, user?.name ?? "User", r.reason);
          toast.success(`${target.name} paused`);
        }}
      />
    </>
  );
}

/* ---------- Handoffs ---------- */

function age(at: string): string {
  const h = Math.max(0, Math.round((NOW.getTime() - new Date(at).getTime()) / 3_600_000));
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
}

function Handoffs() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const sub = s.sub ?? "cases";
  const open = HANDOFFS.find((h) => h.id === s.handoff);
  return (
    <div className="space-y-3">
      <PageTabs label="Handoffs" value={sub} onChange={(v) => navigate({ search: (p) => ({ ...p, sub: v === "cases" ? undefined : v }) })} tabs={[{ id: "cases", label: "Cases" }, { id: "rules", label: "Rules" }]} />
      {sub === "cases" ? (
        <DataGrid
          label="Handoffs"
          rows={HANDOFFS}
          rowKey={(h) => h.id}
          onRowClick={(h) => navigate({ search: (p) => ({ ...p, handoff: h.id }) })}
          csvName="handoffs.csv"
          columns={[
            { id: "at", label: "Time", value: (h) => h.at, render: (h) => dateTime(h.at) },
            { id: "policy", label: "Policy", value: (h) => h.policyId },
            { id: "from", label: "From", value: (h) => h.from },
            { id: "to", label: "To", value: (h) => h.to },
            { id: "trigger", label: "Trigger", value: (h) => h.trigger },
            { id: "age", label: "Age", value: (h) => h.at, render: (h) => age(h.at) },
            { id: "status", label: "Status", value: (h) => h.status, render: (h) => <StatusChip tone={h.status === "Closed" ? "off" : h.status === "Open" ? "risk" : "neutral"}>{h.status}</StatusChip> },
          ]}
        />
      ) : (
        <HandoffRules />
      )}
      <Sheet open={!!open} onOpenChange={(o) => !o && navigate({ search: (p) => ({ ...p, handoff: undefined }) })}>
        <SheetContent side="right" className="w-full overflow-y-auto border-border bg-background sm:max-w-[480px]">{open && <Packet h={open} />}</SheetContent>
      </Sheet>
    </div>
  );
}

function Packet({ h }: { h: Handoff }) {
  const p = usePolicy(h.policyId);
  const t = TASKS.find((x) => x.id === h.taskId);
  const deadline = new Date(new Date(h.at).getTime() + 48 * 3_600_000).toISOString();
  const fields: [string, string][] = [
    ["Who the customer is", p ? `${p.customerName}, ${p.product} policy ${p.policyId}, premium ${inr(p.annualisedPremium)}, ${p.language}, cohort ${p.insurerCohort}` : h.policyId],
    ["Why the case moved", h.trigger],
    ["What was said", t?.disposition ? `Customer said: ${t.disposition.toLowerCase()}${t.reason ? `; reason ${t.reason.toLowerCase()}` : ""}` : t?.msgStatus ? `Message ${t.msgStatus.toLowerCase()}, no reply` : "No conversation"],
    ["What was offered", "Payment link, autopay set-up"],
    ["What the customer asked for", t?.disposition === "Asked for a person" ? "To speak to a person" : t?.disposition === "Wants to surrender" ? "Surrender options" : t?.disposition === "Complaint or mis-selling" ? "To raise a complaint" : "Nothing further"],
    ["Next step with deadline", `${h.to} acts by ${dateTime(deadline)}`],
  ];
  return (
    <div className="space-y-4">
      <SheetHeader className="text-left">
        <SheetTitle className="text-[16px]">Handoff {h.id}</SheetTitle>
        <p className="text-[12px] text-muted-foreground">{h.from} to {h.to} · {dateTime(h.at)} · {h.status}</p>
      </SheetHeader>
      <dl className="space-y-3 text-[13px]">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[12px] font-medium text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Link to="/persistency/policies/$id" params={{ id: h.policyId }} search={{ tab: "activity" }} className="text-[13px] text-primary hover:underline">Open the policy's Activity</Link>
    </div>
  );
}

function HandoffRules() {
  const rules = useWork((s) => s.handoffRules);
  const setRules = useWork((s) => s.setHandoffRules);
  const mayEdit = useCan("agents.edit");
  const user = useUser();
  const [draft, setDraft] = useState<HandoffRule[]>(rules);
  const dirty = JSON.stringify(draft) !== JSON.stringify(rules);
  const set = (i: number, patch: Partial<HandoffRule>) => setDraft(draft.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Panel
      title="Handoff rules"
      actions={
        mayEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft([...draft, { id: `HR${draft.length + 1}`, from: "Any agent", to: "Team lead", trigger: "" }])}><Plus /> Add rule</Button>
            <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setDraft(rules)}>Discard</Button>
            <Button size="sm" disabled={!dirty || draft.some((r) => !r.trigger.trim())} onClick={() => { setRules(draft, user?.name ?? "User"); toast.success("Handoff rules saved"); }}>Save</Button>
          </div>
        )
      }
      bodyClassName="p-0"
    >
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
            <th className="px-3 py-2 font-medium">From</th>
            <th className="px-3 py-2 font-medium">To</th>
            <th className="px-3 py-2 font-medium">Trigger</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {draft.map((r, i) => (
            <tr key={r.id} className="border-t border-border/60">
              <td className="px-3 py-1.5"><input disabled={!mayEdit} value={r.from} onChange={(e) => set(i, { from: e.target.value })} className={inputCls} aria-label="From" /></td>
              <td className="px-3 py-1.5"><input disabled={!mayEdit} value={r.to} onChange={(e) => set(i, { to: e.target.value })} className={inputCls} aria-label="To" /></td>
              <td className="px-3 py-1.5"><input disabled={!mayEdit} value={r.trigger} onChange={(e) => set(i, { trigger: e.target.value })} className={inputCls} aria-label="Trigger" /></td>
              <td className="px-3 py-1.5">{mayEdit && <Button size="icon" variant="ghost" className="size-7" aria-label="Delete rule" onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 /></Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ---------- Task queue ---------- */

const MOVE_TO = ["Telecaller", "Renewal voice agent", "Call-centre vendor (fixed payout)", "Call-centre vendor (variable payout)", "Sales officer", "High-value desk", "Remittance and operations"];

function Queue() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queue = useQueue();
  const retry = useWork((st) => st.retryTask);
  const move = useWork((st) => st.moveTask);
  const lead = useWork((st) => st.sendToLead);
  const mayAct = useCan("policies.act");
  const user = useUser();
  const [moving, setMoving] = useState<QueueTask | null>(null);
  const [leading, setLeading] = useState<QueueTask | null>(null);
  const open = queue.filter((q) => !q.closed);
  const rows = open.filter((q) => !s.status || q.status === s.status);
  const by = user?.name ?? "User";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {["In flight", "Due soon", "Overdue", "Retried"].map((st) => (
          <button key={st} type="button" onClick={() => navigate({ search: (p) => ({ ...p, status: p.status === st ? undefined : st }) })} className={`rounded-pill border px-3 py-1 text-[12px] ${s.status === st ? "border-primary text-foreground" : "border-border text-subtle"}`}>
            {st} <span className="tabular">{num(open.filter((q) => q.status === st).length)}</span>
          </button>
        ))}
      </div>
      <DataGrid
        label="Task queue"
        rows={rows}
        rowKey={(q) => q.id}
        csvName="task-queue.csv"
        columns={[
          { id: "task", label: "Task", value: (q) => q.task, render: (q) => <span className="text-foreground">{q.id} · {q.task}</span> },
          { id: "policy", label: "Policy", value: (q) => q.policyId, render: (q) => <Link to="/persistency/policies/$id" params={{ id: q.policyId }} search={{ tab: "activity" }} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{q.policyId}</Link> },
          { id: "wf", label: "Workflow and step", value: (q) => `${q.workflow} ${q.step}` },
          { id: "executor", label: "Executor", value: (q) => q.executor },
          { id: "deadline", label: "Deadline", value: (q) => q.deadline, render: (q) => dateTime(q.deadline) },
          { id: "retries", label: "Retries used", align: "right", value: (q) => q.retries, render: (q) => `${q.retries} of ${q.maxRetries}` },
          { id: "status", label: "Status", value: (q) => q.status, render: (q) => <StatusChip tone={q.status === "Overdue" ? "risk" : q.status === "Retried" ? "neutral" : "ok"}>{q.status}</StatusChip> },
          {
            id: "actions",
            label: "Actions",
            sortable: false,
            value: () => "",
            render: (q) =>
              mayAct ? (
                <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" disabled={q.retries >= q.maxRetries} onClick={() => { retry(q.id, by); toast.success(`${q.id} retried now`); }}>Retry now</Button>
                  <Button size="sm" variant="ghost" onClick={() => setMoving(q)}>Move</Button>
                  <Button size="sm" variant="ghost" onClick={() => setLeading(q)}>To team lead</Button>
                </span>
              ) : null,
          },
        ]}
      />
      <ConfirmDialog
        open={!!moving}
        onOpenChange={(o) => !o && setMoving(null)}
        title={`Move ${moving?.id ?? ""} to another executor`}
        body={`The task closes on ${moving?.executor ?? ""} and a new one opens on the executor you choose. Both show, linked, in the policy's Activity.`}
        choices={MOVE_TO.filter((m) => m !== moving?.executor)}
        choiceLabel="Move to"
        confirmLabel="Move"
        onConfirm={(r) => {
          if (!moving) return;
          move(moving.id, r.choice, by);
          toast.success(`Moved to ${r.choice}`);
        }}
      />
      <ConfirmDialog
        open={!!leading}
        onOpenChange={(o) => !o && setLeading(null)}
        title={`Send ${leading?.id ?? ""} to the team lead`}
        confirmLabel="Send"
        onConfirm={() => {
          if (!leading) return;
          lead(leading.id, by);
          toast.success("Sent to the team lead");
        }}
      />
    </>
  );
}

/* ---------- Orchestration ---------- */

function Settings() {
  const o = useWork((s) => s.orchestration);
  const save = useWork((s) => s.setOrchestration);
  const events = useWork((s) => s.events);
  const setPauseAll = useWork((s) => s.setPauseAll);
  const pausedAll = usePersistencyStore((s) => s.killSwitchGlobal);
  const mayEdit = useCan("agents.edit");
  const mayPauseAll = useCan("outreach.pauseAll");
  const user = useUser();
  const [d, setD] = useState<Orchestration>(o);
  const [pauseOpen, setPauseOpen] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(o);
  const log = events.filter((e) => /outreach/i.test(e.text));
  const check = (k: "oneJourney" | "countVendorTouches" | "noDuplicateTasks", label: string) => (
    <label className="flex items-center justify-between gap-3 text-[13px]">
      <span>{label}</span>
      <Switch disabled={!mayEdit} checked={d[k]} onCheckedChange={(v) => setD({ ...d, [k]: v })} aria-label={label} />
    </label>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Journeys and contact" actions={mayEdit && <Button size="sm" disabled={!dirty} onClick={() => { save(d, user?.name ?? "User"); toast.success("Orchestration settings saved"); }}>Save</Button>}>
        <div className="space-y-3">
          {check("oneJourney", "One active journey and one owner executor per policy")}
          <label className="block text-[12px] font-medium text-muted-foreground">
            When two journeys apply
            <input disabled={!mayEdit} value={d.precedence} onChange={(e) => setD({ ...d, precedence: e.target.value })} className={`${inputCls} mt-1`} />
          </label>
          {check("countVendorTouches", "The contact limit counts every touch from every executor, vendors included")}
          {check("noDuplicateTasks", "A task is never sent twice for the same event")}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["call", "message", "person", "file"] as const).map((k) => (
              <label key={k} className="block text-[12px] font-medium text-muted-foreground">
                Deadline, {k} (h)
                <input disabled={!mayEdit} type="number" min={1} value={d.deadlines[k]} onChange={(e) => setD({ ...d, deadlines: { ...d.deadlines, [k]: Math.max(1, Number(e.target.value) || 1) } })} className={`${inputCls} mt-1 tabular`} />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[12px] font-medium text-muted-foreground">
              Retry gap (h)
              <input disabled={!mayEdit} type="number" min={1} value={d.retryGapHours} onChange={(e) => setD({ ...d, retryGapHours: Math.max(1, Number(e.target.value) || 1) })} className={`${inputCls} mt-1 tabular`} />
            </label>
            <label className="block text-[12px] font-medium text-muted-foreground">
              At timeout
              <select disabled={!mayEdit} value={d.onTimeout} onChange={(e) => setD({ ...d, onTimeout: e.target.value as Orchestration["onTimeout"] })} className={`${selectCls} mt-1 w-full`}>
                {["Retry", "Move to another executor", "Send to team lead"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Panel>
      <Panel title="Pause all outreach">
        {pausedAll ? <NoteBanner tone="attention">All outreach is paused. Decisions are logged; nothing is sent.</NoteBanner> : <p className="text-[13px] text-subtle">Outreach is running.</p>}
        <div className="mt-3">
          {mayPauseAll ? (
            pausedAll ? (
              <Button size="sm" variant="outline" onClick={() => { setPauseAll(false, user?.name ?? "User", ""); toast.success("Outreach resumed"); }}>Resume all outreach</Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setPauseOpen(true)}>Pause all outreach</Button>
            )
          ) : (
            <p className="text-[12px] text-muted-foreground">Only Compliance and quality can pause all outreach.</p>
          )}
        </div>
        <ul className="mt-4 space-y-1 text-[12px]">
          {log.map((e) => (
            <li key={e.id} className="flex justify-between gap-2"><span>{e.text}</span><span className="text-muted-foreground">{e.by} · {dateTime(e.at)}</span></li>
          ))}
        </ul>
      </Panel>
      <ConfirmDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        title="Pause all outreach"
        body="Every agent, vendor list and message stops until resumed."
        reason="required"
        destructive
        confirmLabel="Pause all"
        onConfirm={(r) => {
          setPauseAll(true, user?.name ?? "User", r.reason);
          toast.success("All outreach paused");
        }}
      />
    </div>
  );
}
