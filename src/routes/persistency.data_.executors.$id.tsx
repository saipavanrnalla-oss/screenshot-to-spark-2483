import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, NoteBanner, Panel } from "@/components/ds/primitives";
import { StatusChip } from "@/components/r1/status-chip";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { WORKFLOWS } from "@/data/persistency";
import { EXEC_MODES, REPLACE_ONLY_NOTE, canReplaceInSlice, shareNeedsApproval, shareTotal, type ExecMode, type Executor } from "@/data/persistency/r1/executors";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { dateTime, inr, num } from "@/lib/format";
import { useWork } from "@/store/work";

export const Route = createFileRoute("/persistency/data_/executors/$id")({
  beforeLoad: ({ search }) => gate("data", search),
  head: ({ params }) => ({
    meta: [
      { title: `Executor ${params.id} · Data files · desible.ai` },
      { name: "description", content: "Mode and share per workflow, cost inputs, contact limit and change history." },
      { property: "og:title", content: `Executor ${params.id} · Data files · desible.ai` },
      { property: "og:description", content: "Mode and share per workflow, cost inputs, contact limit and change history." },
    ],
  }),
  component: ExecutorPage,
});

function ExecutorPage() {
  const { id } = Route.useParams();
  const executors = useWork((s) => s.executors);
  const history = useWork((s) => s.execHistory);
  const approvals = useWork((s) => s.approvals);
  const update = useWork((s) => s.updateExecutor);
  const submit = useWork((s) => s.submit);
  const mayEdit = useCan("executors.edit");
  const user = useUser();
  const e = executors.find((x) => x.id === id);
  const { scoped } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const [d, setD] = useState<Executor | undefined>(e);
  useEffect(() => setD(e), [e]);
  const others = useMemo(() => executors.filter((x) => x.id !== id), [executors, id]);
  if (!e || !d) return <EmptyState title={`There is no executor called ${id}.`} action={<Link to="/persistency/data" search={{ tab: "executors" }} className="text-[13px] text-primary hover:underline">Back to Executors</Link>} />;
  const replaceOk = canReplaceInSlice(e);
  const wfs = WORKFLOWS.map((w) => w.id);
  const dirty = JSON.stringify(d) !== JSON.stringify(e);
  const over = wfs.filter((w) => shareTotal([...others, d], w) > 100);
  const pending = approvals.filter((a) => a.kind === "executor" && a.status === "waiting" && (a.payload as { id?: string } | undefined)?.id === id);

  const save = () => {
    if (over.length) return void toast.error(`Shares for ${over.join(", ")} add up to more than 100 percent.`);
    const by = user?.name ?? "User";
    const big: string[] = [];
    const shares = { ...e.shares };
    for (const w of wfs) {
      const before = e.shares[w] ?? 0;
      const after = d.shares[w] ?? 0;
      if (before === after) continue;
      if (shareNeedsApproval(before, after)) {
        big.push(w);
        submit({
          kind: "executor",
          objectId: `${id}-${w}`,
          objectName: `${e.name} share in ${w}`,
          requestedBy: by,
          summary: `${w} share ${before} to ${after} percent`,
          reach: Math.round(((stats.count.get(w) ?? 0) * Math.abs(after - before)) / 100),
          diff: [`${w} share: ${before}% → ${after}%`, `Mode: ${d.modes[w] ?? "Direct"}`],
          conflicts: [],
          needs: ["head"],
          payload: { id, workflow: w, share: after },
        });
      } else shares[w] = after;
    }
    const changes: string[] = [];
    for (const w of wfs) if ((e.modes[w] ?? "") !== (d.modes[w] ?? "")) changes.push(`${w} mode ${e.modes[w] ?? "none"} to ${d.modes[w]}`);
    for (const w of wfs) if ((e.shares[w] ?? 0) !== (shares[w] ?? 0)) changes.push(`${w} share ${e.shares[w] ?? 0} to ${shares[w]}`);
    if (JSON.stringify(e.costs) !== JSON.stringify(d.costs)) changes.push("Cost inputs changed");
    if (e.contactLimit !== d.contactLimit) changes.push(`Contact limit ${e.contactLimit} to ${d.contactLimit}`);
    if (changes.length) update(id, { modes: d.modes, shares, costs: d.costs, contactLimit: d.contactLimit }, by, changes.join("; "));
    toast.success(big.length ? `Saved. Share change for ${big.join(", ")} sent for approval.` : "Saved");
    if (big.length) setD({ ...d, shares });
  };

  return (
    <div className="mx-auto max-w-[1300px] space-y-4">
      <Link to="/persistency/data" search={{ tab: "executors" }} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Executors</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[20px] font-semibold text-foreground">{e.name}</h1>
        <StatusChip tone={e.status === "Active" ? "ok" : "risk"}>{e.status}</StatusChip>
        <span className="text-[12px] text-muted-foreground">{e.type} · {e.payout} payout · receives tasks by {e.receives.toLowerCase()}</span>
      </div>
      {pending.map((a) => <NoteBanner key={a.id}>Waiting for approval: {a.summary}</NoteBanner>)}
      <Panel title="Mode and share per workflow" bodyClassName="p-0">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">Workflow</th><th className="px-3 py-2 font-medium">Mode</th><th className="px-3 py-2 font-medium">Share of eligible volume</th><th className="px-3 py-2 font-medium">Policies that move</th><th className="px-3 py-2 font-medium">All executors</th></tr></thead>
          <tbody>
            {wfs.map((w) => {
              const mode = d.modes[w];
              const share = d.shares[w] ?? 0;
              const delta = share - (e.shares[w] ?? 0);
              const moves = Math.round(((stats.count.get(w) ?? 0) * Math.abs(delta)) / 100);
              const total = shareTotal([...others, d], w);
              if (!mode && !share && !e.modes[w]) {
                return (
                  <tr key={w} className="border-t border-border/60 text-muted-foreground">
                    <td className="px-3 py-1.5">{w}</td>
                    <td className="px-3 py-1.5" colSpan={4}>{mayEdit ? <Button size="sm" variant="ghost" onClick={() => setD({ ...d, modes: { ...d.modes, [w]: "Observe" }, shares: { ...d.shares, [w]: 0 } })}>Add to {w}</Button> : "Not used"}</td>
                  </tr>
                );
              }
              return (
                <tr key={w} className="border-t border-border/60">
                  <td className="px-3 py-1.5 font-medium">{w} <span className="text-subtle">{WORKFLOWS.find((x) => x.id === w)?.name}</span></td>
                  <td className="px-3 py-1.5">
                    <select disabled={!mayEdit} value={mode ?? "Observe"} onChange={(ev) => setD({ ...d, modes: { ...d.modes, [w]: ev.target.value as ExecMode } })} className={selectCls} aria-label={`Mode for ${w}`}>
                      {EXEC_MODES.map((m) => <option key={m} value={m} disabled={m === "Replace in slice" && !replaceOk}>{m}{m === "Replace in slice" && !replaceOk ? ` (${REPLACE_ONLY_NOTE})` : ""}</option>)}
                    </select>
                    {!replaceOk && <p className="mt-0.5 text-[11px] text-muted-foreground">Replace in slice: {REPLACE_ONLY_NOTE}</p>}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-1"><input disabled={!mayEdit} type="number" min={0} max={100} value={share} onChange={(ev) => setD({ ...d, shares: { ...d.shares, [w]: Math.min(100, Math.max(0, Math.round(Number(ev.target.value) || 0))) } })} className={`${inputCls} w-20 tabular`} aria-label={`Share for ${w}`} />%</span>
                    {shareNeedsApproval(e.shares[w] ?? 0, share) && <p className="mt-0.5 text-[11px] text-attention">Change above 20 points: needs approval</p>}
                  </td>
                  <td className="px-3 py-1.5 tabular">{delta ? `moves ${num(moves)} policies` : ""}</td>
                  <td className={`px-3 py-1.5 tabular ${total > 100 ? "text-destructive" : ""}`}>{total}%{total > 100 ? " (over 100)" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Cost inputs and contact limit">
          <div className="grid grid-cols-2 gap-3">
            {(["call", "message", "task"] as const).map((k) => (
              <label key={k} className="block text-[12px] font-medium text-muted-foreground">Cost per {k === "task" ? "agent task" : k} (₹)
                <input disabled={!mayEdit} type="number" min={0} step={0.1} value={d.costs[k]} onChange={(ev) => setD({ ...d, costs: { ...d.costs, [k]: Math.max(0, Number(ev.target.value) || 0) } })} className={`${inputCls} mt-1 tabular`} />
              </label>
            ))}
            <label className="block text-[12px] font-medium text-muted-foreground">Contact limit per policy per month
              <input disabled={!mayEdit} type="number" min={0} value={d.contactLimit} onChange={(ev) => setD({ ...d, contactLimit: Math.max(0, Number(ev.target.value) || 0) })} className={`${inputCls} mt-1 tabular`} />
            </label>
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">Current cost per task {inr(e.costs.task)}.</p>
        </Panel>
        <Panel title="History of changes">
          <ul className="space-y-1.5 text-[13px]">
            {history.filter((h) => h.id === id).map((h, i) => <li key={i} className="flex justify-between gap-3"><span>{h.change}</span><span className="shrink-0 text-[12px] text-muted-foreground">{h.by} · {dateTime(h.at)}</span></li>)}
            {!history.some((h) => h.id === id) && <li className="text-muted-foreground">No changes yet.</li>}
          </ul>
        </Panel>
      </div>
      {mayEdit && (
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/95 py-3">
          <Button variant="ghost" disabled={!dirty} onClick={() => setD(e)}>Discard</Button>
          <Button disabled={!dirty || over.length > 0} onClick={save}>Save</Button>
        </div>
      )}
    </div>
  );
}
