import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, NoteBanner, Panel } from "@/components/ds/primitives";
import { DataGrid, type Column } from "@/components/r1/data-grid";
import { StatusChip } from "@/components/r1/status-chip";
import { Field, PageTabs, selectCls } from "@/components/r1/tabs";
import { PolicyActions } from "@/components/r1/policy-actions";
import { WhyHere, useNextStep } from "@/components/r1/policy-panel";
import { isOnHold, policyStatus, statusTone } from "@/components/r1/policy-model";
import { DIMENSION_LABEL, type DimensionKey } from "@/data/persistency";
import { seedActivity, paymentHistory, attemptsUsed } from "@/data/persistency/r1/activity";
import { TRANSCRIPTS, THREADS } from "@/data/persistency/r1/tasks";
import { mandateState } from "@/data/persistency/derived";
import type { ActivityRow } from "@/data/persistency/r1/types";
import { daysToDue, evaluate } from "@/engine/persistency";
import { gate } from "@/lib/gate";
import { date, dateTime, inr } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { useEngineContext, usePersistencyStore, usePolicy } from "@/store/persistency";
import { useWork } from "@/store/work";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const search = z.object({
  tab: fallback(z.enum(["overview", "activity", "contacts", "payments"]).optional(), undefined),
  row: fallback(z.string().optional(), undefined),
  executor: fallback(z.string().optional(), undefined),
  result: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/policies_/$id")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("policies", search),
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} · Policies · desible.ai` },
      { name: "description", content: "Policy facts, next step, activity history, contacts and payments." },
      { property: "og:title", content: `${params.id} · Policies · desible.ai` },
      { property: "og:description", content: "Policy facts, next step, activity history, contacts and payments." },
    ],
  }),
  component: PolicyPage,
});

export function usePolicyActivity(policyId: string): ActivityRow[] {
  const policy = usePolicy(policyId);
  const added = useWork((s) => s.activity[policyId]);
  const pauses = useWork((s) => s.agentPause);
  return useMemo(() => {
    if (!policy) return [];
    const seeded = seedActivity(policy);
    return [...(added ?? []), ...seeded].filter((r) => {
      // Tasks of a paused agent after the pause time do not run.
      const id = r.executor === "Renewal voice agent" ? "renewal-voice" : r.executor === "Message agent" ? "message" : null;
      const p = id ? pauses[id] : undefined;
      return !p || r.at < p.at || r.executorKind !== "agent";
    });
  }, [policy, added, pauses]);
}

function PolicyPage() {
  const { id } = Route.useParams();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const policy = usePolicy(id);
  const next = useNextStep(id);
  const activity = usePolicyActivity(id);
  const hold = useWork((st) => st.holds[id]);
  const tab = s.tab ?? "overview";

  if (!policy || !next) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4">
        <EmptyState title={`No policy ${id} in the book.`} action={<Link to="/persistency/policies" className="text-[13px] text-primary">Back to Policies</Link>} />
      </div>
    );
  }
  const status = policyStatus(policy);
  const dtd = daysToDue(policy);
  const contacts = activity.filter((r) => r.channel === "Voice" || r.channel === "WhatsApp" || r.channel === "SMS");
  const mandate = mandateState(policy);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <Link to="/persistency/policies" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> Policies
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] font-semibold text-foreground tabular">{policy.policyId}</h1>
            <StatusChip tone={statusTone(status)}>{status}</StatusChip>
          </div>
          <p className="mt-1 text-[13px] text-subtle">
            {policy.customerName} · {policy.product} · {inr(policy.instalmentAmount)} {policy.paymentMode.toLowerCase()} · due {date(policy.dueDate)}
          </p>
        </div>
        <PolicyActions policy={policy} />
      </div>
      {hold && <NoteBanner tone="failed">On hold since {dateTime(hold.at)}: {hold.reason}{hold.note ? `. ${hold.note}` : ""} (by {hold.by})</NoteBanner>}

      <PageTabs
        label="Policy"
        value={tab}
        onChange={(t) => navigate({ search: (p) => ({ ...p, tab: t, row: undefined }) })}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "activity", label: "Activity", count: activity.length },
          { id: "contacts", label: "Contacts", count: contacts.length },
          { id: "payments", label: "Payments" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Panel title="Policy facts">
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Product">{policy.product}</Field>
              <Field label="Policy year">{policy.policyYear}</Field>
              <Field label="Annual premium">{inr(policy.annualisedPremium)}</Field>
              <Field label="Premium and mode">{inr(policy.instalmentAmount)} {policy.paymentMode}</Field>
              <Field label="Payment method">{policy.paymentMethod}</Field>
              <Field label="Mandate state">{mandate ?? "No mandate"}</Field>
              <Field label="Cohort">{policy.insurerCohort}</Field>
              <Field label="Stage">{policy.lifecycleStage}</Field>
              <Field label={dtd >= 0 ? "Days to due" : "Days overdue"}>{Math.abs(dtd)}</Field>
              <Field label="Grace ends">{date(policy.graceEnd)}</Field>
              <Field label="Hold flags">{isOnHold(policy) ? policy.state : "None"}</Field>
              <Field label="Advisor">{policy.sourceBankOrAdvisor} ({policy.advisorStatus})</Field>
              <Field label="Channel">{policy.channel}</Field>
              <Field label="City and language">{policy.city}, {policy.language}</Field>
              <Field label="Contacts in 30 days">{policy.touchesLast30d}</Field>
              <Field label="Last contact">{policy.lastTouch ? `${date(policy.lastTouch)} (${policy.lastTouchChannel})` : "None"}</Field>
            </dl>
          </Panel>
          <div className="space-y-4">
            <Panel title="Open journey and next step">
              <p className="text-[13px] text-foreground">{next.decision.workflowId ? `${next.decision.workflowId} · ` : ""}{next.decision.action}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Owner: {next.owner} · deadline {dateTime(next.decision.scheduledAt)}</p>
              {next.decision.cancelledReason && <p className="mt-1 text-[12px] text-attention">Cancelled: {next.decision.cancelledReason}</p>}
              {next.decision.frozen && <p className="mt-1 text-[12px] text-failed">Outreach stopped</p>}
            </Panel>
            <Panel title="Why this policy is here">
              <WhyHere policyId={policy.policyId} />
            </Panel>
          </div>
        </div>
      )}

      {tab === "activity" && <ActivityTab rows={activity} policyId={id} />}

      {tab === "contacts" && (
        <DataGrid
          label="Contacts"
          rows={contacts}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate({ search: (p) => ({ ...p, tab: "activity", row: r.id }) })}
          columns={[
            { id: "at", label: "Time", value: (r) => r.at, render: (r) => dateTime(r.at) },
            { id: "channel", label: "Channel", value: (r) => r.channel ?? "" },
            { id: "executor", label: "Executor", value: (r) => r.executor },
            { id: "disp", label: "Disposition", value: (r) => r.disposition ?? r.result },
            { id: "reason", label: "Reason", value: (r) => r.reason ?? "" },
            { id: "dur", label: "Duration", align: "right", value: (r) => r.durationSec ?? 0, render: (r) => (r.durationSec ? `${Math.floor(r.durationSec / 60)}m ${r.durationSec % 60}s` : "") },
            { id: "lang", label: "Language", value: (r) => r.language ?? "" },
            { id: "tr", label: "Transcript", sortable: false, value: (r) => (r.transcriptId || r.threadId ? "Open" : ""), render: (r) => (r.transcriptId || r.threadId ? <span className="text-primary">Open</span> : <span className="text-muted-foreground">None</span>) },
          ]}
          emptyText="No calls or messages yet."
        />
      )}

      {tab === "payments" && <PaymentsTab policyId={id} />}
    </div>
  );
}

function ActivityTab({ rows, policyId }: { rows: ActivityRow[]; policyId: string }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const executors = [...new Set(rows.map((r) => r.executor))].sort();
  const results = [...new Set(rows.map((r) => r.result))].sort();
  const filtered = rows.filter((r) => (!s.executor || r.executor === s.executor) && (!s.result || r.result === s.result));
  const open = rows.find((r) => r.id === s.row);
  const columns: Column<ActivityRow>[] = [
    { id: "at", label: "Time", value: (r) => r.at, render: (r) => <span className="tabular">{dateTime(r.at)}</span> },
    { id: "step", label: "Step", value: (r) => r.step },
    { id: "executor", label: "Executor", value: (r) => `${r.executor}${r.version ? ` ${r.version}` : ""}` },
    { id: "result", label: "Result", value: (r) => r.result },
    { id: "rule", label: "Rule that fired", value: (r) => r.ruleId ?? "", render: (r) => (r.ruleId ? <span className="text-primary">{r.ruleId}</span> : <span className="text-muted-foreground">None</span>) },
    { id: "wf", label: "Workflow", hidden: true, value: (r) => r.workflow ?? "" },
  ];
  return (
    <div className="space-y-3">
      <DataGrid
        label="Activity"
        rows={filtered}
        rowKey={(r) => r.id}
        columns={columns}
        activeKey={s.row}
        onRowClick={(r) => navigate({ search: (p) => ({ ...p, row: r.id }) })}
        toolbar={
          <>
            <select aria-label="Filter by executor" value={s.executor ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, executor: e.target.value || undefined }) })} className={selectCls}>
              <option value="">Executor: all</option>
              {executors.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
            <select aria-label="Filter by result" value={s.result ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, result: e.target.value || undefined }) })} className={selectCls}>
              <option value="">Result: all</option>
              {results.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => downloadCsv(`activity-${policyId}.csv`, ["Time", "Step", "Executor", "Version", "Result", "Rule", "Workflow", "Reason"], rows.map((r) => [r.at, r.step, r.executor, r.version, r.result, r.ruleId, r.workflow, r.reason]))}
            >
              <Download /> Export history
            </Button>
          </>
        }
        emptyText="No activity matches these filters."
      />
      <ActivityDetail row={open ?? null} onClose={() => navigate({ search: (p) => ({ ...p, row: undefined }) })} />
    </div>
  );
}

function ActivityDetail({ row, onClose }: { row: ActivityRow | null; onClose: () => void }) {
  const policy = usePolicy(row?.policyId ?? null);
  const rules = usePersistencyStore((s) => s.rules);
  const ctx = useEngineContext();
  const rule = row?.ruleId ? rules.find((r) => r.id === row.ruleId) : undefined;
  const d = useMemo(() => (policy ? evaluate(policy, rules, ctx) : null), [policy, rules, ctx]);
  const transcript = TRANSCRIPTS.find((t) => t.id === row?.transcriptId);
  const thread = THREADS.find((t) => t.id === row?.threadId);
  const matched = row?.matched ?? (d && rule && d.ruleId === rule.id ? d.matchedDimensions : rule ? Object.fromEntries(Object.entries(rule.when).map(([k, v]) => [k, (v ?? []).join(", ")])) : {});
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="scrollbar-prism w-full overflow-y-auto border-border bg-background p-0 sm:max-w-[420px]">
        {row && (
          <div>
            <SheetHeader className="border-b border-border px-5 py-4 text-left">
              <SheetTitle className="text-[16px] font-semibold">{row.step}</SheetTitle>
              <p className="text-[12px] text-muted-foreground">{dateTime(row.at)} · {row.executor}{row.version ? ` ${row.version}` : ""}</p>
            </SheetHeader>
            <section className="space-y-2 border-b border-border px-5 py-4">
              <h3 className="text-[14px] font-semibold">Task packet</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Workflow">{row.workflow ?? "None"}</Field>
                <Field label="Channel">{row.channel ?? "None"}</Field>
                <Field label="Script and version">{row.scriptVersion ?? "None"}</Field>
                <Field label="Language">{row.language ?? "None"}</Field>
                <Field label="Allowed offers">{row.offers?.join(", ") ?? "None"}</Field>
                <Field label="Disposition">{row.disposition ?? row.result}</Field>
                <Field label="Reason">{row.reason ?? "None"}</Field>
                {row.linkedTo && <Field label="Linked task">{row.linkedTo}</Field>}
              </dl>
            </section>
            {(transcript || thread) && (
              <section className="space-y-2 border-b border-border px-5 py-4">
                <h3 className="text-[14px] font-semibold">{transcript ? "Transcript" : "Message"}</h3>
                <ol className="space-y-2">
                  {transcript?.turns.map((t, i) => (
                    <li key={i} className="text-[13px]">
                      <span className="text-[12px] font-medium text-muted-foreground">{t.speaker}</span>
                      <p className="text-foreground">{t.text}</p>
                      {t.tag && <span className="mt-0.5 inline-block rounded-pill border border-primary/50 px-2 text-[11px] text-primary">{t.tag}</span>}
                    </li>
                  ))}
                  {thread?.messages.map((m, i) => (
                    <li key={i} className="text-[13px]">
                      <span className="text-[12px] font-medium text-muted-foreground">{m.from}{m.status ? ` · ${m.status}` : ""}</span>
                      <p className="text-foreground">{m.text.replace("{policy}", row.policyId).replace("{due}", policy ? date(policy.dueDate) : "")}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <section className="space-y-2 border-b border-border px-5 py-4">
              <h3 className="text-[14px] font-semibold">Rule that fired</h3>
              {rule ? (
                <>
                  <p className="text-[13px]"><span className="mr-1.5 text-primary">{rule.id}</span>{rule.name} · version {rule.version ?? 1}</p>
                  <ul className="space-y-1 text-[13px]">
                    {Object.entries(matched).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{DIMENSION_LABEL[k as DimensionKey] ?? k}</span>
                        <span className="text-right">{String(v)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">No rule. This row was recorded by a person or a file.</p>
              )}
            </section>
            <section className="space-y-2 px-5 py-4">
              <h3 className="text-[14px] font-semibold">Guardrail checks passed</h3>
              {row.checks?.length ? (
                <ul className="space-y-1 text-[13px]">
                  {row.checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">No customer contact on this row.</p>
              )}
              <p className="pt-2 text-[12px] text-muted-foreground">Activity rows cannot be edited or deleted.</p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PaymentsTab({ policyId }: { policyId: string }) {
  const policy = usePolicy(policyId)!;
  const rows = paymentHistory(policy);
  const used = attemptsUsed(policy);
  const nextDebit = policy.paymentMethod === "NACH/ECS mandate" || policy.paymentMethod === "UPI autopay" ? date(policy.dueDate) : "No auto-debit";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="Attempts used"><p className="text-[24px] font-semibold tabular">{used} of 4</p><p className="text-[12px] text-muted-foreground">contact attempts this stage</p></Panel>
        <Panel title="Next debit date"><p className="text-[24px] font-semibold">{nextDebit}</p></Panel>
        <Panel title="Mandate"><p className="text-[24px] font-semibold">{mandateState(policy) ?? "None"}</p></Panel>
      </div>
      <DataGrid
        label="Payments"
        rows={rows}
        rowKey={(r) => `${r.date}-${r.kind}-${r.detail}`}
        columns={[
          { id: "date", label: "Date", value: (r) => r.date, render: (r) => date(r.date) },
          { id: "kind", label: "Type", value: (r) => r.kind, render: (r) => <StatusChip tone={r.kind === "Bounce" ? "off" : r.kind === "Receipt" ? "ok" : "neutral"}>{r.kind}</StatusChip> },
          { id: "amount", label: "Amount", align: "right", value: (r) => r.amount ?? 0, render: (r) => (r.amount ? inr(r.amount) : "") },
          { id: "detail", label: "Detail", value: (r) => r.detail },
        ]}
        emptyText="No payments recorded."
      />
    </div>
  );
}
