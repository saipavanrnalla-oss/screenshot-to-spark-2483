import { createFileRoute, Link } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { PauseCircle, Workflow as WorkflowIcon } from "lucide-react";
import { Chip, Eyebrow, PageHeader, StatusPill } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { NodeChip, NODE_KIND_HELP } from "@/components/persistency/node-chip";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { STAGE_COLUMNS, WORKFLOWS, type NodeKind } from "@/data/persistency";
import { usePersistencyStore, useAdapters, staleWorkflowsFor } from "@/store/persistency";
import { num, time } from "@/lib/format";

export const Route = createFileRoute("/persistency/workflows/")({
  beforeLoad: ({ search }) => gate("workflows", search),
  head: () => ({
    meta: [
      { title: "Workflows · Persistency · desible.ai" },
      { name: "description", content: "Eighteen persistency workflows from sourcing to revival, with the executor and tier of every step." },
      { property: "og:title", content: "Workflows · Persistency · desible.ai" },
      { property: "og:description", content: "Eighteen persistency workflows from sourcing to revival, with the executor and tier of every step." },
    ],
  }),
  component: WorkflowsPage,
});

const GROUPS = [...STAGE_COLUMNS, "Cross-cutting"] as const;

function WorkflowsPage() {
  const { scoped, product } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const killed = usePersistencyStore((s) => s.killedWorkflows);
  const killAll = usePersistencyStore((s) => s.killSwitchGlobal);
  const adapters = useAdapters();
  const stale = staleWorkflowsFor(adapters.filter((a) => a.stale).map((a) => a.id));
  const visible = WORKFLOWS.filter((w) => product === "All" || w.products.includes(product));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Workflows"
        title="18 workflows"
        description={product === "All" ? "Grouped by stage. Open one to see each step and how it runs." : `${visible.length} of 18 workflows apply to ${product}. Counts show ${product} policies only.`}
        tiers={["live-engine", "live-channels", "simulated"]}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-translucent px-4 py-2.5">
        <Eyebrow>How a step runs</Eyebrow>
        {(Object.keys(NODE_KIND_HELP) as NodeKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-subtle" title={NODE_KIND_HELP[k]}>
            <NodeChip kind={k} /> <span className="hidden xl:inline">{NODE_KIND_HELP[k]}</span>
          </span>
        ))}
      </div>

      {GROUPS.map((g) => {
        const list = visible.filter((w) => w.stage === g);
        if (!list.length) return null;
        return (
          <section key={g} className="space-y-3">
            <Eyebrow>{g}</Eyebrow>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((w) => {
                const paused = killAll || killed.includes(w.id);
                const isStale = stale.has(w.id);
                const last = stats.lastRun.get(w.id);
                return (
                  <Link
                    key={w.id}
                    to="/persistency/workflows/$id"
                    params={{ id: w.id }}
                    className="panel group flex flex-col gap-3 p-4 transition-colors hover:border-brand-tint-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-sm bg-brand-tint px-1.5 text-[11px] font-bold text-primary">{w.id}</span>
                          {w.hasCanvas && <WorkflowIcon className="size-3.5 text-muted-foreground" aria-label="Has a full canvas" />}
                        </div>
                        <h3 className="mt-1 text-[14px] font-bold text-foreground group-hover:text-primary">{w.name}</h3>
                      </div>
                      <TierBadge tiers={[w.tier]} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip active>{w.stage}</Chip>
                      {w.products.map((p) => <Chip key={p}>{p}</Chip>)}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-muted-foreground">Trigger</dt><dd className="text-subtle">{w.trigger}</dd>
                      <dt className="text-muted-foreground">Executor</dt><dd className="text-subtle">{w.executor}</dd>
                      <dt className="text-muted-foreground">Last run</dt><dd className="text-subtle tabular">{last ? `Today ${time(last, false)}` : "Not run this session"}</dd>
                      <dt className="text-muted-foreground">Policies in it now</dt><dd className="font-semibold text-foreground tabular">{num(stats.count.get(w.id) ?? 0)}</dd>
                    </dl>
                    {(paused || isStale) && (
                      <div className="flex flex-wrap gap-1.5">
                        {paused && <StatusPill status="failed"><PauseCircle className="size-3" /> Paused by kill switch</StatusPill>}
                        {isStale && <StatusPill status="attention">Paused for stale input</StatusPill>}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
