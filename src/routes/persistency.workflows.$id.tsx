import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CanvasBox } from "@/components/r1/canvas-box";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Copy, Pencil, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, NoteBanner, Panel } from "@/components/ds/primitives";
import { DataGrid } from "@/components/r1/data-grid";
import { StatusChip, versionTone } from "@/components/r1/status-chip";
import { PageTabs } from "@/components/r1/tabs";
import { WF_HIGHLIGHTS } from "@/data/persistency/r1/wf-highlights";
import { ConfirmDialog } from "@/components/r1/confirm";
import { SimConsole } from "@/components/r1/wf-sim";
import { ExampleRun } from "@/components/r1/wf-example";
import { executorsOf, nodeCounts, prepare, useWorkflowRows, versionAt, wfVersions } from "@/components/r1/wf-model";
import type { Mark } from "@/components/r1/wf-canvas";
import { PALETTE_BY_TYPE, type WfGraph, type WfNode } from "@/data/persistency/r1/wf";
import { AGENT_META, type AgentConfig } from "@/data/persistency/r1/agents";
import { seedActivity } from "@/data/persistency/r1/activity";
import type { ActivityRow, Version } from "@/data/persistency/r1/types";
import type { Policy } from "@/data/persistency";
import { diffGraphs, edgeOptions, estimatedCost, isOutreach } from "@/engine/workflow";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { dateTime, inr, num } from "@/lib/format";
import { seedVersions, useWork } from "@/store/work";


const search = z.object({
  tab: fallback(z.enum(["canvas", "activity", "versions", "settings"]).optional(), undefined),
  node: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/workflows/$id")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("workflows", search),
  head: ({ params }) => ({
    meta: [
      { title: `Workflow ${params.id} · Workflows · desible.ai` },
      { name: "description", content: "Workflow canvas, activity, versions and settings." },
      { property: "og:title", content: `Workflow ${params.id} · Workflows · desible.ai` },
      { property: "og:description", content: "Workflow canvas, activity, versions and settings." },
    ],
  }),
  component: WorkflowPage,
});

