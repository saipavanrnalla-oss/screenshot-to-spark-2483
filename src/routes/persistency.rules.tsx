import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NoteBanner, PageHeader, Panel } from "@/components/ds/primitives";
import { DataGrid, type Column } from "@/components/r1/data-grid";
import { StatusChip, versionTone } from "@/components/r1/status-chip";
import { PageTabs, inputCls } from "@/components/r1/tabs";
import { ConfirmDialog } from "@/components/r1/confirm";
import { GUARDRAIL_LINES, decisionTrace, dimLabel, ruleDiff } from "@/components/r1/rule-model";
import { ruleConditionText } from "@/components/r1/rule-text";
import { PRODUCTS, type Product, type Rule, type RuleThen } from "@/data/persistency";
import { policyDimensions, policyNumbers, ruleMatches, evaluate } from "@/engine/persistency";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { date, dateTime, num } from "@/lib/format";
import { useEngineContext, usePersistencyStore, usePolicies } from "@/store/persistency";
import { seedVersions, useWork } from "@/store/work";
import type { Version } from "@/data/persistency/r1/types";

const search = z.object({
  view: fallback(z.enum(["list", "matrix", "history", "test"]).optional(), undefined),
  policy: fallback(z.string().optional(), undefined),
  cell: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/rules")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("rules", search),
  head: () => ({
    meta: [
      { title: "Rules · Persistency · desible.ai" },
      { name: "description", content: "Rules with conditions, actions, executors, priority, status, versions and policies matched." },
      { property: "og:title", content: "Rules · Persistency · desible.ai" },
      { property: "og:description", content: "Rules with conditions, actions, executors, priority, status, versions and policies matched." },
    ],
  }),
  component: RulesPage,
});

const PRECEDENCE = ["Guardrails", "Insurer defaults", "The rule that matches the most dimensions", "The lower priority number"];

function useMatchCounts(rules: Rule[]) {
  const policies = usePolicies();
  const ctx = useEngineContext();
  return useMemo(() => {
    const counts = new Map<string, number>(rules.map((r) => [r.id, 0]));
    for (const p of policies) {
      const d = policyDimensions(p, ctx);
      const n = policyNumbers(p);
      for (const r of rules) if (ruleMatches(r, d, n)) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
    }
    return counts;
  }, [policies, rules, ctx]);
}

function RulesPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const rules = usePersistencyStore((st) => st.rules);
  const mayEdit = useCan("rules.edit");
  const view = s.view ?? "list";
  const counts = useMatchCounts(rules);
  const versions = useWork((st) => st.versions);

  const draftOf = (id: string) => {
    const list = versions[`rule:${id}`];
    const last = list?.[list.length - 1];
    return last && (last.status === "Draft" || last.status === "In review") ? last : undefined;
  };

  const cols: Column<Rule>[] = [
    { id: "name", label: "Name", value: (r) => r.name, render: (r) => <span className="font-medium text-foreground"><span className="mr-1.5 text-primary">{r.id}</span>{r.name}</span> },
    { id: "cond", label: "Condition summary", value: (r) => ruleConditionText(r), render: (r) => <span className="text-subtle">{ruleConditionText(r)}</span> },
    { id: "action", label: "Action", value: (r) => r.then.action },
    { id: "executor", label: "Executor", value: (r) => r.then.executor },
    { id: "priority", label: "Priority", align: "right", value: (r) => r.priority },
    {
      id: "status",
      label: "Status",
      value: (r) => r.status ?? "Active",
      render: (r) => {
        const d = draftOf(r.id);
        return (
          <span className="flex flex-col items-start gap-1">
            <StatusChip tone={versionTone(r.status ?? "Active")}>{r.status ?? "Active"}</StatusChip>
            {d && (r.status ?? "Active") === "Active" && <span className="text-[11px] text-attention">v{d.no} {d.status.toLowerCase()}</span>}
          </span>
        );
      },
    },
    { id: "version", label: "Version", align: "right", value: (r) => r.version ?? 1, render: (r) => `v${r.version ?? 1}` },
    { id: "matched", label: "Policies matched now", align: "right", value: (r) => counts.get(r.id) ?? 0, render: (r) => num(counts.get(r.id) ?? 0) },
    { id: "changed", label: "Last changed", value: (r) => r.lastChanged ?? r.effectiveFrom, render: (r) => date(r.lastChanged ?? r.effectiveFrom) },
    { id: "level", label: "Level", hidden: true, value: (r) => r.level },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader
        title="Rules"
        meta={`${rules.filter((r) => (r.status ?? "Active") === "Active").length} active · ${rules.filter((r) => r.status === "In review").length} in review · ${rules.filter((r) => r.status === "Retired").length} retired`}
        actions={
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Order of precedence">
                  <Info /> Order of precedence
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 rounded-card border-border bg-popover">
                <p className="text-[13px] font-semibold">Order of precedence</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-subtle">
                  {PRECEDENCE.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </PopoverContent>
            </Popover>
            {mayEdit && (
              <Button asChild size="sm">
                <Link to="/persistency/rules/$id" params={{ id: "new" }}>
                  <Plus /> New rule
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <PageTabs
        label="Rules"
        value={view}
        onChange={(v) => navigate({ search: (p) => ({ ...p, view: v === "list" ? undefined : v, cell: undefined }) })}
        tabs={[
          { id: "list", label: "Rule list" },
          { id: "matrix", label: "Product matrix" },
          { id: "test", label: "Decision test" },
          { id: "history", label: "Version history" },
        ]}
      />
      {view === "list" && (
        <>
          <Panel title="Guardrails no rule can override" bodyClassName="p-0">
            <ul className="grid sm:grid-cols-2 xl:grid-cols-4">
              {GUARDRAIL_LINES.map((g) => (
                <li key={g} className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-[13px] text-subtle">
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />
                  {g}
                </li>
              ))}
            </ul>
          </Panel>
          <DataGrid
            label="Rules"
            columns={cols}
            rows={[...rules].sort((a, b) => (a.level === b.level ? a.priority - b.priority : a.level.localeCompare(b.level)))}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate({ to: "/persistency/rules/$id", params: { id: r.id } })}
            csvName="rules.csv"
            rowClassName={(r) => (r.status === "Retired" ? "opacity-60" : undefined)}
          />
        </>
      )}
      {view === "matrix" && <ProductMatrix />}
      {view === "test" && <DecisionTest />}
      {view === "history" && <VersionHistory />}
    </div>
  );
}

/* ---------- Product matrix ---------- */

const MATRIX_ROWS: { id: string; label: string; field: keyof RuleThen }[] = [
  { id: "treatment", label: "Treatment", field: "action" },
  { id: "script", label: "Script", field: "script" },
  { id: "offers", label: "Offers", field: "offer" },
  { id: "approvals", label: "Approvals", field: "approvals" },
  { id: "executor", label: "Executor", field: "executor" },
];

function ProductMatrix() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const policies = usePolicies();
  const rules = usePersistencyStore((st) => st.rules);
  const ctx = useEngineContext();
  const matrix = useMemo(() => {
    const out: Record<string, Record<Product, { rule?: Rule | undefined; value?: string | undefined; count: number }>> = {};
    const wins: Record<Product, Map<string, number>> = { ULIP: new Map(), Traditional: new Map(), Term: new Map() };
    for (const p of policies) {
      if (p.lifecycleStage !== "Renewal window") continue;
      const d = evaluate(p, rules, ctx);
      wins[p.product].set(d.ruleId, (wins[p.product].get(d.ruleId) ?? 0) + 1);
    }
    for (const row of MATRIX_ROWS) {
      out[row.id] = {} as Record<Product, { rule?: Rule; value?: string; count: number }>;
      for (const prod of PRODUCTS) {
        const ranked = [...wins[prod].entries()].sort((a, b) => b[1] - a[1]);
        const hit = ranked.map(([id, n]) => ({ rule: rules.find((r) => r.id === id), n })).find((x) => x.rule && x.rule.level !== "guardrail" && x.rule.then[row.field]);
        out[row.id]![prod] = { rule: hit?.rule, value: hit?.rule ? String(hit.rule.then[row.field]) : undefined, count: hit?.n ?? 0 };
      }
    }
    return out;
  }, [policies, rules, ctx]);
  const [rowId, prod] = (s.cell ?? "").split(":") as [string, Product];
  const cell = rowId ? matrix[rowId]?.[prod] : undefined;
  return (
    <>
      <div className="overflow-hidden rounded-card border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-card">
            <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              <th className="border-b border-border px-3 py-2 font-medium">Setting</th>
              {PRODUCTS.map((p) => (
                <th key={p} className="border-b border-border px-3 py-2 font-medium">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium">{row.label}</td>
                {PRODUCTS.map((p) => {
                  const c = matrix[row.id]![p];
                  return (
                    <td key={p} className="px-3 py-2">
                      <button type="button" onClick={() => navigate({ search: (x) => ({ ...x, cell: `${row.id}:${p}` }) })} className={`w-full cursor-pointer rounded-input border px-2 py-1.5 text-left hover:border-primary ${s.cell === `${row.id}:${p}` ? "border-primary" : "border-border"}`}>
                        {c.rule ? (
                          <>
                            <span className="block text-foreground">{c.value}</span>
                            <span className="block text-[12px] text-muted-foreground"><span className="text-primary">{c.rule.id}</span> {c.rule.name} · decides {num(c.count)}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No rule sets this</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-muted-foreground">Each cell shows the rule that decides the most policies of that product in the renewal window and sets this field.</p>
      <Sheet open={!!s.cell} onOpenChange={(o) => !o && navigate({ search: (x) => ({ ...x, cell: undefined }) })}>
        <SheetContent side="right" className="w-full border-border bg-background sm:max-w-[420px]">
          <SheetHeader className="text-left">
            <SheetTitle className="text-[16px]">{MATRIX_ROWS.find((r) => r.id === rowId)?.label} · {prod}</SheetTitle>
          </SheetHeader>
          {cell?.rule ? (
            <div className="mt-4 space-y-3 text-[13px]">
              <p className="font-medium"><span className="mr-1.5 text-primary">{cell.rule.id}</span>{cell.rule.name}</p>
              <p className="text-subtle">{ruleConditionText(cell.rule)}</p>
              <p>Value: {cell.value}</p>
              <p className="text-muted-foreground">Decides {num(cell.count)} {prod} policies in the renewal window.</p>
              <Button asChild size="sm"><Link to="/persistency/rules/$id" params={{ id: cell.rule.id }}>Edit rule</Link></Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-[13px]">
              <p className="text-muted-foreground">No rule sets this field for {prod}.</p>
              <Button asChild size="sm"><Link to="/persistency/rules/$id" params={{ id: "new" }}>New rule</Link></Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ---------- Decision test ---------- */

function DecisionTest() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const policies = usePolicies();
  const rules = usePersistencyStore((st) => st.rules);
  const ctx = useEngineContext();
  const [q, setQ] = useState(s.policy ?? "");
  const policy = s.policy ? policies.find((p) => p.policyId === s.policy.trim().toUpperCase()) : undefined;
  const trace = useMemo(() => (policy ? decisionTrace(policy, rules, ctx) : null), [policy, rules, ctx]);
  return (
    <div className="space-y-4">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: (p) => ({ ...p, policy: q.trim().toUpperCase() || undefined }) });
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Policy number, for example SLI02400118" aria-label="Policy number" className={`${inputCls} w-80`} />
        <Button type="submit" size="sm">Test</Button>
      </form>
      {s.policy && !policy && <NoteBanner tone="attention">No policy {s.policy} in the book.</NoteBanner>}
      {policy && trace && (
        <>
          <Panel title={`${policy.policyId} · ${policy.customerName}`}>
            <p className="text-[13px]">
              Winner: {trace.winner ? <Link to="/persistency/rules/$id" params={{ id: trace.winner.id }} className="text-primary hover:underline">{trace.winner.id} {trace.winner.name} (version {trace.winner.version ?? 1})</Link> : "none"}
            </p>
            <p className="mt-1 text-[13px] text-subtle">{trace.reason}</p>
          </Panel>
          <DataGrid
            label="Rules considered"
            rows={trace.rows}
            rowKey={(r) => r.rule.id}
            pageSize={50}
            rowClassName={(r) => (r.rule.id === trace.winner?.id ? "bg-brand-tint" : r.matched ? undefined : "opacity-60")}
            columns={[
              { id: "rule", label: "Rule", value: (r) => r.rule.id, render: (r) => <Link to="/persistency/rules/$id" params={{ id: r.rule.id }} className="text-primary hover:underline">{r.rule.id} {r.rule.name}</Link> },
              { id: "level", label: "Level", value: (r) => r.rule.level },
              { id: "matched", label: "Matched", value: (r) => (r.matched ? "Yes" : "No"), render: (r) => <StatusChip tone={r.matched ? "ok" : "neutral"}>{r.matched ? "Matched" : "Not matched"}</StatusChip> },
              { id: "values", label: "Dimension values on the policy", sortable: false, value: (r) => Object.entries(r.values).map(([k, v]) => `${dimLabel(k)}: ${v}`).join("; "), render: (r) => <span className="text-[12px] text-subtle">{Object.entries(r.values).map(([k, v]) => `${dimLabel(k)}: ${v}`).join(" · ")}</span> },
              { id: "dims", label: "Dimensions", align: "right", value: (r) => r.dims },
              { id: "priority", label: "Priority", align: "right", value: (r) => r.rule.priority },
            ]}
          />
        </>
      )}
    </div>
  );
}

/* ---------- Version history ---------- */

interface HistRow {
  key: string;
  ruleId: string;
  ruleName: string;
  v: Version<Rule>;
  prev?: Version<Rule> | undefined;
}

function VersionHistory() {
  const rules = usePersistencyStore((st) => st.rules);
  const saved = useWork((st) => st.versions);
  const restore = useWork((st) => st.restoreVersion);
  const user = useUser();
  const mayEdit = useCan("rules.edit");
  const navigate = useNavigate();
  const [open, setOpen] = useState<HistRow | null>(null);
  const [confirm, setConfirm] = useState(false);
  const rows = useMemo(() => {
    const out: HistRow[] = [];
    for (const r of rules) {
      const list = (saved[`rule:${r.id}`] ?? seedVersions(`rule:${r.id}`)) as Version<Rule>[];
      if (list.length < 2 && !saved[`rule:${r.id}`]) continue;
      list.forEach((v, i) => out.push({ key: `${r.id}-${v.no}`, ruleId: r.id, ruleName: r.name, v, prev: list[i - 1] }));
    }
    return out.sort((a, b) => (a.v.at < b.v.at ? 1 : -1));
  }, [rules, saved]);
  return (
    <>
      <DataGrid
        label="Rule versions"
        rows={rows}
        rowKey={(r) => r.key}
        onRowClick={setOpen}
        csvName="rule-versions.csv"
        columns={[
          { id: "rule", label: "Rule", value: (r) => `${r.ruleId} ${r.ruleName}` },
          { id: "version", label: "Version", align: "right", value: (r) => r.v.no, render: (r) => `v${r.v.no}` },
          { id: "author", label: "Author", value: (r) => r.v.author },
          { id: "at", label: "Time", value: (r) => r.v.at, render: (r) => dateTime(r.v.at) },
          { id: "note", label: "Change note", value: (r) => r.v.note },
          { id: "status", label: "Status", value: (r) => r.v.status, render: (r) => <StatusChip tone={versionTone(r.v.status)}>{r.v.status}</StatusChip> },
          { id: "approver", label: "Approver", value: (r) => r.v.approver ?? "" },
        ]}
      />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full border-border bg-background sm:max-w-[480px]">
          {open && (
            <div className="space-y-4">
              <SheetHeader className="text-left">
                <SheetTitle className="text-[16px]">{open.ruleId} {open.ruleName} · version {open.v.no}</SheetTitle>
                <p className="text-[12px] text-muted-foreground">{open.v.author} · {dateTime(open.v.at)} · {open.v.status}</p>
              </SheetHeader>
              <p className="text-[13px]">{open.v.note}</p>
              <h3 className="text-[14px] font-semibold">Diff against version {open.prev?.no ?? "none"}</h3>
              <ul className="space-y-1.5 font-mono text-[12px]">
                {ruleDiff(open.prev?.data, open.v.data).map((d, i) => (
                  <li key={i} className="rounded-input border border-border px-2 py-1">{d}</li>
                ))}
              </ul>
              {mayEdit && open.v.status !== "Draft" && <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>Restore as new draft</Button>}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Restore version ${open?.v.no ?? ""}`}
        body="A new Draft is created from this version. The Active version keeps deciding until the draft is approved."
        confirmLabel="Restore"
        onConfirm={() => {
          if (!open) return;
          const no = restore(`rule:${open.ruleId}`, open.v.no, user?.name ?? "User");
          toast.success(`Draft version ${no} created`);
          navigate({ to: "/persistency/rules/$id", params: { id: open.ruleId } });
        }}
      />
    </>
  );
}
