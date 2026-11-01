import { createFileRoute, Link } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Chip, EmptyState, Eyebrow, PageHeader, Panel, StatusPill } from "@/components/ds/primitives";
import { NodeChip, NODE_KIND_HELP } from "@/components/persistency/node-chip";
import { SendTestButton } from "@/components/persistency/send-test";
import { PolicyTable } from "@/components/persistency/policy-table";
import { PolicyDrawer } from "@/components/persistency/policy-drawer";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { WORKFLOW_GRAPHS, WORKFLOW_STEPS, workflowById, type FlowNodeDef } from "@/data/persistency";
import { useAdapters, usePersistencyStore, staleWorkflowsFor } from "@/store/persistency";
import { num } from "@/lib/format";

const WorkflowCanvas = lazy(() => import("@/components/persistency/workflow-canvas"));

export const Route = createFileRoute("/persistency/workflows/$id")({
  beforeLoad: ({ search }) => gate("workflows", search),
  head: ({ params }) => {
    const wf = workflowById(params.id);
    const title = wf ? `${wf.id} ${wf.name} · Workflows · desible.ai` : "Workflow not found · desible.ai";
    const description = wf ? `${wf.name}: trigger, steps, executor and tier.` : "Persistency workflow detail.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: WorkflowDetail,
});

function WorkflowDetail() {
  const { id } = Route.useParams();
  const wf = workflowById(id);
  const { scoped } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const killed = usePersistencyStore((s) => s.killedWorkflows);
  const killAll = usePersistencyStore((s) => s.killSwitchGlobal);
  const adapters = useAdapters();
  const [node, setNode] = useState<FlowNodeDef | null>(null);
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);

  const inIt = useMemo(() => scoped.filter((p) => stats.decisions.get(p.policyId)?.workflowId === id), [scoped, stats.decisions, id]);

  if (!wf) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4">
        <PageHeader eyebrow="Workflows" title="Workflow not found" tiers={["live-engine"]} />
        <EmptyState title={`There is no workflow called ${id}.`} action={<Link to="/persistency/workflows" className="text-xs font-semibold text-primary hover:underline">Back to all 18 workflows</Link>} />
      </div>
    );
  }

  const graph = WORKFLOW_GRAPHS[wf.id];
  const steps = WORKFLOW_STEPS[wf.id] ?? [];
  const paused = killAll || killed.includes(wf.id);
  const stale = staleWorkflowsFor(adapters.filter((a) => a.stale).map((a) => a.id)).has(wf.id);
  const staleFile = adapters.find((a) => a.stale && a.feeds.includes(wf.id));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Link to="/persistency/workflows" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All workflows
      </Link>
      <PageHeader
        eyebrow={`Workflow ${wf.id} · ${wf.stage}`}
        title={wf.name}
        description={`Trigger: ${wf.trigger}. Executor: ${wf.executor}.`}
        tiers={[wf.tier]}
        actions={<div className="flex flex-wrap gap-1.5">{wf.products.map((p) => <Chip key={p}>{p}</Chip>)}</div>}
      />

      {(paused || stale) && (
        <div className="flex flex-wrap gap-2">
          {paused && <StatusPill status="failed">Paused by kill switch. Decisions are logged, nothing is sent.</StatusPill>}
          {stale && staleFile && <StatusPill status="attention">Paused for stale input: {staleFile.name} last arrived {staleFile.lastReceived}</StatusPill>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel accent-left px-4 py-3"><div className="stat-number">{num(inIt.length)}</div><div className="stat-label">policies in it now</div></div>
        <div className="panel accent-left px-4 py-3"><div className="stat-number">{num(stats.cancelled.get(wf.id) ?? 0)}</div><div className="stat-label">actions cancelled (paid meanwhile, stale input or kill switch)</div></div>
        <div className="panel accent-left px-4 py-3"><div className="stat-number">{graph ? graph.nodes.length : steps.length}</div><div className="stat-label">steps</div></div>
      </div>

      {graph ? (
        <Panel eyebrow="Canvas" title="Every step and branch" tiers={[wf.tier]} bodyClassName="p-3">
          <ClientOnly fallback={<div className="h-[520px] rounded-card border border-border" />}>
            <Suspense fallback={<div className="h-[520px] rounded-card border border-border" />}>
              <WorkflowCanvas graph={graph} selectedId={node?.id ?? null} onSelect={(nid) => setNode(graph.nodes.find((n) => n.id === nid) ?? null)} />
            </Suspense>
          </ClientOnly>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">Click a step to see the configuration it reads. Drag to pan, scroll to zoom.</p>
        </Panel>
      ) : (
        <Panel eyebrow="Steps" title="Read-only step list" tiers={[wf.tier]}>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3 rounded-input border border-border bg-surface-translucent px-3 py-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-tint-border text-[11px] font-bold text-primary">{i + 1}</span>
                <NodeChip kind={s.kind} />
                <span className="text-[13px] text-foreground">{s.label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground">A full canvas is built for W1, R2, R4, L2, L3 and X1. This workflow runs the same engine.</p>
        </Panel>
      )}

      <Panel eyebrow="Policies" title={`In ${wf.id} now`} tiers={["live-engine"]}>
        <PolicyTable policies={inIt} onOpen={setOpenPolicy} emptyTitle={`No policies in ${wf.id} right now for this product filter.`} />
      </Panel>

      <Sheet open={!!node} onOpenChange={(o) => !o && setNode(null)}>
        <SheetContent side="right" className="w-full border-border bg-background sm:max-w-[480px]">
          {node && (
            <>
              <SheetHeader className="text-left">
                <Eyebrow>Step in {wf.id}</Eyebrow>
                <SheetTitle className="text-xl font-extrabold text-foreground">{node.label}</SheetTitle>
                <SheetDescription className="text-sm text-subtle">{node.detail}</SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-5">
                <div className="flex items-center gap-2">
                  <NodeChip kind={node.kind} />
                  <span className="text-xs text-subtle">{NODE_KIND_HELP[node.kind]}</span>
                </div>
                <section>
                  <Eyebrow>Configuration it reads</Eyebrow>
                  <ul className="mt-2 space-y-1.5">
                    {node.reads.map((r) => (
                      <li key={r} className="flex items-center gap-2 text-[13px] text-foreground"><FileText className="size-3.5 text-muted-foreground" /> {r}</li>
                    ))}
                  </ul>
                  <Link to="/persistency/rules" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">Open Configuration</Link>
                </section>
                {node.liveChannel && (
                  <section className="space-y-2">
                    <Eyebrow>Live channels</Eyebrow>
                    <SendTestButton what={`${wf.id} step: ${node.label}`} />
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <PolicyDrawer policyId={openPolicy} onClose={() => setOpenPolicy(null)} />
    </div>
  );
}
