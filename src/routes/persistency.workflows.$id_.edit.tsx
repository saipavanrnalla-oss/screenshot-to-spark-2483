import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, LayoutGrid, Redo2, ShieldCheck, Trash2, Undo2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoteBanner, Panel } from "@/components/ds/primitives";
import { CanvasBox } from "@/components/r1/canvas-box";
import { ConfirmDialog } from "@/components/r1/confirm";
import { LeaveGuard } from "@/components/r1/edit-footer";
import { StatusChip } from "@/components/r1/status-chip";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { SimConsole } from "@/components/r1/wf-sim";
import { EXECUTOR_OPTIONS, workflowOptions } from "@/components/r1/rule-model";
import { addNode, connect, deleteNode, insertOnEdge, prepare, useWorkflowRows, wfVersions } from "@/components/r1/wf-model";
import { PALETTE, PALETTE_BY_TYPE, PREPARED_PROMPTS, generateFromPrompt, type NodeGroup, type WfGraph, type WfNode, type WfNodeConfig } from "@/data/persistency/r1/wf";
import { DISPOSITIONS } from "@/data/persistency/r1/common";
import { seedVersions, useWork } from "@/store/work";
import type { AgentConfig } from "@/data/persistency/r1/agents";
import type { Version } from "@/data/persistency/r1/types";
import { diffGraphs, edgeOptions, estimatedCost, isOutreach, layoutGraph, validateGraph } from "@/engine/workflow";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { inr, num } from "@/lib/format";
import { usePersistencyStore } from "@/store/persistency";

export const Route = createFileRoute("/persistency/workflows/$id_/edit")({
  beforeLoad: ({ search }) => gate("workflows", search),
  head: ({ params }) => ({
    meta: [
      { title: `Edit workflow ${params.id} · Workflows · desible.ai` },
      { name: "description", content: "Workflow builder: palette, canvas, inspector, prompt builder and simulation." },
      { property: "og:title", content: `Edit workflow ${params.id} · Workflows · desible.ai` },
      { property: "og:description", content: "Workflow builder: palette, canvas, inspector, prompt builder and simulation." },
    ],
  }),
  component: BuilderPage,
});

const GROUPS: NodeGroup[] = ["Triggers", "Checks", "Decisions", "Agents", "Vendors and files", "People", "Wait", "Outcomes"];
const AUTO = new Set(["check.paid", "check.hold", "check.contact"]);
const FIELDS = ["Channel", "Payment method", "Product", "Cohort", "Mandate status", "Customer reply", "Ticket size"];
const GENERATED_NOTE = "Generated from a description";

function BuilderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const user = useUser();
  const author = user?.name ?? "User";
  const mayEdit = useCan("workflows.edit");
  const rows = useWorkflowRows();
  const row = rows.find((r) => r.code === id);
  const saved = useWork((s) => s.versions);
  const list = useMemo(() => wfVersions(saved, id), [saved, id]);
  const last = list[list.length - 1];
  const draft = last?.status === "Draft" ? last : undefined;
  const activeV = list.find((v) => v.status === "Active");
  const saveDraft = useWork((s) => s.saveDraft);
  const attachSim = useWork((s) => s.attachSim);
  const submit = useWork((s) => s.submit);
  const renameWorkflow = useWork((s) => s.renameWorkflow);
  const createWorkflow = useWork((s) => s.createWorkflow);
  const executors = useWork((s) => s.executors);
  const created = useWork((s) => s.newWorkflows);
  const rules = usePersistencyStore((s) => s.rules);
  const { scoped } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const inIt = useMemo(() => scoped.filter((p) => stats.decisions.get(p.policyId)?.workflowId === id), [scoped, stats.decisions, id]);

  const base = useMemo(() => (draft ? prepare(draft.data) : undefined), [draft]);
  const [graph, setGraph] = useState<WfGraph | undefined>(base);
  const [past, setPast] = useState<WfGraph[]>([]);
  const [future, setFuture] = useState<WfGraph[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [mode, setMode] = useState<"visual" | "prompt">("visual");
  const [prompt, setPrompt] = useState("");
  const [why, setWhy] = useState<{ node: string; reason: string }[] | null>(null);
  const [promptFailed, setPromptFailed] = useState(false);
  const [generated, setGenerated] = useState(draft?.note === GENERATED_NOTE);
  const [simOpen, setSimOpen] = useState(false);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [insertEdge, setInsertEdge] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(row?.name ?? "");
  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");
  const [effective, setEffective] = useState("2026-11-01");

  useEffect(() => {
    setGraph(base);
    setPast([]);
    setFuture([]);
  }, [base]);

  const commit = useCallback(
    (g: WfGraph) => {
      if (!graph) return;
      setPast((p) => [...p.slice(-49), graph]);
      setFuture([]);
      setGraph(g);
    },
    [graph],
  );
  const undo = useCallback(() => {
    if (!graph || !past.length) return;
    setFuture((f) => [graph, ...f]);
    setGraph(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }, [graph, past]);
  const redo = useCallback(() => {
    if (!graph || !future.length) return;
    setPast((p) => [...p, graph]);
    setGraph(future[0]);
    setFuture((f) => f.slice(1));
  }, [graph, future]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const problems = useMemo(() => (graph ? validateGraph(graph) : []), [graph]);
  const dirty = !!graph && !!base && JSON.stringify(graph) !== JSON.stringify(base);
  const latestSim = draft?.sims?.[0];
  const simFresh = !!latestSim && !dirty;

  if (!row) {
    return <p className="text-[13px] text-muted-foreground">There is no workflow called {id}.</p>;
  }
  if (!draft || !graph) {
    const ir = list.find((v) => v.status === "In review");
    return (
      <div className="mx-auto max-w-[900px] space-y-4">
        <Link to="/persistency/workflows/$id" params={{ id }} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> {id} {row.name}</Link>
        <NoteBanner>{ir ? `Version ${ir.no} is in review. The builder opens again after a decision.` : "There is no draft. An Active version cannot be edited; use Edit on the workflow page to start the next version."}</NoteBanner>
      </div>
    );
  }
  const locked = !mayEdit;
  const node = graph.nodes.find((n) => n.id === sel);
  const edge = graph.edges.find((e) => e.id === selEdge);

  const setNode = (nid: string, patch: Partial<WfNode>, cfg?: Partial<WfNodeConfig>) => commit({ ...graph, nodes: graph.nodes.map((n) => (n.id === nid ? { ...n, ...patch, config: { ...n.config, ...cfg } } : n)) });

  const add = (type: string, x?: number, y?: number) => {
    if (locked) return;
    const item = PALETTE_BY_TYPE[type];
    if (!item || item.disabled) return;
    const r = addNode(graph, type, x, y);
    let g = r.graph;
    if (x === undefined && node) {
      const nn = g.nodes.find((n) => n.id === r.id)!;
      g = { ...g, nodes: g.nodes.map((n) => (n.id === r.id ? { ...nn, x: node.x + 280, y: node.y + 100 } : n)) };
      g = connect(g, node.id, r.id);
    }
    commit(g);
    setSel(r.id);
    setSelEdge(null);
  };

  const doSave = (): number => {
    const no = saveDraft(`workflow:${id}`, graph, author, generated ? GENERATED_NOTE : draft.note || "Workflow change");
    toast.success(`Saved draft version ${no}`);
    return no;
  };

  const tryPublish = () => {
    const problemsNow = validateGraph(graph);
    if (problemsNow.length) return void toast.error("Fix the problems in the footer first.");
    if (generated && !latestSim) return void toast.error("A generated draft needs a simulation run before it can be submitted.");
    if (dirty) doSave();
    setPublishOpen(true);
  };

  const costMap = Object.fromEntries(executors.map((e) => [e.name, e.costs.task]));

  return (
    <div className="mx-auto max-w-[1800px] space-y-3">
      <LeaveGuard dirty={dirty} />
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/persistency/workflows/$id" params={{ id }} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> {id}</Link>
        <h1 className="text-[20px] font-semibold text-foreground">{row.name}</h1>
        <StatusChip tone="neutral">Draft v{draft.no}</StatusChip>
        {draft.returnReason && <StatusChip tone="risk">Returned</StatusChip>}
      </div>
      {draft.returnReason && <NoteBanner tone="attention">Returned: {draft.returnReason}</NoteBanner>}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-card px-3 py-2">
        <div role="tablist" aria-label="Builder mode" className="flex rounded-input border border-border p-0.5">
          {(["visual", "prompt"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => setMode(m)} className={`rounded-sm px-2.5 py-1 text-[12px] font-medium ${mode === m ? "bg-primary text-primary-foreground" : "text-subtle"}`}>
              {m === "visual" ? "Visual builder" : "Prompt builder"}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={undo} disabled={!past.length} aria-label="Undo"><Undo2 /></Button>
        <Button size="sm" variant="ghost" onClick={redo} disabled={!future.length} aria-label="Redo"><Redo2 /></Button>
        <Button size="sm" variant="ghost" onClick={() => commit(layoutGraph(graph))}><LayoutGrid /> Auto-layout</Button>
        <span className="mx-1 h-5 w-px bg-border" />
        {!locked && <Button size="sm" variant="ghost" onClick={() => { setNewName(row.name); setRenameOpen(true); }}>Rename</Button>}
        {!locked && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const code = createWorkflow(`${row.name} copy`, row.stage, author);
              saveDraft(`workflow:${code}`, structuredClone(graph), author, `Duplicated from ${id}`);
              toast.success(`${code} created as a draft`);
              navigate({ to: "/persistency/workflows/$id/edit", params: { id: code } });
            }}
          >
            Duplicate
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {!locked && <Button size="sm" variant="outline" onClick={doSave} disabled={!dirty}>Save draft</Button>}
          <Button size="sm" variant="outline" onClick={() => setSimOpen(true)}>Simulate</Button>
          {!locked && <Button size="sm" onClick={tryPublish}>Submit for review</Button>}
        </div>
      </div>

      {mode === "prompt" ? (
        <Panel title="Describe the workflow">
          <textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setPromptFailed(false); }} rows={4} aria-label="Describe the workflow" placeholder="Describe the workflow" className="block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px]" />
          <div className="mt-2 flex flex-wrap gap-2">
            {PREPARED_PROMPTS.map((p, i) => (
              <Button key={i} size="sm" variant="ghost" onClick={() => { setPrompt(p); setPromptFailed(false); }}>Use prepared prompt {i + 1}</Button>
            ))}
            <Button
              size="sm"
              className="ml-auto"
              disabled={!prompt.trim() || locked}
              onClick={() => {
                const r = generateFromPrompt(prompt);
                if (!r) {
                  setPromptFailed(true);
                  setWhy(null);
                  return;
                }
                commit(layoutGraph(r.graph));
                setWhy(r.why);
                setGenerated(true);
                toast.success(`Generated ${r.graph.nodes.length} steps as a draft`);
              }}
            >
              <Wand2 /> Generate
            </Button>
          </div>
          {promptFailed && (
            <NoteBanner tone="attention" className="mt-3">
              Describe it with the Visual builder.{" "}
              <Button size="sm" variant="outline" className="ml-2" onClick={() => setMode("visual")}>Switch to Visual builder</Button>
            </NoteBanner>
          )}
          {why && (
            <div className="mt-4 space-y-2">
              <p className="text-[13px] font-semibold">Steps chosen and why</p>
              <ul className="space-y-1 text-[13px]">
                {why.map((w) => (
                  <li key={w.node}><span className="font-medium text-foreground">{w.node}</span>: <span className="text-subtle">{w.reason}</span></li>
                ))}
              </ul>
              <p className="text-[12px] text-muted-foreground">This draft needs a simulation run before it can be submitted.</p>
              <Button size="sm" onClick={() => setMode("visual")}>Open in Visual builder</Button>
            </div>
          )}
        </Panel>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[230px_1fr_340px]">
          <aside className="max-h-[640px] space-y-3 overflow-y-auto rounded-card border border-border bg-card p-3" aria-label="Palette">
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{g}</p>
                <ul className="mt-1 space-y-1">
                  {PALETTE.filter((p) => p.group === g).map((p) => (
                    <li key={p.type}>
                      <button
                        type="button"
                        disabled={p.disabled || locked}
                        draggable={!p.disabled && !locked}
                        onDragStart={(e) => e.dataTransfer.setData("application/wf-node", p.type)}
                        onClick={() => add(p.type)}
                        title={p.disabled ? "Not enabled" : p.does}
                        className="flex w-full items-center justify-between gap-2 rounded-input border border-border px-2 py-1 text-left text-[12px] text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span>{p.label}</span>
                        {p.disabled && <span className="text-[10px] text-muted-foreground">Not enabled</span>}
                        {AUTO.has(p.type) && <span className="text-[10px] text-muted-foreground">Auto</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
          <div className="min-w-0">
            <CanvasBox
              graph={graph}
              editable={!locked}
              height={640}
              selectedId={sel}
              selectedEdge={selEdge}
              activeId={activeNode}
              onSelectNode={(n) => { setSel(n); setSelEdge(null); }}
              onSelectEdge={(e) => { setSelEdge(e); setSel(null); }}
              onMove={(nid, x, y) => setGraph((g) => (g ? { ...g, nodes: g.nodes.map((n) => (n.id === nid ? { ...n, x, y } : n)) } : g))}
              onConnect={(a, b) => commit(connect(graph, a, b))}
              onInsert={(eid) => setInsertEdge(eid)}
              onDropType={(t, x, y) => add(t, x, y)}
            />
          </div>
          <aside className="max-h-[640px] overflow-y-auto rounded-card border border-border bg-card p-3" aria-label="Inspector">
            {node ? (
              <NodeInspector
                code={id}
                node={node}
                graph={graph}
                locked={locked}
                rules={rules.map((r) => ({ id: r.id, name: r.name }))}
                workflows={workflowOptions(created)}
                costMap={costMap}
                shareInFiles={executors.find((e) => e.name === node.config.executor || e.id === PALETTE_BY_TYPE[node.type]?.agentId)?.shares[id]}
                saved={saved}
                onChange={(patch, cfg) => setNode(node.id, patch, cfg)}
                onEdgeLabel={(eid, label) => commit({ ...graph, edges: graph.edges.map((e) => (e.id === eid ? { ...e, label } : e)) })}
                onEdgeDelete={(eid) => commit({ ...graph, edges: graph.edges.filter((e) => e.id !== eid) })}
                onDelete={() => setToDelete(node.id)}
              />
            ) : edge ? (
              <div className="space-y-3 text-[13px]">
                <p className="text-[14px] font-semibold">Connection</p>
                <p className="text-subtle">{graph.nodes.find((n) => n.id === edge.from)?.label} to {graph.nodes.find((n) => n.id === edge.to)?.label}</p>
                <label className="block text-[12px] font-medium text-muted-foreground">
                  Result that follows this connection
                  <select disabled={locked} value={edge.label ?? "Default"} onChange={(e) => commit({ ...graph, edges: graph.edges.map((x) => (x.id === edge.id ? { ...x, label: e.target.value === "Default" ? undefined : e.target.value } : x)) })} className={`${selectCls} mt-1 w-full`}>
                    {[...new Set([...edgeOptions(graph.nodes.find((n) => n.id === edge.from)!), "Default"])].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
                {!locked && <Button size="sm" variant="outline" onClick={() => { commit({ ...graph, edges: graph.edges.filter((e) => e.id !== edge.id) }); setSelEdge(null); }}><Trash2 /> Delete connection</Button>}
              </div>
            ) : (
              <div className="space-y-2 text-[13px] text-subtle">
                <p className="text-[14px] font-semibold text-foreground">Inspector</p>
                <p>Click a step to edit it, or a connection to change the result it follows.</p>
                <p>Click or drag a palette item to add it. Drag from a step's right dot to another step's left dot to connect. Hover a connection to insert a step.</p>
                <p>Paid since the list, On hold and Contact policy run before every call or message and cannot be removed.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {simOpen && (
        <SimConsole
          graph={graph}
          policies={inIt}
          by={author}
          onActive={setActiveNode}
          onStored={(r) => {
            if (dirty) saveDraft(`workflow:${id}`, graph, author, generated ? GENERATED_NOTE : draft.note || "Workflow change");
            attachSim(`workflow:${id}`, r);
          }}
          onClose={() => setSimOpen(false)}
        />
      )}

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-1 py-2 text-[12px] backdrop-blur">
        <span className="text-muted-foreground tabular">{num(graph.nodes.length)} steps · {num(graph.edges.length)} connections</span>
        {problems.length === 0 ? (
          <span className="flex items-center gap-1 text-ok"><ShieldCheck className="size-3.5" /> Guardrails present</span>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {problems.slice(0, 4).map((p, i) => (
              <li key={i}>
                <button type="button" onClick={() => p.nodeId && setSel(p.nodeId)} className="rounded-pill border border-attention px-2 py-0.5 text-attention">{p.text}</button>
              </li>
            ))}
            {problems.length > 4 && <li className="text-attention">and {problems.length - 4} more</li>}
          </ul>
        )}
        <span className="ml-auto text-muted-foreground">{dirty ? "Unsaved changes" : "Saved"}{latestSim ? ` · last simulation ${latestSim.result}` : " · no simulation run yet"}</span>
      </div>

      <Dialog open={!!insertEdge} onOpenChange={(o) => !o && setInsertEdge(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto rounded-card border-border bg-card">
          <DialogHeader><DialogTitle className="text-[14px] font-semibold">Insert a step</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-1.5">
            {PALETTE.filter((p) => !p.disabled && !p.type.startsWith("trigger.") && !p.type.startsWith("outcome.")).map((p) => (
              <button
                key={p.type}
                type="button"
                className="rounded-input border border-border px-2 py-1 text-left text-[12px] hover:border-primary"
                onClick={() => {
                  if (!insertEdge) return;
                  const r = insertOnEdge(graph, insertEdge, p.type);
                  commit(r.graph);
                  setSel(r.id);
                  setInsertEdge(null);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${graph.nodes.find((n) => n.id === toDelete)?.label ?? "step"}`}
        body="The connections on either side are joined so the path stays whole."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!toDelete) return;
          commit(deleteNode(graph, toDelete));
          setSel(null);
        }}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md rounded-card border-border bg-card">
          <DialogHeader><DialogTitle className="text-[14px] font-semibold">Rename workflow</DialogTitle></DialogHeader>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} aria-label="Workflow name" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button disabled={!newName.trim()} onClick={() => { renameWorkflow(id, newName.trim()); setRenameOpen(false); toast.success("Renamed"); }}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-lg rounded-card border-border bg-card">
          <DialogHeader><DialogTitle className="text-[14px] font-semibold">Submit {id} version {draft.no} for review</DialogTitle></DialogHeader>
          <label className="block text-[12px] font-medium text-muted-foreground">
            Change note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Change note" className="mt-1 block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px]" />
          </label>
          <label className="block text-[12px] font-medium text-muted-foreground">
            Effective date
            <input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <div className="text-[13px]">
            <p className="text-[12px] font-medium text-muted-foreground">Latest simulation</p>
            {latestSim ? <p><StatusChip tone={latestSim.result === "Pass" ? "ok" : "risk"}>{latestSim.result}</StatusChip> <span className="ml-1 text-subtle">{latestSim.scenario} · {latestSim.steps} steps · {latestSim.policyId}</span></p> : <p className="text-attention">No simulation run yet. Approvers need a passing simulation to approve.</p>}
            {latestSim && !simFresh && <p className="text-[12px] text-muted-foreground">Run again if you changed the canvas since.</p>}
          </div>
          <div className="text-[13px]">
            <p className="text-[12px] font-medium text-muted-foreground">Approvers</p>
            <p>Head of Persistency and Compliance and quality</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button
              disabled={!note.trim() || latestSim?.result !== "Pass"}
              onClick={() => {
                const d = activeV ? diffGraphs(activeV.data, graph) : { lines: ["New workflow"] };
                submit({
                  kind: "workflow",
                  objectId: id,
                  objectName: `${id} ${row.name}`,
                  versionNo: draft.no,
                  requestedBy: author,
                  summary: note.trim(),
                  reach: inIt.length,
                  diff: d.lines.length ? d.lines : ["No changes to steps"],
                  conflicts: [],
                  sim: latestSim ? { result: latestSim.result, reason: latestSim.reason, steps: latestSim.steps } : undefined,
                  needs: ["head"],
                  effectiveFrom: effective,
                });
                setPublishOpen(false);
                toast.success(`Version ${draft.no} sent for review`, { description: "Waiting for Head of Persistency and Compliance and quality." });
                navigate({ to: "/persistency/workflows/$id", params: { id }, search: { tab: "versions" } });
              }}
            >
              Submit for review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NodeInspector({
  code,
  node,
  graph,
  locked,
  rules,
  workflows,
  costMap,
  shareInFiles,
  saved,
  onChange,
  onEdgeLabel,
  onEdgeDelete,
  onDelete,
}: {
  code: string;
  node: WfNode;
  graph: WfGraph;
  locked: boolean;
  rules: { id: string; name: string }[];
  workflows: { code: string; label: string }[];
  costMap: Record<string, number>;
  shareInFiles?: number | undefined;
  saved: Record<string, Version<unknown>[]>;
  onChange: (patch: Partial<WfNode>, cfg?: Partial<WfNodeConfig>) => void;
  onEdgeLabel: (id: string, label: string | undefined) => void;
  onEdgeDelete: (id: string) => void;
  onDelete: () => void;
}) {
  const item = PALETTE_BY_TYPE[node.type];
  const outreach = isOutreach(node);
  const c = node.config;
  const agentId = item?.agentId;
  const agentList = agentId ? ((saved[`agent:${agentId}`] ?? seedVersions(`agent:${agentId}`)) as Version<AgentConfig>[]) : [];
  const agentActive = agentList.find((v) => v.status === "Active");
  const out = graph.edges.filter((e) => e.from === node.id);
  const opts = [...new Set([...edgeOptions(node), "Default"])];
  const declared = outreach ? (c.dispositions ?? item?.returns ?? []) : [];
  const used = new Set(out.map((e) => e.label ?? "Default"));
  const missing = outreach && !used.has("Default") ? declared.filter((d) => d !== "Default" && !used.has(d)) : [];
  const [field, op, ...rest] = (c.condition ?? "Channel is ").split(" ");
  const condField = FIELDS.find((f) => (c.condition ?? "").startsWith(f)) ?? field ?? "Channel";
  const condRest = (c.condition ?? "").slice(condField.length).trim();
  const condOp = condRest.startsWith("is not") ? "is not" : "is";
  const condValue = condRest.replace(/^is not\s*|^is\s*/, "") || rest.join(" ");
  void op;
  const lab = (t: string) => <span className="block text-[12px] font-medium text-muted-foreground">{t}</span>;
  const number = (v: number | undefined, f: (n: number | undefined) => void, label: string) => (
    <label className="block">
      {lab(label)}
      <input disabled={locked} type="number" min={0} value={v ?? ""} onChange={(e) => f(e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))} className={`${inputCls} mt-1 tabular`} />
    </label>
  );
  return (
    <div className="space-y-3 text-[13px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{item?.group} · {item?.label}</p>
        {!locked && <Button size="icon" variant="ghost" className="size-7" aria-label="Delete step" onClick={onDelete}><Trash2 /></Button>}
      </div>
      <label className="block">{lab("Name")}<input disabled={locked} value={node.label} onChange={(e) => onChange({ label: e.target.value })} className={`${inputCls} mt-1`} aria-label="Step name" /></label>
      <label className="block">{lab("Description")}<input disabled={locked} value={c.description ?? ""} placeholder={item?.does} onChange={(e) => onChange({}, { description: e.target.value || undefined })} className={`${inputCls} mt-1`} /></label>
      {(outreach || node.type.startsWith("people.") || node.type.startsWith("agent.")) && (
        <label className="block">
          {lab("Executor")}
          <select disabled={locked} value={c.executor ?? ""} onChange={(e) => onChange({}, { executor: e.target.value })} className={`${selectCls} mt-1 w-full`} aria-label="Executor">
            {[...new Set([c.executor ?? "", ...EXECUTOR_OPTIONS, "Telecaller", "Team lead", "Underwriting", "Remittance"])].filter(Boolean).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          {agentActive && <span className="mt-1 block text-[12px] text-muted-foreground">{item?.label}: Active version {agentActive.no}</span>}
        </label>
      )}
      {outreach && (
        <label className="block">
          {lab("Share of eligible policies (%)")}
          <input disabled={locked} type="number" min={0} max={100} value={c.share ?? ""} onChange={(e) => onChange({}, { share: e.target.value === "" ? undefined : Math.min(100, Math.max(0, Number(e.target.value))) })} className={`${inputCls} mt-1 tabular`} aria-label="Share" />
          <span className="mt-1 block text-[12px] text-muted-foreground">Matching share in Data files: {shareInFiles !== undefined ? `${shareInFiles}% for ${code}` : "none set"}</span>
        </label>
      )}
      <div>{lab("Inputs read")}<p className="text-subtle">{item?.reads.join(", ") || "Nothing"}</p></div>
      {outreach ? (
        <div>
          {lab("Results returned (each becomes a connection)")}
          <div className="mt-1 flex flex-wrap gap-1">
            {(item?.returns ?? DISPOSITIONS).map((d) => (
              <button key={d} type="button" disabled={locked} onClick={() => onChange({}, { dispositions: declared.includes(d) ? declared.filter((x) => x !== d) : [...declared, d] })} className={`rounded-pill border px-2 py-0.5 text-[11px] ${declared.includes(d) ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>{lab("Outputs returned")}<p className="text-subtle">{item?.returns.join(", ") || "Nothing"}</p></div>
      )}
      {(node.type === "agent.voice" || node.type === "agent.message" || node.type === "people.telecaller") && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">{lab(node.type === "agent.message" ? "Template" : "Script")}<input disabled={locked} value={c.script ?? ""} onChange={(e) => onChange({}, { script: e.target.value || undefined })} className={`${inputCls} mt-1`} /></label>
          <label className="block">{lab("Language")}<input disabled={locked} value={c.language ?? ""} placeholder="Customer's language" onChange={(e) => onChange({}, { language: e.target.value || undefined })} className={`${inputCls} mt-1`} /></label>
        </div>
      )}
      {outreach && (
        <>
          <label className="block">{lab("Allowed offers (comma separated)")}<input disabled={locked} value={(c.offers ?? []).join(", ")} onChange={(e) => onChange({}, { offers: e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined })} className={`${inputCls} mt-1`} /></label>
          <div className="grid grid-cols-3 gap-2">
            {number(c.retries, (v) => onChange({}, { retries: v }), "Retries")}
            {number(c.gapDays, (v) => onChange({}, { gapDays: v }), "Gap (days)")}
            {number(c.deadlineHours, (v) => onChange({}, { deadlineHours: v }), "Deadline (h)")}
          </div>
          <label className="block">
            {lab("On timeout")}
            <select disabled={locked} value={c.onTimeout ?? "Retry"} onChange={(e) => onChange({}, { onTimeout: e.target.value as WfNodeConfig["onTimeout"] })} className={`${selectCls} mt-1 w-full`}>
              {["Retry", "Move to another executor", "Send to team lead"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <p className="text-[12px] text-muted-foreground">Estimated cost per run {inr(estimatedCost(node, costMap))}</p>
        </>
      )}
      {node.type === "decision.field" && (
        <div>
          {lab("Condition")}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <select disabled={locked} value={condField} onChange={(e) => onChange({}, { condition: `${e.target.value} ${condOp} ${condValue}`.trim() })} className={selectCls} aria-label="Field">
              {FIELDS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <select disabled={locked} value={condOp} onChange={(e) => onChange({}, { condition: `${condField} ${e.target.value} ${condValue}`.trim() })} className={selectCls} aria-label="Condition operator">
              <option>is</option>
              <option>is not</option>
            </select>
            <input disabled={locked} value={condValue} onChange={(e) => onChange({}, { condition: `${condField} ${condOp} ${e.target.value}` })} className={`${inputCls} w-36`} aria-label="Condition value" />
          </div>
        </div>
      )}
      {node.type === "decision.rule" && (
        <label className="block">
          {lab("Rule")}
          <select disabled={locked} value={c.ruleId ?? ""} onChange={(e) => onChange({}, { ruleId: e.target.value })} className={`${selectCls} mt-1 w-full`}>
            <option value="">Choose a rule</option>
            {rules.map((r) => <option key={r.id} value={r.id}>{r.id} {r.name}</option>)}
          </select>
        </label>
      )}
      {(node.type === "wait.days" || node.type === "trigger.due") && number(c.days, (v) => onChange(node.type === "wait.days" && v !== undefined ? { label: `Wait ${v} day${v === 1 ? "" : "s"}` } : {}, { days: v }), node.type === "wait.days" ? "Days to wait" : "Days before due (N)")}
      {node.type === "outcome.routed" && (
        <label className="block">
          {lab("Moves to workflow")}
          <select disabled={locked} value={c.workflow ?? ""} onChange={(e) => { const w = workflows.find((x) => x.code === e.target.value); onChange(w ? { label: `Routed to ${w.label}` } : {}, { workflow: e.target.value || undefined }); }} className={`${selectCls} mt-1 w-full`} aria-label="Moves to workflow">
            <option value="">Choose a workflow</option>
            {workflows.map((w) => <option key={w.code} value={w.code}>{w.label}</option>)}
          </select>
        </label>
      )}
      {!node.type.startsWith("outcome.") && (
        <div>
          {lab("Connections out")}
          <ul className="mt-1 space-y-1">
            {out.map((e) => (
              <li key={e.id} className="flex items-center gap-1">
                <select disabled={locked} value={e.label ?? "Default"} onChange={(ev) => onEdgeLabel(e.id, ev.target.value === "Default" ? undefined : ev.target.value)} className={`${selectCls} min-w-0 flex-1`} aria-label="Connection result">
                  {opts.map((o) => <option key={o}>{o}</option>)}
                </select>
                <span className="truncate text-[12px] text-subtle">to {graph.nodes.find((n) => n.id === e.to)?.label}</span>
                {!locked && <Button size="icon" variant="ghost" className="size-6" aria-label="Delete connection" onClick={() => onEdgeDelete(e.id)}><Trash2 /></Button>}
              </li>
            ))}
            {out.length === 0 && <li className="text-[12px] text-attention">No connection yet. Drag from the right dot.</li>}
          </ul>
          {missing.length > 0 && <p className="mt-1 text-[12px] text-attention">No connection for: {missing.join(", ")}. Connect them or add a Default connection.</p>}
        </div>
      )}
    </div>
  );
}
