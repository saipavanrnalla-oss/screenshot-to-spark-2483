import { createFileRoute } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, EmptyState, Eyebrow, NoteBanner, PageHeader, Panel, StatusPill } from "@/components/ds/primitives";
import { useScopedPolicies } from "@/hooks/use-shell";
import { NOW_ISO, YESTERDAY_ISO, bounceStage, cohortFileStats, hashId, mandateState, type FileAdapter, type Policy } from "@/data/persistency";
import { useAdapters, useDecisions, usePersistencyStore } from "@/store/persistency";
import { date, num } from "@/lib/format";

export const Route = createFileRoute("/persistency/data")({
  beforeLoad: ({ search }) => gate("data", search),
  head: () => ({
    meta: [
      { title: "Data and integrations · Persistency · desible.ai" },
      { name: "description", content: "File adapters, freshness, rejects and paid-meanwhile suppression for the persistency engine." },
      { property: "og:title", content: "Data and integrations · Persistency · desible.ai" },
      { property: "og:description", content: "File adapters, freshness, rejects and paid-meanwhile suppression for the persistency engine." },
    ],
  }),
  component: DataPage,
});

const FIELDS: Record<string, { target: string; required: boolean }[]> = {
  due_list: [{ target: "Policy number", required: true }, { target: "Due date", required: true }, { target: "Amount", required: true }, { target: "Payment mode", required: true }, { target: "Payment method", required: false }],
  receipts: [{ target: "Policy number", required: true }, { target: "Receipt number", required: true }, { target: "Amount", required: true }, { target: "Paid on", required: true }, { target: "Channel", required: false }],
  bounce_returns: [{ target: "Policy number", required: true }, { target: "Bounce code", required: true }, { target: "Amount", required: true }, { target: "Presented on", required: false }],
  mandate_status: [{ target: "Policy number", required: true }, { target: "Mandate reference", required: true }, { target: "Status", required: true }, { target: "Bank", required: false }],
  advisor_master: [{ target: "Advisor code", required: true }, { target: "Name", required: true }, { target: "Status", required: true }, { target: "Branch", required: false }],
  vendor_dispositions: [{ target: "Policy number", required: true }, { target: "Vendor", required: true }, { target: "Disposition", required: true }, { target: "Called at", required: false }],
  risk_cohorts: [{ target: "Policy number", required: true }, { target: "Cohort label", required: true }, { target: "Score", required: false }, { target: "Scored on", required: false }],
  bureau_fields: [{ target: "Policy number", required: true }, { target: "Bureau score", required: true }, { target: "Active loans", required: false }, { target: "Recent defaults", required: false }],
};