function WorkflowPage() {
  const { id } = Route.useParams();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const nav = useNavigate();
  const rows = useWorkflowRows();
  const row = rows.find((r) => r.code === id);
  const saved = useWork((st) => st.versions);
  const list = useMemo(() => wfVersions(saved, id), [saved, id]);
  const active = list.find((v) => v.status === "Active") ?? list[list.length - 1];
  const graph = useMemo(() => (active ? prepare(active.data) : undefined), [active]);
  const { scoped } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const inIt = useMemo(() => scoped.filter((p) => stats.decisions.get(p.policyId)?.workflowId === id), [scoped, stats.decisions, id]);
  const { counts, byNode } = useMemo(() => (graph ? nodeCounts(graph, inIt) : { counts: {}, byNode: {} }), [graph, inIt]);
  const mayEdit = useCan("workflows.edit");
  const user = useUser();
  const saveDraft = useWork((st) => st.saveDraft);
  const attachSim = useWork((st) => st.attachSim);
  const createWorkflow = useWork((st) => st.createWorkflow);
  const [simOpen, setSimOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [showPins, setShowPins] = useState(false);
  const highlights = WF_HIGHLIGHTS[id]?.filter((h) => graph?.nodes.some((n) => n.id === h.nodeId)) ?? [];
  const pins = showPins ? Object.fromEntries(highlights.map((h, i) => [h.nodeId, i + 1])) : undefined;
  const tab = s.tab ?? "canvas";
  const author = user?.name ?? "User";

  if (!row || !graph || !active) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4">
        <EmptyState title={`There is no workflow called ${id}.`} action={<Link to="/persistency/workflows" className="text-[13px] text-primary hover:underline">Back to the library</Link>} />
      </div>
    );
  }
  const node = graph.nodes.find((n) => n.id === s.node);
  const inReview = list.find((v) => v.status === "In review");

  const edit = () => {
    const last = list[list.length - 1];
    if (last?.status === "In review") return void toast.error(`Version ${last.no} is in review. Edit opens again after a decision.`);
    const no = last?.status === "Draft" ? last.no : saveDraft(`workflow:${id}`, structuredClone(active.data), author, "");
    toast.success(`Editing version ${no} as a draft`);
    nav({ to: "/persistency/workflows/$id/edit", params: { id } });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Link to="/persistency/workflows" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> Workflows
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[20px] font-semibold text-foreground"><span className="mr-2 text-primary">{row.code}</span>{row.name}</h1>
        <StatusChip tone={versionTone(row.status)}>{row.status}{row.version ? ` · v${row.version}` : ""}</StatusChip>
        {row.draft && <StatusChip tone="neutral">Draft v{row.draft}</StatusChip>}
        {inReview && <StatusChip tone="risk">v{inReview.no} in review</StatusChip>}
        <span className="text-[12px] text-muted-foreground">{row.stage} · {num(inIt.length)} policies in it now</span>
        <div className="ml-auto flex gap-2">
          {mayEdit && <Button size="sm" onClick={edit}><Pencil /> Edit</Button>}
          <Button size="sm" onClick={() => { navigate({ search: (p) => ({ ...p, tab: undefined }) }); setExOpen(true); }}><Play /> Run an example</Button>
          <Button size="sm" variant="outline" onClick={() => { navigate({ search: (p) => ({ ...p, tab: undefined }) }); setSimOpen(true); }}><Play /> Simulate</Button>
          {mayEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const code = createWorkflow(`${row.name} copy`, row.stage, author);
                saveDraft(`workflow:${code}`, structuredClone(active.data), author, `Duplicated from ${id}`);
                toast.success(`${code} created as a draft`);
                nav({ to: "/persistency/workflows/$id/edit", params: { id: code } });
              }}
            >
              <Copy /> Duplicate
            </Button>
          )}
        </div>
      </div>
      <PageTabs
        label="Workflow"
        value={tab}
        onChange={(v) => navigate({ search: (p) => ({ ...p, tab: v === "canvas" ? undefined : v }) })}
        tabs={[
          { id: "canvas", label: "Canvas" },
          { id: "activity", label: "Activity" },
          { id: "versions", label: "Versions", count: list.length },
          { id: "settings", label: "Settings" },
        ]}
      />
      {tab === "canvas" && (
        <div className="space-y-4">
          {highlights.length > 0 && (
            <section className="space-y-2" aria-label="Highlights">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={showPins ? "default" : "outline"} onClick={() => setShowPins(!showPins)}><Sparkles /> {showPins ? "Hide highlights" : "Show highlights"}</Button>
                <span className="text-[12px] text-muted-foreground">{showPins ? "Click a highlight to go to its step." : `${highlights.length} steps to point at when you walk someone through this journey.`}</span>
              </div>
              {showPins && (
                <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {highlights.map((h, i) => (
                    <li key={h.nodeId}>
                      <button type="button" onClick={() => { setActiveNode(h.nodeId); navigate({ search: (p) => ({ ...p, node: h.nodeId }), replace: true }); }} className={`flex h-full w-full gap-2 rounded-card border p-3 text-left transition-colors hover:border-attention ${activeNode === h.nodeId ? "border-attention bg-surface-translucent" : "border-border bg-card"}`}>
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-attention text-[12px] font-semibold text-background">{i + 1}</span>
                        <span><span className="block text-[13px] font-semibold text-foreground">{h.title}</span><span className="block text-[12px] text-muted-foreground">{h.text}</span></span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          <div className={`grid gap-4 ${node ? "xl:grid-cols-[1fr_380px]" : ""}`}>
            <CanvasBox graph={graph} height={graph.nodes.length > 30 ? 680 : 560} counts={counts} marks={Object.fromEntries(pathIds.map((i) => [i, "path" as const]))} selectedId={s.node ?? null} activeId={activeNode} pins={pins} onSelectNode={(n) => navigate({ search: (p) => ({ ...p, node: n ?? undefined }), replace: true })} />
            {node && <NodePanel code={id} node={node} policies={byNode[node.id] ?? []} graph={graph} onClose={() => navigate({ search: (p) => ({ ...p, node: undefined }), replace: true })} />}
          </div>
          {exOpen && <ExampleRun graph={graph} suggested={inIt} onPath={(path, act) => { setPathIds(path); setActiveNode(act); }} onClose={() => { setExOpen(false); setPathIds([]); setActiveNode(null); }} />}
          {simOpen && <SimConsole graph={graph} policies={inIt} by={author} onActive={setActiveNode} onStored={(r) => attachSim(`workflow:${id}`, r)} onClose={() => setSimOpen(false)} />}
        </div>
      )}
      {tab === "activity" && <ActivityTab code={id} versions={list} policies={inIt} />}
      {tab === "versions" && <VersionsTab code={id} list={list} />}
      {tab === "settings" && <SettingsTab code={id} graph={graph} stage={row.stage} products={row.products} trigger={row.trigger} />}
    </div>
  );
}

function agentVersionLabel(saved: Record<string, Version<unknown>[]>, agentId: string): { no: number; data?: AgentConfig | undefined } {
  const list = (saved[`agent:${agentId}`] ?? seedVersions(`agent:${agentId}`)) as Version<AgentConfig>[];
  const a = list.find((v) => v.status === "Active");
  return { no: a?.no ?? 1, data: a?.data };
}

function NodePanel({ code, node, policies, graph, onClose }: { code: string; node: WfNode; policies: { policyId: string; customerName: string }[]; graph: WfGraph; onClose: () => void }) {
  const item = PALETTE_BY_TYPE[node.type];
  const saved = useWork((s) => s.versions);
  const executors = useWork((s) => s.executors);
  const agent = item?.agentId ? agentVersionLabel(saved, item.agentId) : undefined;
  const share = executors.find((e) => e.name === node.config.executor || (item?.agentId && e.id === item.agentId))?.shares[code];
  const out = graph.edges.filter((e) => e.from === node.id);
  const returns = isOutreach(node) ? (node.config.dispositions ?? item?.returns ?? []) : edgeOptions(node);
  const settings = Object.entries(node.config).filter(([k, v]) => v !== undefined && k !== "dispositions" && k !== "executor" && k !== "description");
  return (
    <Panel title={node.label} actions={<Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="space-y-3 text-[13px]">
        <p className="text-subtle">{node.config.description ?? item?.does}</p>
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Reads</p>
          <p>{item?.reads.join(", ") || "Nothing"}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Returns</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {returns.map((r) => (
              <li key={r} className="rounded-pill border border-border px-2 py-0.5 text-[12px]">{r}{out.some((e) => (e.label ?? "Default") === r) ? "" : " (default edge)"}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Executor and version</p>
          <p>{node.config.executor ?? "System"}{agent ? ` · Active version ${agent.no}` : ""}{share !== undefined ? ` · share in ${code}: ${share}%` : ""}</p>
          {isOutreach(node) && <p className="text-[12px] text-muted-foreground">Estimated cost per run {inr(estimatedCost(node))}</p>}
        </div>
        {agent?.data && (item?.agentId === "renewal-voice" || item?.agentId === "message") && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">{item.agentId === "message" ? "Templates" : "Script versions"}</p>
            <ul className="mt-1 space-y-0.5">
              {item.agentId === "message"
                ? agent.data.templates.slice(0, 6).map((t) => <li key={`${t.name}-${t.language}`}>{t.name} · {t.language} · v{agent.no}</li>)
                : agent.data.scripts.map((sc) => <li key={`${sc.product}-${sc.language}`}>{sc.product} · {sc.language} · v{agent.no}</li>)}
            </ul>
            <Link to="/persistency/agents/$id" params={{ id: item.agentId }} search={{ tab: "versions" }} className="text-[12px] text-primary hover:underline">Open the agent's versions</Link>
          </div>
        )}
        {settings.length > 0 && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Settings</p>
            <ul className="mt-1 space-y-0.5">
              {settings.map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2"><span className="text-subtle">{k}</span><span>{Array.isArray(v) ? v.join(", ") : String(v)}</span></li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Policies sitting here ({num(policies.length)})</p>
          <ul className="mt-1 max-h-56 space-y-0.5 overflow-y-auto">
            {policies.slice(0, 30).map((p) => (
              <li key={p.policyId}>
                <Link to="/persistency/policies/$id" params={{ id: p.policyId }} search={{ tab: "activity" }} className="text-primary hover:underline">{p.policyId}</Link>
                <span className="ml-2 text-subtle">{p.customerName}</span>
              </li>
            ))}
            {policies.length === 0 && <li className="text-muted-foreground">None right now.</li>}
          </ul>
        </div>
        {AGENT_META[item?.agentId ?? ""] && <p className="text-[12px] text-muted-foreground">Agent inputs: {AGENT_META[item!.agentId!]!.inputs.join(", ")}</p>}
      </div>
    </Panel>
  );
}

function ActivityTab({ code, versions, policies }: { code: string; versions: Version<WfGraph>[]; policies: Policy[] }) {
  const added = useWork((s) => s.activity);
  const rows = useMemo(() => {
    const out: (ActivityRow & { wfVersion?: number | undefined })[] = [];
    for (const list of Object.values(added)) for (const r of list) if (r.workflow === code) out.push(r);
    const sample = policies.slice(0, 400);
    for (const p of sample) for (const r of seedActivity(p)) if (r.workflow === code) out.push(r);
    return out.sort((a, b) => (a.at < b.at ? 1 : -1)).map((r) => ({ ...r, wfVersion: versionAt(versions, r.at) }));
  }, [added, policies, code, versions]);
  return (
    <DataGrid
      label="Workflow activity"
      rows={rows}
      rowKey={(r) => r.id}
      csvName={`${code}-activity.csv`}
      columns={[
        { id: "at", label: "Time", value: (r) => r.at, render: (r) => dateTime(r.at) },
        { id: "policy", label: "Policy", value: (r) => r.policyId, render: (r) => <Link to="/persistency/policies/$id" params={{ id: r.policyId }} search={{ tab: "activity" }} className="text-primary hover:underline">{r.policyId}</Link> },
        { id: "step", label: "Step", value: (r) => r.step },
        { id: "executor", label: "Executor", value: (r) => r.executor },
        { id: "result", label: "Result", value: (r) => r.result },
        { id: "rule", label: "Rule", value: (r) => r.ruleId ?? "" },
        { id: "version", label: "Workflow version", align: "right", value: (r) => r.wfVersion ?? 0, render: (r) => (r.wfVersion ? `v${r.wfVersion}` : "") },
      ]}
    />
  );
}

function VersionsTab({ code, list }: { code: string; list: Version<WfGraph>[] }) {
  const [picked, setPicked] = useState<number[]>(() => {
    const ir = list.find((v) => v.status === "In review");
    const act = list.find((v) => v.status === "Active");
    return ir && act ? [act.no, ir.no] : [];
  });
  const [compare, setCompare] = useState(false);
  const [restoreNo, setRestoreNo] = useState<number | null>(null);
  const restore = useWork((s) => s.restoreVersion);
  const user = useUser();
  const mayEdit = useCan("workflows.edit");
  const nav = useNavigate();
  const toggle = (no: number) => setPicked((p) => (p.includes(no) ? p.filter((x) => x !== no) : [...p.slice(-1), no]));
  const [a, b] = [...picked].sort((x, y) => x - y).map((no) => list.find((v) => v.no === no));
  const diff = useMemo(() => (a && b ? diffGraphs(a.data, b.data) : null), [a, b]);
  const marksA: Record<string, Mark> = {};
  const marksB: Record<string, Mark> = {};
  if (diff) {
    for (const n of diff.removed) marksA[n] = "removed";
    for (const n of diff.added) marksB[n] = "added";
    for (const n of diff.changed) {
      marksA[n] = "changed";
      marksB[n] = "changed";
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={picked.length !== 2} onClick={() => setCompare(true)}>Compare</Button>
        <span className="text-[12px] text-muted-foreground">Select two versions to compare.</span>
      </div>
      <div className="overflow-hidden rounded-card border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-card">
            <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              {["", "Version", "Author", "Time", "Change note", "Status", "Simulation", ""].map((h, i) => (
                <th key={i} className="border-b border-border px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...list].reverse().map((v) => {
              const sim = v.sims?.[0];
              return (
                <tr key={v.no} className="border-b border-border/60">
                  <td className="px-3 py-2"><input type="checkbox" aria-label={`Select version ${v.no}`} checked={picked.includes(v.no)} onChange={() => toggle(v.no)} className="accent-[var(--primary)]" /></td>
                  <td className="px-3 py-2 tabular">v{v.no}</td>
                  <td className="px-3 py-2">{v.author}</td>
                  <td className="px-3 py-2 tabular">{dateTime(v.at)}</td>
                  <td className="px-3 py-2 text-subtle">{v.note || "No note"}{v.returnReason ? ` · Returned: ${v.returnReason}` : ""}</td>
                  <td className="px-3 py-2"><StatusChip tone={versionTone(v.status)}>{v.status}</StatusChip></td>
                  <td className="px-3 py-2">{sim ? <StatusChip tone={sim.result === "Pass" ? "ok" : "risk"}>{sim.result} · {sim.scenario}</StatusChip> : <span className="text-muted-foreground">Not run</span>}</td>
                  <td className="px-3 py-2 text-right">{mayEdit && v.status !== "Draft" && <Button size="sm" variant="ghost" onClick={() => setRestoreNo(v.no)}>Restore</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog open={compare} onOpenChange={setCompare}>
        <DialogContent className="max-h-[92vh] max-w-[96vw] overflow-y-auto rounded-card border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold">{code}: version {a?.no} against version {b?.no}</DialogTitle>
          </DialogHeader>
          {a && b && diff && (
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-1 text-[12px] font-medium text-muted-foreground">Version {a.no} · {a.status}</p>
                  <CanvasBox graph={prepare(a.data)} marks={marksA} height={420} />
                </div>
                <div>
                  <p className="mb-1 text-[12px] font-medium text-muted-foreground">Version {b.no} · {b.status}</p>
                  <CanvasBox graph={prepare(b.data)} marks={marksB} height={420} />
                </div>
              </div>
              <ul className="space-y-1 text-[13px]">
                {diff.lines.length ? diff.lines.map((l, i) => <li key={i} className="rounded-input border border-border px-2 py-1">{l}</li>) : <li className="text-muted-foreground">No differences.</li>}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={restoreNo !== null}
        onOpenChange={(o) => !o && setRestoreNo(null)}
        title={`Restore version ${restoreNo ?? ""}`}
        body="A new Draft is created from this version and opens in the builder. The Active version keeps running until the draft is approved."
        confirmLabel="Restore"
        onConfirm={() => {
          if (restoreNo === null) return;
          const no = restore(`workflow:${code}`, restoreNo, user?.name ?? "User");
          toast.success(`Version ${restoreNo} restored as draft version ${no}`);
          nav({ to: "/persistency/workflows/$id/edit", params: { id: code } });
        }}
      />
    </div>
  );
}

function SettingsTab({ code, graph, stage, products, trigger }: { code: string; graph: WfGraph; stage: string; products: string[]; trigger: string }) {
  const executors = useWork((s) => s.executors);
  const shares = executors.filter((e) => (e.shares[code] ?? 0) > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Workflow">
        <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-muted-foreground">Code</dt><dd>{code}</dd>
          <dt className="text-muted-foreground">Stage</dt><dd>{stage}</dd>
          <dt className="text-muted-foreground">Products</dt><dd>{products.join(", ")}</dd>
          <dt className="text-muted-foreground">Trigger</dt><dd>{trigger}</dd>
          <dt className="text-muted-foreground">Steps</dt><dd>{graph.nodes.length} steps, {graph.edges.length} connections</dd>
          <dt className="text-muted-foreground">Executors</dt><dd>{executorsOf(graph).join(", ") || "None"}</dd>
          <dt className="text-muted-foreground">Approvers</dt><dd>Head of Persistency and Compliance and quality</dd>
        </dl>
      </Panel>
      <Panel title="Executor shares in Data files">
        {shares.length ? (
          <ul className="space-y-1 text-[13px]">
            {shares.map((e) => (
              <li key={e.id} className="flex justify-between"><span>{e.name} · {e.modes[code] ?? "Direct"}</span><span className="tabular">{e.shares[code]}%</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">No executor shares set for {code}.</p>
        )}
        <Link to="/persistency/data" search={{ tab: "executors" }} className="mt-2 inline-block text-[12px] text-primary hover:underline">Open Executors</Link>
        <NoteBanner className="mt-3">Shares change on the Executors page; a change of more than 10 points needs approval.</NoteBanner>
      </Panel>
    </div>
  );
}
