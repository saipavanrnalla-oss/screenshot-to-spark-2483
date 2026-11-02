import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inputCls, selectCls } from "./tabs";
import { WORKFLOWS, type Policy } from "@/data/persistency";
import { useUser } from "@/hooks/use-user";
import { num } from "@/lib/format";
import { useDecisions, usePolicies } from "@/store/persistency";
import { useWork } from "@/store/work";

const OPEN = new Set(["Renewal window open", "Grace", "Promised", "Early lapse"]);

function useListPreview(to: string, workflow: string, day: string) {
  const policies = usePolicies();
  const decisions = useDecisions(policies);
  const executors = useWork((s) => s.executors);
  const lists = useWork((s) => s.outboundLists);
  const holds = useWork((s) => s.holds);
  return useMemo(() => {
    const ex = executors.find((e) => e.name === to);
    const share = ex?.shares[workflow] ?? 100;
    const inWf = policies.filter((p) => decisions.get(p.policyId)?.workflowId === workflow);
    const take = share > 0 ? inWf.slice(0, Math.round((inWf.length * share) / 100)) : inWf;
    const already = new Set(lists.filter((l) => l.date === day && l.workflow === workflow).flatMap((l) => l.policyIds));
    let removedPaid = 0;
    let removedChecks = 0;
    const keep: Policy[] = [];
    for (const p of take) {
      if (p.state === "Paid" || p.monthDue?.status === "paid") removedPaid++;
      else if (holds[p.policyId] || !OPEN.has(p.state) || already.has(p.policyId)) removedChecks++;
      else keep.push(p);
    }
    return { keep, removedPaid, removedChecks, share, candidates: take.length };
  }, [policies, decisions, executors, lists, holds, to, workflow, day]);
}

export function NewList({ open, onOpenChange, preset }: { open: boolean; onOpenChange: (o: boolean) => void; preset?: { to: string; workflow: string; policyIds?: string[] | undefined; source?: string | undefined } | undefined }) {
  const executors = useWork((s) => s.executors);
  const create = useWork((s) => s.createList);
  const user = useUser();
  const targets = executors.filter((e) => e.type !== "Agent");
  const [to, setTo] = useState(preset?.to ?? targets[0]?.name ?? "");
  const [workflow, setWorkflow] = useState(preset?.workflow ?? "R2");
  const [day, setDay] = useState("2026-10-29");
  const pv = useListPreview(to, workflow, day);
  const fixed = preset?.policyIds;
  const ids = fixed ?? pv.keep.map((p) => p.policyId);
  const isVisit = ["Field staff", "Bank relationship manager", "In-house team"].includes(executors.find((e) => e.name === to)?.type ?? "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-card border-border bg-card">
        <DialogHeader><DialogTitle className="text-[14px] font-semibold">New list</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-[12px] font-medium text-muted-foreground sm:col-span-3">Vendor or desk
            <select value={to} onChange={(e) => setTo(e.target.value)} className={`${selectCls} mt-1 w-full`} aria-label="Vendor or desk">{targets.map((e) => <option key={e.id}>{e.name}</option>)}</select>
          </label>
          <label className="block text-[12px] font-medium text-muted-foreground sm:col-span-2">Workflow
            <select value={workflow} onChange={(e) => setWorkflow(e.target.value)} className={`${selectCls} mt-1 w-full`} aria-label="Workflow">{WORKFLOWS.map((w) => <option key={w.id} value={w.id}>{w.id} {w.name}</option>)}</select>
          </label>
          <label className="block text-[12px] font-medium text-muted-foreground">Date
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
        </div>
        <div className="rounded-input border border-border p-3 text-[13px]">
          <p className="text-[20px] font-semibold tabular">{num(ids.length)} policies</p>
          {fixed ? (
            <p className="text-subtle">From {preset?.source ?? "the selected segment"}.</p>
          ) : (
            <>
              <p className="text-subtle">{num(pv.candidates)} in {workflow} for this executor ({pv.share}% share). Checks applied: paid since the list, on hold, contact policy.</p>
              <p className="mt-1">Removed because the customer paid since the list: <span className="tabular font-medium">{num(pv.removedPaid)}</span></p>
              <p>Removed by hold, contact policy or an existing list for this step today: <span className="tabular font-medium">{num(pv.removedChecks)}</span></p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!ids.length}
            onClick={() => {
              const id = create({ kind: isVisit ? "Visit list" : "Vendor work list", to, workflow, date: day, policyIds: ids, removedPaid: fixed ? 0 : pv.removedPaid, removedChecks: fixed ? 0 : pv.removedChecks, createdBy: user?.name ?? "User", source: preset?.source });
              toast.success(`${id} created with ${num(ids.length)} policies`);
              onOpenChange(false);
            }}
          >
            Create list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