function sampleRows(id: string, policies: Policy[]): { columns: string[]; rows: Record<string, string>[] } {
  const pick = (f: (p: Policy) => boolean) => policies.filter(f).slice(0, 5);
  switch (id) {
    case "due_list":
      return { columns: ["policy_no", "due_date", "amount", "mode", "method"], rows: pick((p) => p.lifecycleStage === "Renewal window").map((p) => ({ policy_no: p.policyId, due_date: p.dueDate, amount: String(p.instalmentAmount), mode: p.paymentMode, method: p.paymentMethod })) };
    case "receipts":
      return { columns: ["policy_no", "receipt_no", "amount", "paid_on", "channel"], rows: pick((p) => p.monthDue?.status === "paid").map((p) => ({ policy_no: p.policyId, receipt_no: `RC${hashId(p.policyId) % 9_000_000 + 1_000_000}`, amount: String(p.monthDue?.amount ?? 0), paid_on: p.monthDue?.paidOn ?? "", channel: p.monthDue?.branchPayment ? "Branch" : p.paymentMethod })) };
    case "bounce_returns":
      return { columns: ["policy_no", "bounce_code", "amount", "presented_on"], rows: pick((p) => p.reasonCode === "Mandate bounce").map((p) => ({ policy_no: p.policyId, bounce_code: bounceStage(p) === "Failed again" ? "R03 account closed" : "R01 insufficient funds", amount: String(p.instalmentAmount), presented_on: p.dueDate })) };
    case "mandate_status":
      return { columns: ["policy_no", "umrn", "status", "bank"], rows: pick((p) => mandateState(p) !== null).map((p) => ({ policy_no: p.policyId, umrn: `UMRN${hashId(p.policyId + "m") % 90_000_000 + 10_000_000}`, status: mandateState(p) ?? "", bank: p.channel === "Bancassurance" ? p.sourceBankOrAdvisor : "Customer bank" })) };
    case "advisor_master":
      return { columns: ["advisor_code", "name", "status", "branch"], rows: pick((p) => p.channel === "Agency").map((p) => ({ advisor_code: p.sourceBankOrAdvisor.match(/AG\d+/)?.[0] ?? "", name: p.sourceBankOrAdvisor.replace(/^Advisor /, "").replace(/ \(AG\d+\)$/, ""), status: p.advisorStatus, branch: p.city })) };
    case "vendor_dispositions":
      return { columns: ["policy_no", "vendor", "disposition", "called_at"], rows: pick((p) => !!p.lastTouch && p.lifecycleStage !== "Warming").map((p) => ({ policy_no: p.policyId, vendor: p.assignedVendor, disposition: p.state === "Promised" ? "Promise to pay" : p.reasonCode === "None" ? "Contacted" : p.reasonCode, called_at: p.lastTouch ?? "" })) };
    case "risk_cohorts": {
      const s = cohortFileStats(policies);
      return { columns: s.columns, rows: s.sample };
    }
    default:
      return { columns: [], rows: [] };
  }
}

function status(a: FileAdapter) {
  if (!a.enabled) return <StatusPill status="simulated">Off</StatusPill>;
  if (a.stale) return <StatusPill status="attention">Late</StatusPill>;
  return <StatusPill status="healthy">On time</StatusPill>;
}

