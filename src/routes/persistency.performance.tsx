import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SegmentedControl } from "@/components/ds/primitives";
import { CanvasBox } from "@/components/r1/canvas-box";
import { Kpi } from "@/components/r1/kpi";
import { selectCls } from "@/components/r1/tabs";
import { PERIODS, PERIOD_FACTOR, computeFunnel, type Period } from "@/components/r1/funnel-model";
import { prepare, useWorkflowRows, wfVersions } from "@/components/r1/wf-model";
import { PALETTE_BY_TYPE } from "@/data/persistency/r1/wf";
import { hashId } from "@/data/persistency/derived";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { gate } from "@/lib/gate";
import { num, pct } from "@/lib/format";
import { useWork } from "@/store/work";

const search = z.object({
  wf: fallback(z.string().optional(), undefined),
  period: fallback(z.enum(PERIODS).optional(), undefined),
  node: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/performance")({
  beforeLoad: ({ search }) => gate("performance", search),
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "Workflow performance · Persistency · desible.ai" },
      { name: "description", content: "Policies at every step of a workflow for a chosen period, with the result of each workflow." },
      { property: "og:title", content: "Workflow performance · Persistency · desible.ai" },
      { property: "og:description", content: "Policies at every step of a workflow for a chosen period, with the result of each workflow." },
    ],
  }),
  component: PerformancePage,
});

function PerformancePage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const rows = useWorkflowRows().filter((r) => !r.archived);
  const saved = useWork((st) => st.versions);
  const { scoped } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const period: Period = s.period ?? "Today";
  const code = s.wf ?? "R1";

  const funnelFor = (c: string, per: Period) => {
    const list = wfVersions(saved, c);
    const g = (list.find((v) => v.status === "Active") ?? list[list.length - 1])?.data;
    if (!g) return undefined;
    const base = Math.max(stats.count.get(c) ?? 0, 140 + (hashId(c) % 220));
    const graph = prepare(g);
    return { graph, f: computeFunnel(graph, base * PERIOD_FACTOR[per], scoped, c + per) };
  };

  const current = useMemo(() => funnelFor(code, period), [code, period, saved, scoped, stats.count]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useMemo(
    () =>
      rows.map((r) => {
        const x = funnelFor(r.code, period);
        const paid = x?.f.outcomes.filter((o) => o.type === "outcome.paid").reduce((a, o) => a + o.count, 0) ?? 0;
        const person = x?.f.outcomes.filter((o) => o.type === "outcome.handoff").reduce((a, o) => a + o.count, 0) ?? 0;
        return { r, total: x?.f.total ?? 0, paid, person };
      }),
    [rows, period, saved, scoped, stats.count], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const row = rows.find((r) => r.code === code);
  const f = current?.f;
  const paid = f?.outcomes.filter((o) => o.type === "outcome.paid").reduce((a, o) => a + o.count, 0) ?? 0;
  const person = f?.outcomes.filter((o) => o.type === "outcome.handoff").reduce((a, o) => a + o.count, 0) ?? 0;
  const routed = f?.outcomes.filter((o) => o.type === "outcome.routed").reduce((a, o) => a + o.count, 0) ?? 0;
  const node = current?.graph.nodes.find((n) => n.id === s.node);
  const set = (patch: Record<string, unknown>) => navigate({ search: (p) => ({ ...p, ...patch }) });

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader
        title="Workflow performance"
        meta={`${row?.name ?? code} · ${period}`}
        actions={
          <div className="flex items-center gap-2">
            <select aria-label="Workflow" value={code} onChange={(e) => set({ wf: e.target.value, node: undefined })} className={`${selectCls} max-w-[320px]`}>
              {rows.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
            <SegmentedControl label="Period" value={period} options={PERIODS} onChange={(v) => set({ period: v })} />
          </div>
        }
      />
      {f && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Policies started" value={num(f.total)} />
          <Kpi label="Paid or revived" value={num(paid)} change={`${pct(paid / Math.max(1, f.total))} of started`} />
          <Kpi label="With a person" value={num(person)} change={`${pct(person / Math.max(1, f.total))} of started`} />
          <Kpi label="Moved to another workflow" value={num(routed)} change={`${pct(routed / Math.max(1, f.total))} of started`} />
        </div>
      )}
      {current && f && (
        <div className={`grid gap-4 ${node ? "xl:grid-cols-[1fr_340px]" : ""}`}>
          <CanvasBox graph={current.graph} funnel={{ total: f.total, edges: f.edges }} counts={f.nodes} selectedId={s.node ?? null} height={600} onSelectNode={(n) => set({ node: n ?? undefined })} />
          {node && (
            <aside className="panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] text-muted-foreground">{PALETTE_BY_TYPE[node.type]?.group ?? "Step"}</p>
                  <h2 className="text-[14px] font-semibold text-foreground">{node.label}</h2>
                </div>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => set({ node: undefined })}><X /></Button>
              </div>
              <p className="text-[24px] font-semibold text-foreground tabular">{num(f.nodes[node.id] ?? 0)}</p>
              <p className="-mt-2 text-[12px] text-muted-foreground">{pct((f.nodes[node.id] ?? 0) / Math.max(1, f.total))} of policies started</p>
              {node.config.executor && <p className="text-[13px] text-subtle">Executor: {node.config.executor}</p>}
              <div>
                <p className="mb-1 text-[12px] font-medium text-muted-foreground">By renewal propensity</p>
                <ul className="space-y-1 text-[13px]">
                  {Object.entries(f.byCohort[node.id] ?? {}).filter(([, v]) => v > 0).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-subtle">{k}</span><span className="tabular text-foreground">{num(v)}</span></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-[12px] font-medium text-muted-foreground">Where they go next</p>
                <ul className="space-y-1 text-[13px]">
                  {current.graph.edges.filter((e) => e.from === node.id).map((e) => (
                    <li key={e.id} className="flex justify-between"><span className="text-subtle">{e.label ?? "Next step"}</span><span className="tabular text-foreground">{num(f.edges[e.id] ?? 0)}</span></li>
                  ))}
                </ul>
              </div>
              <Link to="/persistency/workflows/$id" params={{ id: code }} search={{ node: node.id } as never} className="text-[13px] text-primary hover:underline">Open the workflow</Link>
            </aside>
          )}
        </div>
      )}
      <section className="panel overflow-x-auto">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-[14px] font-semibold text-foreground">All workflows · {period}</h2>
        </header>
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              <th className="px-4 py-2 font-medium">Workflow</th>
              <th className="px-4 py-2 text-right font-medium">Started</th>
              <th className="px-4 py-2 text-right font-medium">Paid or revived</th>
              <th className="px-4 py-2 text-right font-medium">Rate</th>
              <th className="px-4 py-2 text-right font-medium">With a person</th>
            </tr>
          </thead>
          <tbody>
            {table.map(({ r, total, paid: p, person: h }) => (
              <tr key={r.code} onClick={() => set({ wf: r.code, node: undefined })} className={`cursor-pointer border-t border-border/60 hover:bg-surface-translucent ${r.code === code ? "bg-brand-tint" : ""}`}>
                <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                <td className="px-4 py-2 text-right tabular">{num(total)}</td>
                <td className="px-4 py-2 text-right tabular">{num(p)}</td>
                <td className="px-4 py-2 text-right tabular">{pct(p / Math.max(1, total))}</td>
                <td className="px-4 py-2 text-right tabular">{num(h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
