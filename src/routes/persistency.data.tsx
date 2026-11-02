import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, NoteBanner, PageHeader, Panel } from "@/components/ds/primitives";
import { DataGrid } from "@/components/r1/data-grid";
import { StatusChip } from "@/components/r1/status-chip";
import { PageTabs, inputCls, selectCls } from "@/components/r1/tabs";
import { importPermission, useAdapterRows } from "@/components/r1/data-model";
import { WORKFLOWS, type Policy } from "@/data/persistency";
import { PAYMENT_RECEIPTS } from "@/data/persistency/r1/files";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { can } from "@/config/users";
import { dateTime, inr, num, date } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { useDecisions, usePolicies, usePolicy } from "@/store/persistency";
import { useWork, type OutboundList } from "@/store/work";

const search = z.object({
  tab: fallback(z.enum(["files", "lists", "executors", "paid", "unmatched"]).optional(), undefined),
});

export const Route = createFileRoute("/persistency/data")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("data", search),
  head: () => ({
    meta: [
      { title: "Data files · Persistency · desible.ai" },
      { name: "description", content: "Files in and out, imports, outbound lists, executors, payments since the list and unmatched receipts." },
      { property: "og:title", content: "Data files · Persistency · desible.ai" },
      { property: "og:description", content: "Files in and out, imports, outbound lists, executors, payments since the list and unmatched receipts." },
    ],
  }),
  component: DataPage,
});

function useUnmatched() {
  const imported = useWork((s) => s.imported);
  const matched = useWork((s) => s.matched);
  return useMemo(() => (imported["payments"] ? PAYMENT_RECEIPTS.filter((r) => r.policyId.startsWith("SLI09") && !matched[r.receipt]) : []), [imported, matched]);
}

function DataPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab = s.tab ?? "files";
  const unmatched = useUnmatched();
  const imported = useWork((st) => st.imported);
  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader title="Data files" meta="Files in and out, and who does the work" />
      <PageTabs
        label="Data files"
        value={tab}
        onChange={(v) => navigate({ search: { tab: v === "files" ? undefined : v } })}
        tabs={[
          { id: "files", label: "Files" },
          { id: "lists", label: "Outbound lists" },
          { id: "executors", label: "Executors" },
          { id: "paid", label: "Paid since the list", count: imported["payments"] ? PAYMENT_RECEIPTS.filter((r) => r.closedTouch).length : undefined },
          { id: "unmatched", label: "Unmatched receipts", count: imported["payments"] ? unmatched.length : undefined },
        ]}
      />
      {tab === "files" && <Files />}
      {tab === "lists" && <Lists />}
      {tab === "executors" && <Executors />}
      {tab === "paid" && <PaidSince />}
      {tab === "unmatched" && <Unmatched rows={unmatched} />}
    </div>
  );
}

function Files() {
  const rows = useAdapterRows();
  const navigate = useNavigate();
  const user = useUser();
  return (
    <DataGrid
      label="Files"
      rows={rows}
      rowKey={(a) => a.id}
      onRowClick={(a) => navigate({ to: "/persistency/data/files/$id", params: { id: a.id } })}
      columns={[
        { id: "name", label: "Name", value: (a) => a.name, render: (a) => <span className="font-medium text-foreground">{a.name}</span> },
        { id: "dir", label: "Direction", value: (a) => a.direction },
        { id: "source", label: "Source", value: (a) => a.source },
        { id: "schedule", label: "Schedule", value: (a) => a.schedule },
        { id: "last", label: "Last received", value: (a) => a.lastReceived, render: (a) => dateTime(a.lastReceived) },
        { id: "rows", label: "Rows", align: "right", value: (a) => a.rows, render: (a) => num(a.rows) },
        { id: "rejects", label: "Rejects", align: "right", value: (a) => a.rejects, render: (a) => num(a.rejects) },
        { id: "status", label: "Status", value: (a) => (a.overdue ? "Overdue" : "On time"), render: (a) => <StatusChip tone={a.overdue ? "risk" : "ok"}>{a.overdue ? "Overdue" : a.direction === "Out" ? "Sent" : "Received"}</StatusChip> },
        {
          id: "import",
          label: "",
          sortable: false,
          value: () => "",
          render: (a) => {
            const perm = importPermission(a);
            return perm && user && can(user, perm) ? (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate({ to: "/persistency/data/import/$id", params: { id: a.id } }); }}>
                <Upload /> Import
              </Button>
            ) : null;
          },
        },
      ]}
    />
  );
}