function DataPage() {
  const { scoped } = useScopedPolicies();
  const adapters = useAdapters();
  const markReceived = usePersistencyStore((s) => s.markAdapterReceived);
  const setEnabled = usePersistencyStore((s) => s.setAdapterEnabled);
  const receipts = usePersistencyStore((s) => s.receipts);
  const decisions = useDecisions(scoped);
  const [selected, setSelected] = useState("due_list");
  const [mapping, setMapping] = useState<Record<string, Record<string, string>>>({});
  const adapter = adapters.find((a) => a.id === selected)!;
  const sample = useMemo(() => sampleRows(selected, scoped), [selected, scoped]);
  const fields = FIELDS[selected] ?? [];
  const map = mapping[selected] ?? Object.fromEntries(fields.map((f, i) => [f.target, sample.columns[i] ?? "none"]));
  const unmapped = fields.filter((f) => f.required && (!map[f.target] || map[f.target] === "none"));

  const paidMeanwhile = useMemo(() => {
    let suppressed = 0;
    for (const d of decisions.values()) if (d.cancelledReason === "Paid meanwhile") suppressed++;
    const slipped = scoped.filter((p) => p.monthDue?.branchPayment && (p.monthDue.paidOn === NOW_ISO || p.monthDue.paidOn === YESTERDAY_ISO) && !receipts.includes(p.policyId)).length;
    return { suppressed, slipped };
  }, [decisions, scoped, receipts]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader eyebrow="Data and integrations" title="Files in, actions out" description="Every decision depends on one or more of these files. A late file pauses only the stages that need it." tiers={["simulated"]} />

      {adapters.some((a) => a.stale) && (
        <NoteBanner tone="attention">
          {adapters.filter((a) => a.stale).map((a) => `${a.name} is late (expected by ${a.expectedBy}, last ${a.lastReceived}). ${a.feeds.join(", ")} paused; the Control Tower shows "Decisions paused for stale input" for those stages only.`).join(" ")}
        </NoteBanner>
      )}

      <Panel eyebrow="File adapters" title={`${adapters.length} adapters`} tiers={["simulated"]}>
        <DataTable head={["File", "Direction", "Schedule", "Last received", "Rows", "Rejects", "Feeds", "Status", ""]} minWidth={1000}>
          {adapters.map((a) => (
            <tr key={a.id} className={a.stale ? "!bg-attention/10" : ""}>
              <td><button type="button" onClick={() => setSelected(a.id)} className="cursor-pointer font-semibold text-foreground hover:text-primary">{a.name}</button>{a.optional && <span className="ml-1.5 text-[10px] text-muted-foreground">optional</span>}</td>
              <td className="text-subtle">{a.direction}</td>
              <td className="text-subtle">{a.schedule}</td>
              <td className="text-subtle tabular">{a.lastReceived}</td>
              <td className="text-subtle tabular">{num(a.rows)}</td>
              <td className="text-subtle tabular">{num(a.rejects)}</td>
              <td className="text-[11px] text-subtle">{a.feeds.join(", ") || "Cohorts"}</td>
              <td>{status(a)}</td>
              <td className="whitespace-nowrap">
                {a.stale && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { markReceived(a.id); toast(`${a.name} marked as received`, { description: "Paused decisions resume from the next run." }); }}>Simulate arrival</Button>}
                {a.optional && <Switch aria-label={`Turn ${a.name} ${a.enabled ? "off" : "on"}`} checked={a.enabled} onCheckedChange={(on) => { setEnabled(a.id, on); if (a.id === "bureau_fields") toast(on ? "Bureau fields on" : "Bureau fields off", { description: on ? "Bureau signals can now be weighted in the starter score." : "Bureau signals are greyed out in the starter score." }); }} />}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel
          eyebrow="Sample file"
          title={`${adapter.name}: first 5 rows`}
          tiers={["simulated"]}
          actions={
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger aria-label="Pick a file" className="h-8 w-52 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-border bg-card">{adapters.map((a) => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}</SelectContent>
            </Select>
          }
        >
          {sample.rows.length === 0 ? (
            <EmptyState title={adapter.enabled ? "No rows in this file yet." : "This adapter is off. Turn it on above to receive and map the file."} />
          ) : (
            <DataTable head={sample.columns} minWidth={560}>
              {sample.rows.map((r, i) => <tr key={i}>{sample.columns.map((c) => <td key={c} className="whitespace-nowrap text-subtle tabular">{r[c]}</td>)}</tr>)}
            </DataTable>
          )}
        </Panel>

        <Panel eyebrow="Column mapper" title={adapter.name} tiers={["simulated"]}>
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.target} className="grid grid-cols-[1fr_170px] items-center gap-3">
                <span className="text-xs text-foreground">{f.target} <span className="text-[11px] text-muted-foreground">{f.required ? "required" : "optional"}</span></span>
                <Select value={map[f.target] ?? "none"} onValueChange={(v) => setMapping((m) => ({ ...m, [selected]: { ...map, [f.target]: v } }))}>
                  <SelectTrigger aria-label={`Column for ${f.target}`} className="h-8 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="none" className="text-xs">Not mapped</SelectItem>
                    {sample.columns.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="mt-3">{unmapped.length === 0 ? <StatusPill status="healthy">All required fields mapped</StatusPill> : <StatusPill status="attention">Map {unmapped.map((f) => f.target.toLowerCase()).join(", ")}</StatusPill>}</div>
          <p className="mt-2 text-[11px] text-dim">Expected by {adapter.expectedBy}. Rejected rows go back in a reject file with the reason.</p>
        </Panel>
      </div>

      <Panel eyebrow="Paid meanwhile" title="Receipts checked before every action" tiers={["live-engine", "simulated"]}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel accent-left px-4 py-3">
            <div className="stat-number">{num(paidMeanwhile.suppressed)}</div>
            <div className="stat-label">outreach actions suppressed today because a receipt arrived</div>
          </div>
          <div className="panel accent-left px-4 py-3">
            <div className="stat-number">{num(paidMeanwhile.slipped)}</div>
            <div className="stat-label">could slip through: branch payments made since yesterday, receipt not yet in the file</div>
          </div>
          <div className="space-y-1.5 text-xs text-subtle">
            <p>Payments show in the next morning's receipts file. Branch payments arrive a day later still, so those customers can be contacted after paying.</p>
            <p>Receipts file last received {date(NOW_ISO)} 07:05.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
