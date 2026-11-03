import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Lock, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoteBanner, Panel } from "@/components/ds/primitives";
import { EditFooter } from "@/components/r1/edit-footer";
import { StatusChip, versionTone } from "@/components/r1/status-chip";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { ACTION_TYPES, EXECUTOR_OPTIONS, guardrailConflict, hasConditions, nextRuleId, ruleDiff, sameDimsConflict, workflowOptions } from "@/components/r1/rule-model";
import { rowText, toRows } from "@/components/r1/rule-text";
import { DIMENSIONS, NOW_ISO, PRODUCTS, STAGES, CHANNELS, type ConditionOp, type ConditionRow, type DimensionKey, type Policy, type Rule } from "@/data/persistency";
import { conditionMatches, isLive, policyDimensions, policyNumbers, ruleMatches, type PolicyNumbers } from "@/engine/persistency";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { date, inr, num } from "@/lib/format";
import { useEngineContext, usePersistencyStore, usePolicies } from "@/store/persistency";
import { useVersions, useWork } from "@/store/work";

export const Route = createFileRoute("/persistency/rules_/$id")({
  beforeLoad: ({ search }) => gate("rules", search),
  head: ({ params }) => ({
    meta: [
      { title: `${params.id === "new" ? "New rule" : `Rule ${params.id}`} · Rules · desible.ai` },
      { name: "description", content: "Rule editor: conditions, action, executor, priority, impact and conflicts." },
      { property: "og:title", content: `${params.id === "new" ? "New rule" : `Rule ${params.id}`} · Rules · desible.ai` },
      { property: "og:description", content: "Rule editor: conditions, action, executor, priority, impact and conflicts." },
    ],
  }),
  component: RuleEditorPage,
});

const OPS: ConditionOp[] = ["is", "is not", "is any of", "above", "below", "between", "within N days of"];
const NUMERIC: Partial<Record<DimensionKey, string>> = { ticketBand: "₹", policyYear: "years", touchHistory: "touches" };

interface Evaluated {
  p: Policy;
  dims: ReturnType<typeof policyDimensions>;
  nums: PolicyNumbers;
}

function blankRule(id: string): Rule {
  return {
    id,
    name: "",
    stage: "Renewal window",
    level: "rule",
    priority: 50,
    when: {},
    conds: [[]],
    then: { workflowId: "R1", action: "", executor: "Message agent", delayHours: 4 },
    effectiveFrom: "2026-11-01",
    needsApprovalFrom: "Head of Persistency",
    source: "Insurer rule",
    status: "Draft",
    version: 1,
  };
}

/** Editing works on condition rows; seeded when-maps turn into rows. */
function editable(rule: Rule): Rule {
  if (!Object.values(rule.when).some((v) => v && v.length)) return { ...rule, conds: rule.conds?.length ? rule.conds : [[]] };
  return { ...rule, when: {}, conds: toRows(rule) };
}

function RuleEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const user = useUser();
  const mayEdit = useCan("rules.edit");
  const rules = usePersistencyStore((s) => s.rules);
  const upsertRule = usePersistencyStore((s) => s.upsertRule);
  const newWorkflows = useWork((s) => s.newWorkflows);
  const saveDraft = useWork((s) => s.saveDraft);
  const discardDraft = useWork((s) => s.discardDraft);
  const submit = useWork((s) => s.submit);
  const isNew = id === "new";
  const [newId] = useState(() => nextRuleId(rules));
  const ruleId = isNew ? newId : id;
  const stored = rules.find((r) => r.id === ruleId);
  const versions = useVersions<Rule>(`rule:${ruleId}`);
  const last = versions[versions.length - 1];
  const savedDraft = last && last.status === "Draft" ? last : undefined;
  const inReview = versions.find((v) => v.status === "In review");
  const base = useMemo(() => editable(savedDraft?.data ?? stored ?? blankRule(ruleId)), [savedDraft, stored, ruleId]);
  const [draft, setDraft] = useState<Rule>(base);
  const [checkOpen, setCheckOpen] = useState(false);
  const [actionType, setActionType] = useState<(typeof ACTION_TYPES)[number]>("Start a workflow");
  useEffect(() => setDraft(base), [base]);

  const locked = !mayEdit || !!stored?.locked || !!inReview || stored?.level === "guardrail";
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const deferred = useDeferredValue(draft);

  const policies = usePolicies();
  const ctx = useEngineContext();
  const evaluated: Evaluated[] = useMemo(() => policies.map((p) => ({ p, dims: policyDimensions(p, ctx), nums: policyNumbers(p) })), [policies, ctx]);

  const impact = useMemo(() => {
    const matched: Evaluated[] = [];
    for (const e of evaluated) if (ruleMatches(deferred, e.dims, e.nums)) matched.push(e);
    const by = (f: (p: Policy) => string) => {
      const m = new Map<string, number>();
      for (const e of matched) m.set(f(e.p), (m.get(f(e.p)) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const rowCounts = (deferred.conds ?? []).map((g) => g.map((row) => evaluated.filter((e) => conditionMatches(row, e.dims, e.nums)).length));
    return { matched, stage: by((p) => p.lifecycleStage), product: by((p) => p.product), channel: by((p) => p.channel), rowCounts };
  }, [evaluated, deferred]);

  const setGroups = (conds: ConditionRow[][]) => setDraft((d) => ({ ...d, conds }));
  const groups = draft.conds ?? [[]];
  const setRow = (gi: number, ri: number, patch: Partial<ConditionRow>) => setGroups(groups.map((g, i) => (i === gi ? g.map((r, j) => (j === ri ? { ...r, ...patch } : r)) : g)));

  const author = user?.name ?? "User";
  const doSave = () => {
    const no = saveDraft(`rule:${ruleId}`, draft, author, isNew ? "New rule" : "Rule change");
    if (!stored) upsertRule({ ...draft, status: "Draft", version: no, lastChanged: NOW_ISO });
    toast.success(`Saved as draft version ${no}`);
    if (isNew) setTimeout(() => navigate({ to: "/persistency/rules/$id", params: { id: ruleId } }), 60);
    return no;
  };
  const doSubmit = () => {
    if (!draft.name.trim()) return void toast.error("Give the rule a name.");
    if (!draft.then.action.trim()) return void toast.error("Describe the action.");
    const g = guardrailConflict(draft);
    if (g) return void toast.error("This rule contradicts a guardrail and cannot be activated.", { description: g });
    const clash = sameDimsConflict(draft, rules);
    if (clash) return void toast.error(`${clash.id} is Active with the same dimensions and priority.`, { description: "Change the priority or the conditions." });
    const no = savedDraft && !dirty ? savedDraft.no : saveDraft(`rule:${ruleId}`, draft, author, isNew ? "New rule" : "Rule change");
    if (!stored || stored.status === "Draft") upsertRule({ ...draft, status: "In review", version: no, lastChanged: NOW_ISO });
    const noConds = !hasConditions(draft);
    const overlaps = overlapList(draft, rules, impact.matched);
    submit({
      kind: "rule",
      objectId: ruleId,
      objectName: draft.name,
      versionNo: no,
      requestedBy: author,
      summary: `Rule change, reaches ${num(impact.matched.length)} policies`,
      reach: impact.matched.length,
      diff: ruleDiff(stored && isLive(stored) ? stored : undefined, draft),
      conflicts: overlaps.slice(0, 3).map((o) => `Shares ${num(o.n)} policies with ${o.rule.id} ${o.rule.name}`),
      needs: noConds ? ["head"] : ["head"],
      secondApproverReason: noConds ? "The rule has no conditions" : undefined,
    });
    toast.success(`Version ${no} sent for review`, { description: noConds ? "No conditions: a second approver is needed." : "Waiting for Head of Persistency." });
    if (isNew) setTimeout(() => navigate({ to: "/persistency/rules/$id", params: { id: ruleId } }), 60);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <Link to="/persistency/rules" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> Rules
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[20px] font-semibold text-foreground">{isNew ? "New rule" : `${ruleId} ${stored?.name ?? ""}`}</h1>
        {stored && <StatusChip tone={versionTone(stored.status ?? "Active")}>{stored.status ?? "Active"} · v{stored.version ?? 1}</StatusChip>}
        {savedDraft && <StatusChip tone="risk">Draft v{savedDraft.no}</StatusChip>}
        {inReview && <StatusChip tone="risk">v{inReview.no} in review</StatusChip>}
        {stored?.approver && <span className="text-[12px] text-muted-foreground">Approved by {stored.approver}</span>}
      </div>
      {savedDraft?.returnReason && <NoteBanner tone="attention">Returned: {savedDraft.returnReason}</NoteBanner>}
      {inReview && <NoteBanner>Version {inReview.no} is waiting for approval. The editor opens again after a decision.</NoteBanner>}
      {stored?.locked && <NoteBanner><Lock className="mr-1 inline size-3.5" />Guardrail. It cannot be edited.</NoteBanner>}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel title="Rule">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-[12px] font-medium text-muted-foreground md:col-span-2">
                Name
                <input disabled={locked} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${inputCls} mt-1`} aria-label="Rule name" />
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground md:col-span-2">
                Description
                <input disabled={locked} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
            </div>
          </Panel>

          <Panel title="Conditions" actions={!locked && <Button size="sm" variant="outline" onClick={() => setGroups([...groups, []])}><Plus /> Add OR group</Button>}>
            <div className="space-y-3">
              {groups.map((g, gi) => (
                <div key={gi} className="space-y-2">
                  {gi > 0 && <p className="text-[12px] font-semibold text-primary">OR</p>}
                  <div className="space-y-2 rounded-card border border-border p-3">
                    {g.length === 0 && <p className="text-[13px] text-muted-foreground">No conditions in this group yet.</p>}
                    {g.map((row, ri) => (
                      <ConditionEditor key={ri} row={row} count={impact.rowCounts[gi]?.[ri]} locked={locked} first={ri === 0} onChange={(p) => setRow(gi, ri, p)} onRemove={() => setGroups(groups.map((x, i) => (i === gi ? x.filter((_, j) => j !== ri) : x)))} />
                    ))}
                    {!locked && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setGroups(groups.map((x, i) => (i === gi ? [...x, { dim: "channel" as DimensionKey, op: "is" as ConditionOp, values: [] }] : x)))}>
                          <Plus /> Add condition
                        </Button>
                        {groups.length > 1 && (
                          <Button size="sm" variant="ghost" onClick={() => setGroups(groups.filter((_, i) => i !== gi))}>
                            <Trash2 /> Remove group
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Action">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-[12px] font-medium text-muted-foreground">
                Action
                <select disabled={locked} value={actionType} onChange={(e) => setActionType(e.target.value as (typeof ACTION_TYPES)[number])} className={`${selectCls} mt-1 w-full`}>
                  {ACTION_TYPES.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Workflow
                <select disabled={locked} value={draft.then.workflowId} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, workflowId: e.target.value } })} className={`${selectCls} mt-1 w-full`} aria-label="Workflow">
                  {workflowOptions(newWorkflows).map((w) => (
                    <option key={w.code} value={w.code}>{w.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground md:col-span-2">
                Treatment
                <input disabled={locked} value={draft.then.action} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, action: e.target.value } })} className={`${inputCls} mt-1`} aria-label="Treatment" placeholder="For example: e-NACH link on WhatsApp, then a call" />
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Executor
                <select disabled={locked} value={draft.then.executor} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, executor: e.target.value } })} className={`${selectCls} mt-1 w-full`} aria-label="Executor">
                  {[...new Set([...EXECUTOR_OPTIONS, draft.then.executor])].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Priority (1 to 999)
                <input disabled={locked} type="number" min={1} max={999} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Math.min(999, Math.max(1, Math.round(Number(e.target.value) || 1))) })} className={`${inputCls} mt-1 tabular`} aria-label="Priority" />
              </label>
              {(actionType === "Select script version" || draft.then.script) && (
                <label className="block text-[12px] font-medium text-muted-foreground">
                  Script version
                  <input disabled={locked} value={draft.then.script ?? ""} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, script: e.target.value || undefined } })} className={`${inputCls} mt-1`} />
                </label>
              )}
              {(actionType === "Allow or block offers" || draft.then.offer) && (
                <label className="block text-[12px] font-medium text-muted-foreground">
                  Offers
                  <input disabled={locked} value={draft.then.offer ?? ""} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, offer: e.target.value || undefined } })} className={`${inputCls} mt-1`} />
                </label>
              )}
              {(actionType === "Set approval" || draft.then.approvals) && (
                <label className="block text-[12px] font-medium text-muted-foreground">
                  Approval
                  <input disabled={locked} value={draft.then.approvals ?? ""} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, approvals: e.target.value || undefined } })} className={`${inputCls} mt-1`} />
                </label>
              )}
              {(actionType === "Route handoff" || draft.then.handoff) && (
                <label className="block text-[12px] font-medium text-muted-foreground">
                  Handoff route
                  <input disabled={locked} value={draft.then.handoff ?? ""} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, handoff: e.target.value || undefined } })} className={`${inputCls} mt-1`} />
                </label>
              )}
              {(actionType === "Set target" || draft.then.target) && (
                <label className="block text-[12px] font-medium text-muted-foreground">
                  Target
                  <input disabled={locked} value={draft.then.target ?? ""} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, target: e.target.value || undefined } })} className={`${inputCls} mt-1`} />
                </label>
              )}
              {(actionType === "Exclude" || draft.then.exclusions) && (
                <label className="block text-[12px] font-medium text-muted-foreground">
                  Exclude
                  <input disabled={locked} value={draft.then.exclusions ?? ""} onChange={(e) => setDraft({ ...draft, then: { ...draft.then, exclusions: e.target.value || undefined } })} className={`${inputCls} mt-1`} />
                </label>
              )}
              <label className="block text-[12px] font-medium text-muted-foreground">
                Effective from
                <input disabled={locked} type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Effective to
                <input disabled={locked} type="date" value={draft.effectiveTo ?? ""} onChange={(e) => setDraft({ ...draft, effectiveTo: e.target.value || undefined })} className={`${inputCls} mt-1`} />
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground md:col-span-2">
                Notes
                <textarea disabled={locked} rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="mt-1 block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px]" />
              </label>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title="Live impact" actions={<Button size="sm" variant="outline" onClick={() => setCheckOpen(true)}>Check</Button>}>
            <p className="text-[24px] font-semibold text-foreground tabular">{num(impact.matched.length)}</p>
            <p className="text-[12px] text-muted-foreground">matches {num(impact.matched.length)} policies</p>
            {(
              [
                ["By stage", impact.stage],
                ["By product", impact.product],
                ["By channel", impact.channel],
              ] as const
            ).map(([label, list]) => (
              <div key={label} className="mt-3">
                <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
                <ul className="mt-1 space-y-0.5 text-[13px]">
                  {list.slice(0, 5).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-subtle">{k}</span><span className="tabular">{num(v)}</span></li>
                  ))}
                  {list.length === 0 && <li className="text-muted-foreground">None</li>}
                </ul>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      {mayEdit && !locked && (
        <EditFooter
          dirty={dirty}
          onSave={doSave}
          onDiscard={() => {
            if (savedDraft && !dirty) {
              discardDraft(`rule:${ruleId}`);
              toast.success("Draft discarded");
            } else setDraft(base);
          }}
          onSubmit={doSubmit}
          submitDisabled={!draft.name.trim()}
        />
      )}

      <CheckDialog open={checkOpen} onOpenChange={setCheckOpen} draft={deferred} rules={rules} matched={impact.matched} onNarrow={(row) => setGroups(groups.map((g, i) => (i === 0 ? [...g, row] : g)))} onPriority={(p) => setDraft({ ...draft, priority: p })} locked={locked} />
    </div>
  );
}

function ConditionEditor({ row, count, locked, first, onChange, onRemove }: { row: ConditionRow; count?: number | undefined; locked: boolean; first: boolean; onChange: (p: Partial<ConditionRow>) => void; onRemove: () => void }) {
  const dim = DIMENSIONS.find((d) => d.key === row.dim)!;
  const numeric = row.op === "above" || row.op === "below" || row.op === "between";
  const multi = row.op === "is any of" || row.op === "is not";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-9 text-[12px] font-semibold text-muted-foreground">{first ? "When" : "AND"}</span>
      <select disabled={locked} value={row.dim} onChange={(e) => onChange({ dim: e.target.value as DimensionKey, values: [] })} className={selectCls} aria-label="Dimension">
        {DIMENSIONS.map((d) => (
          <option key={d.key} value={d.key}>{d.label}</option>
        ))}
      </select>
      <select disabled={locked} value={row.op} onChange={(e) => onChange({ op: e.target.value as ConditionOp, ...(e.target.value === "within N days of" ? { values: ["due date"], n: row.n ?? 30 } : {}) })} className={selectCls} aria-label="Operator">
        {OPS.filter((o) => (o === "above" || o === "below" || o === "between" ? !!NUMERIC[row.dim] : true)).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {row.op === "within N days of" ? (
        <>
          <input disabled={locked} type="number" value={row.n ?? 30} onChange={(e) => onChange({ n: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} w-20 tabular`} aria-label="Days" />
          <span className="text-[13px] text-subtle">days of due date</span>
        </>
      ) : numeric ? (
        <>
          <input disabled={locked} type="number" value={row.n ?? ""} onChange={(e) => onChange({ n: Number(e.target.value) || 0 })} className={`${inputCls} w-32 tabular`} aria-label="Value" />
          {row.op === "between" && <input disabled={locked} type="number" value={row.n2 ?? ""} onChange={(e) => onChange({ n2: Number(e.target.value) || 0 })} className={`${inputCls} w-32 tabular`} aria-label="Upper value" />}
          <span className="text-[12px] text-muted-foreground">{NUMERIC[row.dim]}{row.dim === "ticketBand" && row.n ? ` ${inr(row.n)}` : ""}</span>
        </>
      ) : multi ? (
        <div className="flex flex-wrap gap-1">
          {dim.values.map((v) => (
            <button key={v} type="button" disabled={locked} onClick={() => onChange({ values: row.values.includes(v) ? row.values.filter((x) => x !== v) : [...row.values, v] })} className={`rounded-pill border px-2 py-0.5 text-[12px] ${row.values.includes(v) ? "border-primary text-foreground" : "border-border text-subtle"}`}>
              {v}
            </button>
          ))}
        </div>
      ) : (
        <select disabled={locked} value={row.values[0] ?? ""} onChange={(e) => onChange({ values: e.target.value ? [e.target.value] : [] })} className={selectCls} aria-label="Value">
          <option value="">Choose a value</option>
          {dim.values.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      )}
      <span className="ml-auto text-[12px] text-muted-foreground tabular">{count === undefined ? "" : `${num(count)} policies`}</span>
      {!locked && (
        <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove ${rowText(row)}`} onClick={onRemove}>
          <X />
        </Button>
      )}
    </div>
  );
}

function overlapList(draft: Rule, rules: Rule[], matched: Evaluated[]) {
  return rules
    .filter((r) => r.id !== draft.id && isLive(r) && r.level !== "guardrail")
    .map((r) => ({ rule: r, n: matched.filter((e) => ruleMatches(r, e.dims, e.nums)).length }))
    .filter((o) => o.n > 0)
    .sort((a, b) => b.n - a.n);
}

function CheckDialog({ open, onOpenChange, draft, rules, matched, onNarrow, onPriority, locked }: { open: boolean; onOpenChange: (o: boolean) => void; draft: Rule; rules: Rule[]; matched: Evaluated[]; onNarrow: (r: ConditionRow) => void; onPriority: (p: number) => void; locked: boolean }) {
  const overlaps = useMemo(() => (open ? overlapList(draft, rules, matched) : []), [open, draft, rules, matched]);
  const top = overlaps[0];
  const suggestion = useMemo((): ConditionRow | null => {
    if (!top) return null;
    const mine = new Set([...(draft.conds ?? []).flat().map((r) => r.dim), ...Object.keys(draft.when)]);
    const theirs: [DimensionKey, string[]][] = [...(Object.entries(top.rule.when) as [DimensionKey, string[]][]), ...(top.rule.conds ?? []).flat().filter((r) => r.op === "is" || r.op === "is any of").map((r) => [r.dim, r.values] as [DimensionKey, string[]])];
    const pick = theirs.find(([k, v]) => !mine.has(k) && v.length);
    return pick ? { dim: pick[0], op: "is not", values: pick[1] } : null;
  }, [top, draft]);
  const sample = matched.slice(0, 25);
  const count = (f: (p: Policy) => string, keys: readonly string[]) => keys.map((k) => [k, matched.filter((e) => f(e.p) === k).length] as const);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-card border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold">Impact and conflict check</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ["Stage", count((p) => p.lifecycleStage, STAGES)],
              ["Product", count((p) => p.product, PRODUCTS)],
              ["Channel", count((p) => p.channel, CHANNELS)],
            ] as const
          ).map(([label, list]) => (
            <div key={label}>
              <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
              <ul className="mt-1 space-y-0.5 text-[13px]">
                {list.map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span className="text-subtle">{k}</span><span className="tabular">{num(v)}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[13px] font-semibold">Overlaps with other rules</p>
          {overlaps.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No overlaps.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[13px]">
              {overlaps.slice(0, 5).map((o) => (
                <li key={o.rule.id} className="flex justify-between gap-3"><span><span className="text-primary">{o.rule.id}</span> {o.rule.name} · priority {o.rule.priority}</span><span className="tabular">{num(o.n)} shared policies</span></li>
              ))}
            </ul>
          )}
          {top && (
            <NoteBanner tone="attention" className="mt-2">
              <p>Recommended: {suggestion ? `narrow the conditions so ${top.rule.id} keeps its ${num(top.n)} policies (add "${rowText(suggestion)}")` : `change the priority to decide the tie with ${top.rule.id}`}.</p>
              {!locked && (
                <div className="mt-2 flex gap-2">
                  {suggestion && <Button size="sm" onClick={() => onNarrow(suggestion)}>Narrow</Button>}
                  <Button size="sm" variant="outline" onClick={() => onPriority(Math.max(1, top.rule.priority - 1))}>Set priority {Math.max(1, top.rule.priority - 1)}</Button>
                </div>
              )}
            </NoteBanner>
          )}
        </div>
        <div>
          <p className="text-[13px] font-semibold">Sample of {sample.length} policies</p>
          <table className="mt-1 w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1">Policy</th><th>Product</th><th>Stage</th><th>Channel</th><th>Cohort</th><th>Due</th></tr>
            </thead>
            <tbody>
              {sample.map((e) => (
                <tr key={e.p.policyId} className="border-t border-border/60"><td className="py-1 tabular">{e.p.policyId}</td><td>{e.p.product}</td><td>{e.p.lifecycleStage}</td><td>{e.p.channel}</td><td>{e.p.insurerCohort}</td><td>{date(e.p.dueDate)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