/* ---------- Outbound lists ---------- */

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

function Lists() {
  const lists = useWork((s) => s.outboundLists);
  const markSent = useWork((s) => s.markListSent);
  const mayCreate = useCan("lists.create");
  const mayImport = useCan("files.import");
  const [open, setOpen] = useState(false);
  const download = (l: OutboundList) => downloadCsv(`${l.id}-${l.workflow}-${l.date}.csv`, ["POLICY_NO", "WORKFLOW", "DATE", "EXECUTOR"], l.policyIds.map((id) => [id, l.workflow, l.date, l.to]));
  return (
    <div className="space-y-3">
      {mayCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus /> New list</Button>}
      {lists.length === 0 ? (
        <EmptyState title="No lists made this session." />
      ) : (
        <DataGrid
          label="Outbound lists"
          rows={lists}
          rowKey={(l) => l.id}
          columns={[
            { id: "id", label: "List", value: (l) => l.id },
            { id: "kind", label: "Kind", value: (l) => l.kind },
            { id: "to", label: "To", value: (l) => l.to },
            { id: "wf", label: "Workflow", value: (l) => l.workflow },
            { id: "date", label: "Date", value: (l) => l.date, render: (l) => date(l.date) },
            { id: "n", label: "Policies", align: "right", value: (l) => l.policyIds.length, render: (l) => num(l.policyIds.length) },
            { id: "paid", label: "Removed, paid", align: "right", value: (l) => l.removedPaid },
            { id: "by", label: "Created by", value: (l) => l.createdBy },
            { id: "sent", label: "Status", value: (l) => (l.sent ? "Sent" : "Not sent"), render: (l) => <StatusChip tone={l.sent ? "ok" : "neutral"}>{l.sent ? "Sent" : "Not sent"}</StatusChip> },
            {
              id: "act",
              label: "",
              sortable: false,
              value: () => "",
              render: (l) => (
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => download(l)}><Download /> CSV</Button>
                  {!l.sent && mayCreate && <Button size="sm" variant="ghost" onClick={() => { markSent(l.id); toast.success(`${l.id} marked as sent`); }}>Mark as sent</Button>}
                  {l.sent && l.kind === "Vendor work list" && mayImport && (
                    <Button asChild size="sm" variant="ghost"><Link to="/persistency/data/import/$id" params={{ id: "call-results" }}>Import results</Link></Button>
                  )}
                </span>
              ),
            },
          ]}
        />
      )}
      {lists.some((l) => l.sent && l.kind === "Vendor work list") && !mayImport && <p className="text-[12px] text-muted-foreground">MIS and analytics imports the vendor's results file in Call results.</p>}
      <NewList open={open} onOpenChange={setOpen} />
    </div>
  );
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

/* ---------- Executors ---------- */

function Executors() {
  const executors = useWork((s) => s.executors);
  const navigate = useNavigate();
  return (
    <DataGrid
      label="Executors"
      rows={executors}
      rowKey={(e) => e.id}
      onRowClick={(e) => navigate({ to: "/persistency/data/executors/$id", params: { id: e.id } })}
      columns={[
        { id: "name", label: "Name", value: (e) => e.name, render: (e) => <span className="font-medium text-foreground">{e.name}</span> },
        { id: "type", label: "Type", value: (e) => e.type },
        { id: "payout", label: "Payout model", value: (e) => e.payout },
        { id: "receives", label: "Receives tasks by", value: (e) => e.receives },
        { id: "mode", label: "Mode", value: (e) => Object.entries(e.modes).map(([w, m]) => `${w} ${m}`).join(", ") },
        { id: "share", label: "Share of eligible volume", value: (e) => Object.entries(e.shares).map(([w, sh]) => `${w} ${sh}%`).join(", ") },
        { id: "limit", label: "Contact limit", align: "right", value: (e) => e.contactLimit },
        { id: "status", label: "Status", value: (e) => e.status, render: (e) => <StatusChip tone={e.status === "Active" ? "ok" : "risk"}>{e.status}</StatusChip> },
      ]}
    />
  );
}

/* ---------- Paid since the list, Unmatched ---------- */

function PaidSince() {
  const imported = useWork((s) => s.imported);
  const rows = PAYMENT_RECEIPTS.filter((r) => r.closedTouch);
  if (!imported["payments"]) return <EmptyState title="Import today's payment file to see who paid after the list was cut." action={<Link to="/persistency/data/import/$id" params={{ id: "payments" }} className="text-[13px] text-primary hover:underline">Import the payment file</Link>} />;
  return (
    <DataGrid
      label="Paid since the list"
      rows={rows}
      rowKey={(r) => r.receipt}
      csvName="paid-since-the-list.csv"
      columns={[
        { id: "policy", label: "Policy", value: (r) => r.policyId, render: (r) => <Link to="/persistency/policies/$id" params={{ id: r.policyId }} search={{ tab: "activity" }} className="text-primary hover:underline">{r.policyId}</Link> },
        { id: "receipt", label: "Receipt", value: (r) => r.receipt },
        { id: "amount", label: "Amount", align: "right", value: (r) => r.amount, render: (r) => inr(r.amount) },
        { id: "touch", label: "Touch that closed", value: (r) => r.closedTouch ?? "" },
        { id: "paid", label: "Time of payment", value: (r) => r.paidAt, render: (r) => dateTime(r.paidAt) },
        { id: "after", label: "Touches after payment", align: "right", value: (r) => r.touchesAfter ?? 0 },
      ]}
    />
  );
}

function Unmatched({ rows }: { rows: typeof PAYMENT_RECEIPTS }) {
  const imported = useWork((s) => s.imported);
  const match = useWork((s) => s.matchReceipt);
  const mayMatch = useCan("receipts.match");
  const user = useUser();
  const [open, setOpen] = useState<(typeof PAYMENT_RECEIPTS)[number] | null>(null);
  const [q, setQ] = useState("");
  const found = usePolicy(q.trim().toUpperCase() || null);
  if (!imported["payments"]) return <EmptyState title="Import today's payment file to see receipts with no policy match." />;
  return (
    <>
      <p className="text-[13px] text-subtle"><span className="font-semibold tabular text-foreground">{num(rows.length)}</span> receipts with no policy match.</p>
      <DataGrid
        label="Unmatched receipts"
        rows={rows}
        rowKey={(r) => r.receipt}
        onRowClick={mayMatch ? (r) => { setOpen(r); setQ(""); } : undefined}
        columns={[
          { id: "receipt", label: "Receipt", value: (r) => r.receipt },
          { id: "ref", label: "Policy number on the receipt", value: (r) => r.policyId },
          { id: "amount", label: "Amount", align: "right", value: (r) => r.amount, render: (r) => inr(r.amount) },
          { id: "paid", label: "Paid on", value: (r) => r.paidAt, render: (r) => dateTime(r.paidAt) },
          { id: "mode", label: "Mode", value: (r) => r.mode },
        ]}
      />
      {!mayMatch && <p className="text-[12px] text-muted-foreground">Remittance and operations matches receipts.</p>}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-md rounded-card border-border bg-card">
          <DialogHeader><DialogTitle className="text-[14px] font-semibold">Match {open?.receipt}</DialogTitle></DialogHeader>
          <p className="text-[13px] text-subtle">{open && `${inr(open.amount)} paid ${dateTime(open.paidAt)}, reference ${open.policyId}`}</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by policy number" aria-label="Policy number" className={inputCls} />
          {q && (found ? <NoteBanner>{found.policyId} · {found.customerName} · {found.product} · instalment {inr(found.instalmentAmount)}</NoteBanner> : <p className="text-[12px] text-attention">No policy {q.toUpperCase()}.</p>)}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
            <Button disabled={!found || !open} onClick={() => { if (!open || !found) return; match(open.receipt, found.policyId, user?.name ?? "User"); toast.success(`${open.receipt} matched to ${found.policyId}`); setOpen(null); }}>Match</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
