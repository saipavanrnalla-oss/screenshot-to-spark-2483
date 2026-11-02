import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NoteBanner, PageHeader } from "@/components/ds/primitives";
import { DataGrid, type Column } from "@/components/r1/data-grid";
import { ConfirmDialog } from "@/components/r1/confirm";
import { StatusChip } from "@/components/r1/status-chip";
import { Field, PageTabs } from "@/components/r1/tabs";
import { NOW } from "@/data/persistency";
import type { Approval, ApprovalKind } from "@/data/persistency/r1/types";
import { USERS, type RoleId } from "@/config/users";
import { useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { date, dateTime, num } from "@/lib/format";
import { useWork } from "@/store/work";

const search = z.object({
  tab: fallback(z.enum(["waiting", "history"]).optional(), undefined),
  open: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/approvals")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("approvals", search),
  head: () => ({
    meta: [
      { title: "Approvals · Persistency · desible.ai" },
      { name: "description", content: "Rule, workflow, agent, stage setting, executor share and experiment changes waiting for approval, and decided items." },
      { property: "og:title", content: "Approvals · Persistency · desible.ai" },
      { property: "og:description", content: "Rule, workflow, agent, stage setting, executor share and experiment changes waiting for approval, and decided items." },
    ],
  }),
  component: ApprovalsPage,
});

const KIND_LABEL: Record<ApprovalKind, string> = {
  rule: "Rule change",
  workflow: "Workflow version",
  agent: "Agent version",
  stage: "Stage settings",
  executor: "Executor share",
  experiment: "Experiment",
};

const ROLE_NAME: Record<RoleId, string> = Object.fromEntries(USERS.map((u) => [u.id, u.name])) as Record<RoleId, string>;

function age(at: string, clock: number): string {
  const now = NOW.getTime() + clock * 60_000;
  const h = Math.max(0, Math.round((now - new Date(at).getTime()) / 3_600_000));
  return h < 1 ? "Under 1 h" : h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

function objectLink(a: Approval): { to: string; params?: Record<string, string>; search?: Record<string, string> } | null {
  if (a.kind === "rule") return { to: "/persistency/rules/$id", params: { id: a.objectId } };
  if (a.kind === "workflow") return { to: "/persistency/workflows/$id", params: { id: a.objectId }, search: { tab: "versions" } };
  if (a.kind === "agent") return { to: "/persistency/agents/$id", params: { id: a.objectId }, search: { tab: "versions" } };
  if (a.kind === "stage") return { to: "/persistency/stages", search: { tab: "settings" } };
  if (a.kind === "executor") return { to: "/persistency/data/executors/$id", params: { id: (a.payload as { id?: string } | undefined)?.id ?? a.objectId } };
  if (a.kind === "experiment") return { to: "/persistency/reports", search: { tab: "experiments" } };
  return null;
}

function ApprovalsPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const user = useUser();
  const approvals = useWork((st) => st.approvals);
  const clock = useWork((st) => st.clock);
  const tab = s.tab ?? "waiting";
  const own = user?.id === "mis";

  const visible = useMemo(() => approvals.filter((a) => !own || a.requestedBy === user?.name || a.needs.includes("mis" as RoleId)), [approvals, own, user]);
  const waiting = visible.filter((a) => a.status === "waiting");
  const history = visible.filter((a) => a.status !== "waiting");
  const open = approvals.find((a) => a.id === s.open);

  const cols: Column<Approval>[] = [
    { id: "type", label: "Type", value: (a) => KIND_LABEL[a.kind] },
    { id: "object", label: "Object", value: (a) => `${a.objectName}${a.versionNo ? ` v${a.versionNo}` : ""}`, render: (a) => <span className="font-medium text-foreground">{a.objectName}{a.versionNo ? ` · version ${a.versionNo}` : ""}</span> },
    { id: "by", label: "Requested by", value: (a) => a.requestedBy },
    { id: "what", label: "What changes", value: (a) => a.summary },
    { id: "reach", label: "Reach (policies)", align: "right", value: (a) => a.reach, render: (a) => num(a.reach) },
    { id: "signoff", label: "Sign-off", value: (a) => a.needs.map((r) => (a.signoffs.some((x) => x.role === r) ? `${ROLE_NAME[r]} done` : ROLE_NAME[r])).join(", "), render: (a) => <span className="text-[12px]">{a.needs.map((r) => <span key={r} className={a.signoffs.some((x) => x.role === r) ? "mr-2 text-healthy" : "mr-2 text-muted-foreground"}>{ROLE_NAME[r]}{a.signoffs.some((x) => x.role === r) ? " (signed)" : ""}</span>)}</span> },
    { id: "age", label: "Age", value: (a) => a.at, render: (a) => age(a.at, clock) },
  ];
  const histCols: Column<Approval>[] = [
    { id: "type", label: "Type", value: (a) => KIND_LABEL[a.kind] },
    { id: "object", label: "Object", value: (a) => `${a.objectName}${a.versionNo ? ` v${a.versionNo}` : ""}` },
    { id: "decision", label: "Decision", value: (a) => a.status, render: (a) => <StatusChip tone={a.status === "approved" ? "ok" : "off"}>{a.status === "approved" ? "Approved" : "Returned"}</StatusChip> },
    { id: "by", label: "Approver", value: (a) => a.decidedBy ?? "" },
    { id: "at", label: "Time", value: (a) => a.decidedAt ?? "", render: (a) => (a.decidedAt ? dateTime(a.decidedAt) : "") },
    { id: "reason", label: "Reason or effective date", value: (a) => a.reason ?? (a.effectiveFrom ? `Effective ${date(a.effectiveFrom)}` : "") },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader title="Approvals" meta={`${waiting.length} waiting${own ? " · your requests" : ""}`} />
      <PageTabs
        label="Approvals"
        value={tab}
        onChange={(t) => navigate({ search: (p) => ({ ...p, tab: t }) })}
        tabs={[
          { id: "waiting", label: "Waiting", count: waiting.length },
          { id: "history", label: "History", count: history.length },
        ]}
      />
      {tab === "waiting" ? (
        <DataGrid label="Waiting approvals" columns={cols} rows={waiting} rowKey={(a) => a.id} activeKey={s.open} onRowClick={(a) => navigate({ search: (p) => ({ ...p, open: a.id }) })} emptyText="Nothing is waiting for approval." />
      ) : (
        <DataGrid label="Decided approvals" columns={histCols} rows={history} rowKey={(a) => a.id} onRowClick={(a) => navigate({ search: (p) => ({ ...p, open: a.id }) })} csvName="approvals-history.csv" emptyText="No decided items yet." />
      )}
      <ApprovalDetail approval={open ?? null} onClose={() => navigate({ search: (p) => ({ ...p, open: undefined }) })} />
    </div>
  );
}

function ApprovalDetail({ approval: a, onClose }: { approval: Approval | null; onClose: () => void }) {
  const user = useUser();
  const approve = useWork((s) => s.approve);
  const ret = useWork((s) => s.returnApproval);
  const [dialog, setDialog] = useState<"approve" | "return" | null>(null);
  const role = user?.id;
  const mine = !!a && !!role && a.status === "waiting" && a.needs.includes(role) && !a.signoffs.some((x) => x.role === role);
  const link = a ? objectLink(a) : null;
  const blockedBySim = a?.kind === "workflow" && a.sim?.result !== "Pass";
  return (
    <Sheet open={!!a} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="scrollbar-prism w-full overflow-y-auto border-border bg-background p-0 sm:max-w-[480px]">
        {a && (
          <div>
            <SheetHeader className="border-b border-border px-5 py-4 text-left">
              <p className="text-[12px] text-muted-foreground">{KIND_LABEL[a.kind]} · {a.id}</p>
              <SheetTitle className="text-[18px] font-semibold">{a.objectName}{a.versionNo ? ` · version ${a.versionNo}` : ""}</SheetTitle>
              <p className="text-[13px] text-subtle">{a.summary}</p>
            </SheetHeader>
            <dl className="grid grid-cols-2 gap-3 border-b border-border px-5 py-4">
              <Field label="Requested by">{a.requestedBy}</Field>
              <Field label="Requested">{dateTime(a.at)}</Field>
              <Field label="Reach">{num(a.reach)} policies</Field>
              <Field label="Approvers">{a.needs.map((r) => ROLE_NAME[r]).join(" and ")}</Field>
            </dl>
            {a.secondApproverReason && <NoteBanner tone="attention" className="mx-5 mt-4">Second approver needed: {a.secondApproverReason}</NoteBanner>}
            <section className="space-y-2 border-b border-border px-5 py-4">
              <h3 className="text-[14px] font-semibold">What changes</h3>
              <ul className="space-y-1.5 font-mono text-[12px]">
                {a.diff.map((d, i) => (
                  <li key={i} className="rounded-input border border-border px-2 py-1 text-foreground">{d}</li>
                ))}
              </ul>
            </section>
            <section className="space-y-2 border-b border-border px-5 py-4">
              <h3 className="text-[14px] font-semibold">Conflicts found</h3>
              {a.conflicts.length ? <ul className="list-disc space-y-1 pl-4 text-[13px]">{a.conflicts.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-[13px] text-muted-foreground">None</p>}
            </section>
            {a.kind === "workflow" && (
              <section className="space-y-2 border-b border-border px-5 py-4">
                <h3 className="text-[14px] font-semibold">Simulation result</h3>
                {a.sim ? <StatusChip tone={a.sim.result === "Pass" ? "ok" : "off"}>{a.sim.result}, {a.sim.steps} steps{a.sim.reason ? `: ${a.sim.reason}` : ""}</StatusChip> : <p className="text-[13px] text-failed">No simulation run</p>}
              </section>
            )}
            <section className="space-y-2 border-b border-border px-5 py-4">
              <h3 className="text-[14px] font-semibold">Sign-off</h3>
              <ul className="space-y-1 text-[13px]">
                {a.needs.map((r) => {
                  const done = a.signoffs.find((x) => x.role === r);
                  return (
                    <li key={r} className="flex justify-between">
                      <span>{ROLE_NAME[r]}</span>
                      <span className={done ? "text-healthy" : "text-muted-foreground"}>{done ? `Signed ${dateTime(done.at)}` : "Waiting"}</span>
                    </li>
                  );
                })}
              </ul>
              {a.status !== "waiting" && (
                <p className="text-[13px]">
                  {a.status === "approved" ? "Approved" : "Returned"} by {a.decidedBy} on {a.decidedAt ? dateTime(a.decidedAt) : ""}
                  {a.reason ? `: ${a.reason}` : ""}
                  {a.effectiveFrom && a.status === "approved" ? `, effective ${date(a.effectiveFrom)}` : ""}
                </p>
              )}
            </section>
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
              {link && (
                <Link to={link.to as "/persistency/rules"} params={link.params as never} search={link.search as never} className="mr-auto text-[13px] text-primary hover:underline">
                  {a.kind === "workflow" || a.kind === "agent" ? "Compare versions" : "Open"}
                </Link>
              )}
              {mine && (
                <>
                  <Button variant="outline" onClick={() => setDialog("return")}>Return</Button>
                  <Button onClick={() => setDialog("approve")} disabled={blockedBySim}>Approve</Button>
                </>
              )}
            </div>
            {mine && blockedBySim && <p className="px-5 pb-4 text-[12px] text-failed">A workflow version needs a passing simulation before approval.</p>}
            <ConfirmDialog
              open={dialog === "approve"}
              onOpenChange={(o) => !o && setDialog(null)}
              title={`Approve ${a.objectName}`}
              body={a.needs.length > 1 ? `Your sign-off is recorded. The change applies once ${a.needs.map((r) => ROLE_NAME[r]).join(" and ")} have both approved.` : "The change applies from the effective date."}
              date
              confirmLabel="Approve"
              onConfirm={(r) => {
                const res = approve(a.id, role!, user!.name, r.date);
                toast.success(res === "approved" ? `Approved: ${a.objectName}` : `Signed off: ${a.objectName}`, { description: res === "approved" ? `Effective ${date(r.date)}` : "Waiting for the other approver." });
              }}
            />
            <ConfirmDialog
              open={dialog === "return"}
              onOpenChange={(o) => !o && setDialog(null)}
              title={`Return ${a.objectName}`}
              body="The author sees your reason on the draft."
              reason="required"
              confirmLabel="Return"
              onConfirm={(r) => {
                ret(a.id, user!.name, r.reason);
                toast.success(`Returned: ${a.objectName}`);
              }}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
