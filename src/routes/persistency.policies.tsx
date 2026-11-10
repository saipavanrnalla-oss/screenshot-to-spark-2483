import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ds/primitives";
import { DataGrid, type Column } from "@/components/r1/data-grid";
import { FilterBar } from "@/components/r1/filter-bar";
import { ConfirmDialog } from "@/components/r1/confirm";
import { StatusChip } from "@/components/r1/status-chip";
import { PolicyPanel } from "@/components/r1/policy-panel";
import { OWNER_OPTIONS, addToVisitList } from "@/components/r1/policy-actions";
import { BOARD_COLUMNS, COHORTS, METHOD_FILTER, POLICY_STATUSES, matchesFilters, policyStatus, statusTone, useStagedPolicies, type BoardPolicy, type PolicyFilters } from "@/components/r1/policy-model";
import { CHANNELS, PRODUCTS, REGIONS } from "@/data/persistency";
import { HOLD_REASONS, branchOf, type HoldReason } from "@/data/persistency/r1/common";
import { evaluate } from "@/engine/persistency";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { date, dateTime, inr, num } from "@/lib/format";
import { useEngineContext, usePersistencyStore } from "@/store/persistency";
import { useWork } from "@/store/work";
import { propensityLabel } from "@/data/persistency/r1/common";

const opt = () => fallback(z.string().optional(), undefined);
const search = z.object({
  stage: opt(), product: opt(), channel: opt(), region: opt(), branch: opt(), cohort: opt(), method: opt(), status: opt(), due: opt(), hold: opt(), ticket: opt(), q: opt(), policy: opt(),
});

export const Route = createFileRoute("/persistency/policies")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("policies", search),
  head: () => ({
    meta: [
      { title: "Policies · Persistency · desible.ai" },
      { name: "description", content: "Every policy with its stage, cohort, payment method, status, next step and owner." },
      { property: "og:title", content: "Policies · Persistency · desible.ai" },
      { property: "og:description", content: "Every policy with its stage, cohort, payment method, status, next step and owner." },
    ],
  }),
  component: PoliciesPage,
});

const FILTER_KEYS = ["stage", "product", "channel", "region", "branch", "cohort", "method", "status", "due", "hold"] as const;

function PoliciesPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const staged = useStagedPolicies();
  const rules = usePersistencyStore((st) => st.rules);
  const ctx = useEngineContext();
  const owners = useWork((st) => st.owners);
  const placeHold = useWork((st) => st.placeHold);
  const assignOwner = useWork((st) => st.assignOwner);
  const user = useUser();
  const mayHold = useCan("policies.hold");
  const mayAct = useCan("policies.act");
  const [query, setQuery] = useState(s.q ?? "");
  const [bulk, setBulk] = useState<{ kind: "hold" | "owner" | "visit"; ids: string[]; clear: () => void } | null>(null);

  const filters: PolicyFilters = Object.fromEntries(FILTER_KEYS.map((k) => [k, s[k]]));
  const branches = useMemo(() => [...new Set(staged.map((b) => branchOf(b.p)))].sort(), [staged]);

  const rows = useMemo(() => {
    const term = (s.q ?? "").trim().toLowerCase();
    return staged.filter((bp) => matchesFilters(bp, filters) && (!term || bp.p.policyId.toLowerCase().includes(term) || bp.p.customerName.toLowerCase().includes(term)));
  }, [staged, JSON.stringify(filters), s.q]);

  const decisions = useMemo(() => new Map(rows.map((bp) => [bp.p.policyId, evaluate(bp.p, rules, ctx)])), [rows, rules, ctx]);

  const columns: Column<BoardPolicy>[] = [
    { id: "policy", label: "Policy number", value: (r) => r.p.policyId, render: (r) => <span className="font-medium text-foreground tabular">{r.p.policyId}</span> },
    { id: "customer", label: "Customer", value: (r) => r.p.customerName },
    { id: "product", label: "Product", value: (r) => r.p.product },
    { id: "premium", label: "Premium and mode", align: "right", value: (r) => r.p.instalmentAmount, render: (r) => <span>{inr(r.p.instalmentAmount)} <span className="text-muted-foreground">{r.p.paymentMode}</span></span> },
    { id: "due", label: "Due date", value: (r) => r.p.dueDate, render: (r) => date(r.p.dueDate) },
    { id: "grace", label: "Grace end", value: (r) => r.p.graceEnd, render: (r) => date(r.p.graceEnd) },
    { id: "stage", label: "Stage", value: (r) => r.stage },
    { id: "cohort", label: "Propensity", value: (r) => propensityLabel(r.p) },
    { id: "method", label: "Payment method", value: (r) => r.p.paymentMethod },
    { id: "status", label: "Status", value: (r) => policyStatus(r.p), render: (r) => <StatusChip tone={statusTone(policyStatus(r.p))}>{policyStatus(r.p)}</StatusChip> },
    { id: "last", label: "Last contact", value: (r) => r.p.lastTouch ?? "", render: (r) => (r.p.lastTouch ? date(r.p.lastTouch) : "None") },
    { id: "next", label: "Next step", value: (r) => decisions.get(r.p.policyId)?.action ?? "", render: (r) => { const d = decisions.get(r.p.policyId); return d ? <span><span className="mr-1 text-primary">{d.ruleId}</span>{d.action}</span> : null; } },
    { id: "owner", label: "Owner executor", value: (r) => owners[r.p.policyId] ?? decisions.get(r.p.policyId)?.executor ?? "" },
    { id: "deadline", label: "Next step deadline", hidden: true, value: (r) => decisions.get(r.p.policyId)?.scheduledAt ?? "", render: (r) => { const d = decisions.get(r.p.policyId); return d ? dateTime(d.scheduledAt) : ""; } },
    { id: "channel", label: "Channel", hidden: true, value: (r) => r.p.channel },
    { id: "region", label: "Region", hidden: true, value: (r) => r.p.region },
    { id: "branch", label: "Branch", hidden: true, value: (r) => branchOf(r.p) },
  ];

  const by = user?.name ?? "User";

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader title="Policy 360" meta={`${num(rows.length)} of ${num(staged.length)} policies`} />
      <FilterBar
        page="policies"
        fields={[
          { id: "stage", label: "Stage", options: BOARD_COLUMNS },
          { id: "product", label: "Product", options: PRODUCTS },
          { id: "channel", label: "Channel", options: CHANNELS },
          { id: "region", label: "Region", options: REGIONS },
          { id: "branch", label: "Branch", options: branches },
          { id: "cohort", label: "Cohort", options: COHORTS },
          { id: "method", label: "Payment method", options: METHOD_FILTER },
          { id: "status", label: "Status", options: POLICY_STATUSES },
          { id: "hold", label: "On hold", options: ["Yes", "No"] },
          { id: "due", label: "Due", type: "range" },
        ]}
        values={filters}
        onChange={(v) => navigate({ search: (p) => ({ ...p, ...Object.fromEntries(FILTER_KEYS.map((k) => [k, v[k]])) }) })}
      />
      <DataGrid
        label="Policies"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.p.policyId}
        activeKey={s.policy}
        onRowClick={(r) => navigate({ search: (p) => ({ ...p, policy: r.p.policyId }) })}
        selectable
        csvName="policies.csv"
        toolbar={
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ search: (p) => ({ ...p, q: query || undefined }) });
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Policy number or customer" aria-label="Find a policy" className="h-8 w-64 rounded-input border border-border bg-surface-translucent pl-8 pr-2 text-[13px]" />
          </form>
        }
        bulkActions={(ids, clear) => (
          <>
            {mayHold && <Button size="sm" variant="outline" className="h-7" onClick={() => setBulk({ kind: "hold", ids, clear })}>Place on hold</Button>}
            {mayAct && <Button size="sm" variant="outline" className="h-7" onClick={() => setBulk({ kind: "owner", ids, clear })}>Assign owner</Button>}
            {mayAct && <Button size="sm" variant="outline" className="h-7" onClick={() => setBulk({ kind: "visit", ids, clear })}>Add to visit list</Button>}
            <span className="text-[12px] text-muted-foreground">Export CSV writes the selected rows</span>
          </>
        )}
      />
      <ConfirmDialog
        open={bulk?.kind === "hold"}
        onOpenChange={(o) => !o && setBulk(null)}
        title={`Place ${num(bulk?.ids.length ?? 0)} policies on hold`}
        body="All outreach stops and open tasks for these policies are cancelled."
        choices={HOLD_REASONS}
        reason="optional"
        reasonLabel="Note"
        confirmLabel="Place on hold"
        destructive
        onConfirm={(r) => {
          let n = 0;
          for (const id of bulk?.ids ?? []) n += placeHold(id, r.choice as HoldReason, r.reason, by);
          toast.success(`${num(bulk?.ids.length ?? 0)} policies on hold`, { description: `${n} open tasks cancelled` });
          bulk?.clear();
        }}
      />
      <ConfirmDialog
        open={bulk?.kind === "owner"}
        onOpenChange={(o) => !o && setBulk(null)}
        title={`Assign owner to ${num(bulk?.ids.length ?? 0)} policies`}
        choices={OWNER_OPTIONS}
        choiceLabel="Owner executor"
        confirmLabel="Assign"
        onConfirm={(r) => {
          assignOwner(bulk?.ids ?? [], r.choice, by);
          toast.success(`Owner set to ${r.choice}`);
          bulk?.clear();
        }}
      />
      <ConfirmDialog
        open={bulk?.kind === "visit"}
        onOpenChange={(o) => !o && setBulk(null)}
        title={`Add ${num(bulk?.ids.length ?? 0)} policies to a visit list`}
        body="A visit list for the sales officer is created in Data files."
        confirmLabel="Create list"
        onConfirm={() => {
          const id = addToVisitList(bulk?.ids ?? [], by, "Policies list");
          toast.success(`Visit list ${id} created`);
          bulk?.clear();
        }}
      />
      <PolicyPanel policyId={s.policy ?? null} onClose={() => navigate({ search: (p) => ({ ...p, policy: undefined }) })} />
    </div>
  );
}
