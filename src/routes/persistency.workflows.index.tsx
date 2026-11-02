import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ds/primitives";
import { StatusChip, versionTone } from "@/components/r1/status-chip";
import { ConfirmDialog } from "@/components/r1/confirm";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { WF_STAGES, blankGraph, useWorkflowRows, wfVersions, type WfRow } from "@/components/r1/wf-model";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useWorkflowStats } from "@/hooks/use-workflow-stats";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { num, time } from "@/lib/format";
import { useWork } from "@/store/work";
import type { WfGraph } from "@/data/persistency/r1/wf";

export const Route = createFileRoute("/persistency/workflows/")({
  beforeLoad: ({ search }) => gate("workflows", search),
  head: () => ({
    meta: [
      { title: "Workflows · Persistency · desible.ai" },
      { name: "description", content: "Workflow library grouped by stage, with executors, versions, status and policies in each workflow." },
      { property: "og:title", content: "Workflows · Persistency · desible.ai" },
      { property: "og:description", content: "Workflow library grouped by stage, with executors, versions, status and policies in each workflow." },
    ],
  }),
  component: WorkflowLibrary,
});

function WorkflowLibrary() {
  const navigate = useNavigate();
  const rows = useWorkflowRows();
  const { scoped } = useScopedPolicies();
  const stats = useWorkflowStats(scoped);
  const mayEdit = useCan("workflows.edit");
  const user = useUser();
  const saved = useWork((s) => s.versions);
  const createWorkflow = useWork((s) => s.createWorkflow);
  const saveDraft = useWork((s) => s.saveDraft);
  const archive = useWork((s) => s.archiveWorkflow);
  const [selected, setSelected] = useState<WfRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<string>("Renewal window");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const author = user?.name ?? "User";

  const create = (n: string, st: string, graph: WfGraph, note: string) => {
    const code = createWorkflow(n, st, author);
    saveDraft(`workflow:${code}`, graph, author, note);
    return code;
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader
        title="Workflows"
        meta={`${rows.filter((r) => !r.archived).length} workflows`}
        actions={
          mayEdit && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return;
                  const list = wfVersions(saved, selected.code);
                  const g = (list.find((v) => v.status === "Active") ?? list[list.length - 1])?.data;
                  const code = create(`${selected.name} copy`, selected.stage, structuredClone(g ?? blankGraph()), `Duplicated from ${selected.code}`);
                  toast.success(`${code} created as a draft`);
                  navigate({ to: "/persistency/workflows/$id/edit", params: { id: code } });
                }}
              >
                <Copy /> Duplicate
              </Button>
              <Button size="sm" variant="outline" disabled={!selected || selected.archived} onClick={() => setArchiveOpen(true)}>
                <Archive /> Archive
              </Button>
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <Plus /> New workflow
              </Button>
            </div>
          )
        }
      />
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[1100px] text-[13px]">
          <thead className="bg-card">
            <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              {mayEdit && <th className="w-8 border-b border-border px-3 py-2" aria-label="Select" />}
              {["Code", "Name", "Stage", "Products", "Trigger", "Executors used", "Version", "Status", "Policies in it now", "Last run"].map((h) => (
                <th key={h} className={`border-b border-border px-3 py-2 font-medium ${h === "Policies in it now" || h === "Version" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WF_STAGES.map((st) => {
              const list = rows.filter((r) => r.stage === st);
              if (!list.length) return null;
              return [
                <tr key={st}>
                  <td colSpan={mayEdit ? 11 : 10} className="bg-surface-translucent px-3 py-1.5 text-[12px] font-semibold text-subtle">{st}</td>
                </tr>,
                ...list.map((r) => {
                  const last = stats.lastRun.get(r.code);
                  return (
                    <tr key={r.code} onClick={() => navigate({ to: "/persistency/workflows/$id", params: { id: r.code } })} className={`cursor-pointer border-b border-border/60 hover:bg-surface-translucent ${r.archived ? "opacity-50" : ""}`}>
                      {mayEdit && (
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input type="radio" name="wf" aria-label={`Select ${r.code}`} checked={selected?.code === r.code} onChange={() => setSelected(r)} className="accent-[var(--primary)]" />
                        </td>
                      )}
                      <td className="px-3 py-2 font-semibold text-primary">{r.code}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                      <td className="px-3 py-2 text-subtle">{r.stage}</td>
                      <td className="px-3 py-2 text-subtle">{r.products.join(", ")}</td>
                      <td className="px-3 py-2 text-subtle">{r.trigger}</td>
                      <td className="px-3 py-2 text-subtle">{r.executors.join(", ") || "None"}</td>
                      <td className="px-3 py-2 text-right tabular">{r.version ? `v${r.version}` : "None"}</td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          <StatusChip tone={versionTone(r.status)}>{r.status}</StatusChip>
                          {r.inReview && <StatusChip tone="risk">v{r.inReview} in review</StatusChip>}
                          {r.draft && <StatusChip tone="neutral">Draft v{r.draft}</StatusChip>}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular">{num(stats.count.get(r.code) ?? 0)}</td>
                      <td className="px-3 py-2 text-subtle tabular">{last ? `Today ${time(last, false)}` : "Not run this session"}</td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md rounded-card border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold">New workflow</DialogTitle>
          </DialogHeader>
          <label className="block text-[12px] font-medium text-muted-foreground">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} aria-label="Workflow name" autoFocus />
          </label>
          <label className="block text-[12px] font-medium text-muted-foreground">
            Stage
            <select value={stage} onChange={(e) => setStage(e.target.value)} className={`${selectCls} mt-1 w-full`}>
              {WF_STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                const code = create(name.trim(), stage, blankGraph(), "New workflow");
                setNewOpen(false);
                setName("");
                navigate({ to: "/persistency/workflows/$id/edit", params: { id: code } });
              }}
            >
              Create and open the builder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${selected?.code ?? ""}`}
        body="The workflow stays in the library, marked Archived. Its versions and history are kept."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!selected) return;
          archive(selected.code);
          toast.success(`${selected.code} archived`);
          setSelected(null);
        }}
      />
    </div>
  );
}
