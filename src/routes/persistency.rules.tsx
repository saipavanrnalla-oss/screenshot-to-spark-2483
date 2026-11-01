import { createFileRoute } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Lock, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip, Eyebrow, NoteBanner, PageHeader, Panel, StatusPill } from "@/components/ds/primitives";
import { useScopedPolicies, useShell } from "@/hooks/use-shell";
import {
  DIMENSIONS,
  DIMENSION_LABEL,
  PRODUCTS,
  RULE_SETTINGS,
  STAGE_COLUMNS,
  WORKFLOWS,
  stageColumn,
  workflowById,
  type DimensionKey,
  type Policy,
  type Product,
  type Rule,
  type RuleLevel,
  type StageColumn,
} from "@/data/persistency";
import { LEVEL_LABEL, dimensionCount, evaluate, policyDimensions, ruleMatches } from "@/engine/persistency";
import { useEngineContext, usePersistencyStore } from "@/store/persistency";
import { date, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/persistency/rules")({
  beforeLoad: ({ search }) => gate("rules", search),
  head: () => ({
    meta: [
      { title: "Rules · Persistency · desible.ai" },
      { name: "description", content: "Rules by product, policy year, payment mode, channel, cohort and more, with precedence and conflicts." },
      { property: "og:title", content: "Rules · Persistency · desible.ai" },
      { property: "og:description", content: "Rules by product, policy year, payment mode, channel, cohort and more, with precedence and conflicts." },
    ],
  }),
  component: ConfigurationPage,
});

const EXECUTORS = ["Call-centre vendor (fixed payout)", "Call-centre vendor (variable payout)", "WhatsApp vendor", "Voice bot vendor", "Desible", "Sales officer", "Bank relationship manager", "High-value desk", "Retention desk", "Call-centre vendor (fixed payout) + Underwriting", "None"];
const APPROVERS = ["Head of Persistency", "Compliance", "Regional lead", "Underwriting", "Ops / remittance", "Bank partner manager"];
const GROUPS: (StageColumn | "Any")[] = ["Any", ...STAGE_COLUMNS];
const LEVEL_STATUS: Record<RuleLevel, "failed" | "attention" | "live"> = { guardrail: "failed", insurer: "attention", rule: "live" };
const LEVEL_SHORT: Record<RuleLevel, string> = { guardrail: "Guardrail", insurer: "Insurer default", rule: "Rule" };

type SettingKey = "action" | "script" | "offer" | "approvals" | "contactRule" | "executor" | "handoff" | "target" | "exclusions";
const SETTING_FIELDS: { setting: (typeof RULE_SETTINGS)[number]; key: SettingKey }[] = [
  { setting: "Treatment", key: "action" },
  { setting: "Scripts and templates", key: "script" },
  { setting: "Offers", key: "offer" },
  { setting: "Approvals required", key: "approvals" },
  { setting: "Contact rules", key: "contactRule" },
  { setting: "Executor routing", key: "executor" },
  { setting: "Handoff rules", key: "handoff" },
  { setting: "Targets and alerts", key: "target" },
  { setting: "Exclusions", key: "exclusions" },
];

const MATRIX_NOTES: Record<Product, Partial<Record<StageColumn, string>>> = {
  ULIP: { Warming: "Fund value and lock-in content; starts a month earlier", "Renewal window": "Fund value in every reminder", "Lapse and revival": "Partial withdrawal shown as an alternative" },
  Traditional: { Warming: "Mandate readiness for cash and branch payers", "Renewal window": "Field visits for cheque and cash", "Lapse and revival": "Bonus loss explained" },
  Term: { Warming: "Short, low-touch messages", "Renewal window": "One WhatsApp, no call", "Lapse and revival": "Health declaration path on late revival" },
};

function nextRuleId(rules: Rule[], pendingIds: string[]): string {
  const nums = [...rules.map((r) => r.id), ...pendingIds].map((id) => Number(id.replace(/\D/g, ""))).filter((n) => !Number.isNaN(n));
  return `R${Math.max(18, ...nums) + 1}`;
}

function ConfigurationPage() {
  const { scoped } = useScopedPolicies();
  const { persona } = useShell();
  const rules = usePersistencyStore((s) => s.rules);
  const pending = usePersistencyStore((s) => s.pending);
  const propose = usePersistencyStore((s) => s.propose);
  const approve = usePersistencyStore((s) => s.approve);
  const reject = usePersistencyStore((s) => s.reject);
  const ctx = useEngineContext();

  const [selectedId, setSelectedId] = useState<string>("R03");
  const selected = rules.find((r) => r.id === selectedId) ?? pending.find((p) => p.rule.id === selectedId)?.rule ?? null;
  const [draft, setDraft] = useState<Rule | null>(selected);
  const [addDim, setAddDim] = useState<DimensionKey | "">("");

  const select = (r: Rule) => { setSelectedId(r.id); setDraft(structuredClone(r)); };

  const deferredDraft = useDeferredValue(draft);

  // Who this affects: winners under current rules vs with the draft applied.
  const impact = useMemo(() => {
    if (!deferredDraft) return null;
    const withDraft = rules.some((r) => r.id === deferredDraft.id) ? rules.map((r) => (r.id === deferredDraft.id ? deferredDraft : r)) : [...rules, deferredDraft];
    let nowWins = 0, draftWins = 0, matches = 0;
    const byProduct: Record<Product, number> = { ULIP: 0, Traditional: 0, Term: 0 };
    const overlap = new Map<string, number>();
    const peers = withDraft.filter((r) => r.id !== deferredDraft.id && r.level === deferredDraft.level && dimensionCount(r) === dimensionCount(deferredDraft) && r.priority === deferredDraft.priority);
    for (const p of scoped) {
      const dims = policyDimensions(p, ctx);
      const m = ruleMatches(deferredDraft, dims);
      if (m) {
        matches++;
        for (const peer of peers) if (ruleMatches(peer, dims)) overlap.set(peer.id, (overlap.get(peer.id) ?? 0) + 1);
      }
      if (evaluate(p, rules, ctx).ruleId === deferredDraft.id) nowWins++;
      if (m && evaluate(p, withDraft, ctx).ruleId === deferredDraft.id) {
        draftWins++;
        byProduct[p.product]++;
      }
    }
    return { nowWins, draftWins, matches, byProduct, conflicts: [...overlap.entries()].map(([id, n]) => ({ id, n })) };
  }, [deferredDraft, rules, scoped, ctx]);

  const changed = !!draft && !!selected && JSON.stringify(draft) !== JSON.stringify(selected);
  const isNew = !!draft && !rules.some((r) => r.id === draft.id);

  const saveDraft = () => {
    if (!draft) return;
    propose({
      id: `PC-${draft.id}-${Date.now() % 100000}`,
      title: `${isNew ? "New rule" : "Edit"} ${draft.id}: ${draft.name}`,
      source: "Rule edit",
      proposedBy: persona.label,
      at: new Date().toISOString(),
      rule: draft,
      effect: impact ? `Would decide ${num(impact.draftWins)} policies in this view (now ${num(impact.nowWins)})` : undefined,
    });
    toast("Sent for approval", { description: `${draft.id} waits for ${draft.needsApprovalFrom}. Nothing changes until it is approved.` });
  };

  const setWhen = (k: DimensionKey, vals: string[] | undefined) =>
    setDraft((d) => {
      if (!d) return d;
      const when = { ...d.when };
      if (vals === undefined) delete when[k];
      else when[k] = vals;
      return { ...d, when };
    });

  const setThen = (k: SettingKey, v: string) =>
    setDraft((d) => (d ? { ...d, then: { ...d.then, [k]: v || undefined, ...(k === "action" || k === "executor" ? { [k]: v } : {}) } } : d));

  const pendingIds = pending.map((p) => p.rule.id);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <PageHeader
        title="Rules"
        description="Every rule matches on any of 17 dimensions and sets any of 9 settings. The rule that fired is always shown on the policy."
        tiers={["live-engine"]}
      />

      <Panel eyebrow="Precedence" title="How the engine picks one rule" tiers={["live-engine"]} bodyClassName="p-0">
        <ol className="grid md:grid-cols-4">
          {[
            ["Guardrails always win", "Locked. Holds, contact caps, free-look, wants-out and paid policies."],
            ["Insurer defaults", "Your standing rules, for example bank-sourced policies go to the RM first."],
            ["The rule matching the most dimensions", "A rule on product, mode and year beats a rule on product alone."],
            ["Priority number breaks ties", "Lower number wins. A remaining tie is logged as a conflict."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 border-border px-5 py-4 max-md:border-b md:border-r md:last:border-r-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-tint-border bg-brand-tint text-[11px] font-bold text-primary">{i + 1}</span>
              <span>
                <span className="block text-[13px] font-bold text-foreground">{t}</span>
                <span className="block text-xs text-subtle">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">Every decision logs the rule and the matched dimension values.</p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr] 2xl:grid-cols-[280px_1fr_340px]">
        {/* Rule list */}
        <Panel eyebrow={`${rules.length} rules`} title="Rules by stage" bodyClassName="p-0" className="lg:row-span-2 2xl:row-span-1">
          <div className="scrollbar-prism max-h-[760px] overflow-y-auto py-2">
            <div className="px-3 pb-2">
              <Button
                size="sm"
                variant="tint"
                className="w-full"
                onClick={() => {
                  const r: Rule = {
                    id: nextRuleId(rules, pendingIds),
                    name: "New rule",
                    stage: "Renewal window",
                    level: "rule",
                    priority: 50,
                    when: { stage: ["Renewal window"] },
                    then: { workflowId: "R1", action: "WhatsApp reminder with payment link", executor: "WhatsApp vendor", delayHours: 4 },
                    effectiveFrom: "2026-11-01",
                    needsApprovalFrom: "Head of Persistency",
                    source: "Insurer rule",
                  };
                  setSelectedId(r.id);
                  setDraft(r);
                }}
              >
                <Plus /> New rule
              </Button>
            </div>
            {GROUPS.map((g) => {
              const list = rules.filter((r) => r.stage === g).sort((a, b) => a.level.localeCompare(b.level) || a.priority - b.priority);
              if (!list.length) return null;
              return (
                <div key={g} className="mb-2">
                  <Eyebrow className="px-4 py-1.5">{g === "Any" ? "Any stage" : g}</Eyebrow>
                  <ul>
                    {list.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => select(r)}
                          className={cn("flex w-full cursor-pointer items-start gap-2 border-l-[3px] px-4 py-2 text-left transition-colors", r.id === selectedId ? "border-primary bg-brand-tint" : "border-transparent hover:bg-surface-translucent")}
                        >
                          <span className="mt-0.5 w-8 shrink-0 text-[10px] font-bold text-primary">{r.id}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-foreground">{r.name}</span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              {r.locked && <Lock className="size-2.5" aria-label="Locked" />}
                              {LEVEL_SHORT[r.level]} · P{r.priority} · {dimensionCount(r)} dims
                              {pendingIds.includes(r.id) && <span className="text-attention"> · change waiting</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Editor */}
        <Panel
          eyebrow={draft ? `${isNew ? "New rule" : "Rule"} ${draft.id}` : "Rule editor"}
          title={draft ? draft.name : "Pick a rule"}
          tiers={["live-engine"]}
          actions={draft && <StatusPill status={LEVEL_STATUS[draft.level]}>{LEVEL_LABEL[draft.level]}</StatusPill>}
        >
          {!draft ? (
            <p className="text-sm text-subtle">Pick a rule on the left or add a new one.</p>
          ) : draft.locked ? (
            <div className="space-y-4">
              <NoteBanner tone="failed"><Lock className="mr-1 inline size-3.5" /> Guardrail, locked. It always wins and cannot be edited here. Compliance changes guardrails on the Guardrails page.</NoteBanner>
              <RuleSummary rule={draft} />
            </div>
          ) : (
            <div className="space-y-5">
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Name</span>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs" />
              </label>

              <section>
                <Eyebrow>When</Eyebrow>
                <div className="mt-2 space-y-3">
                  {(Object.keys(draft.when) as DimensionKey[]).map((k) => {
                    const dim = DIMENSIONS.find((d) => d.key === k)!;
                    const vals = draft.when[k] ?? [];
                    return (
                      <div key={k} className="rounded-input border border-border bg-surface-translucent p-2.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{dim.label}</span>
                          <Button variant="ghost" size="icon" className="size-6" aria-label={`Remove ${dim.label}`} onClick={() => setWhen(k, undefined)}><X className="size-3" /></Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {dim.values.map((v) => (
                            <Chip key={v} active={vals.includes(v)} onClick={() => setWhen(k, vals.includes(v) ? vals.filter((x) => x !== v) : [...vals, v])}>{v}</Chip>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2">
                    <Select value={addDim} onValueChange={(v) => { setWhen(v as DimensionKey, []); setAddDim(""); }}>
                      <SelectTrigger aria-label="Add a dimension" className="h-8 w-56 rounded-input border-border bg-surface-translucent text-xs"><SelectValue placeholder="Add a dimension" /></SelectTrigger>
                      <SelectContent className="border-border bg-card">
                        {DIMENSIONS.filter((d) => !(d.key in draft.when)).map((d) => <SelectItem key={d.key} value={d.key} className="text-xs">{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <span className="text-[11px] text-muted-foreground">{dimensionCount(draft)} of 17 dimensions used</span>
                  </div>
                </div>
              </section>

              <section>
                <Eyebrow>Then</Eyebrow>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] text-muted-foreground">Workflow</span>
                    <Select value={draft.then.workflowId} onValueChange={(v) => setDraft({ ...draft, then: { ...draft.then, workflowId: v } })}>
                      <SelectTrigger className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="border-border bg-card">
                        {WORKFLOWS.map((w) => <SelectItem key={w.id} value={w.id} className="text-xs">{w.id} {w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  {SETTING_FIELDS.map(({ setting, key }) =>
                    key === "executor" ? (
                      <label key={key} className="block">
                        <span className="text-[11px] text-muted-foreground">{setting}</span>
                        <Select value={draft.then.executor} onValueChange={(v) => setThen("executor", v)}>
                          <SelectTrigger className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="border-border bg-card">
                            {EXECUTORS.map((e) => <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </label>
                    ) : (
                      <label key={key} className="block">
                        <span className="text-[11px] text-muted-foreground">{setting}{key === "action" && " (action)"}</span>
                        <Input
                          value={(draft.then[key] as string | undefined) ?? ""}
                          placeholder="Not set"
                          onChange={(e) => setThen(key, e.target.value)}
                          className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs"
                        />
                      </label>
                    ),
                  )}
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-4">
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Level</span>
                  <Select value={draft.level} onValueChange={(v) => setDraft({ ...draft, level: v as RuleLevel })}>
                    <SelectTrigger className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="insurer" className="text-xs">Insurer default</SelectItem>
                      <SelectItem value="rule" className="text-xs">Rule</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Priority</span>
                  <Input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs tabular" />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Effective from</span>
                  <Input type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs" />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Needs approval from</span>
                  <Select value={draft.needsApprovalFrom} onValueChange={(v) => setDraft({ ...draft, needsApprovalFrom: v })}>
                    <SelectTrigger className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      {APPROVERS.map((a) => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              </section>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button size="sm" disabled={!changed && !isNew} onClick={saveDraft}><Send /> Save as pending change</Button>
                <Button size="sm" variant="outline" disabled={!changed} onClick={() => selected && setDraft(structuredClone(selected))}>Discard</Button>
                <span className="text-[11px] text-muted-foreground">Saving creates a pending change. It goes live only when {draft.needsApprovalFrom} approves it.</span>
              </div>
            </div>
          )}
        </Panel>

        {/* Who this affects + conflicts */}
        <div className="space-y-6 lg:col-start-2 2xl:col-start-auto">
          <Panel eyebrow="Who this affects" title="Live count" tiers={["live-engine"]}>
            {!impact || !draft ? (
              <p className="text-sm text-subtle">Pick a rule to see who it affects.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="panel accent-left px-3 py-2.5">
                    <div className="stat-number">{num(impact.nowWins)}</div>
                    <div className="stat-label">decided by this rule now</div>
                  </div>
                  <div className="panel accent-left px-3 py-2.5">
                    <div className="stat-number">{num(impact.draftWins)}</div>
                    <div className="stat-label">{changed || isNew ? "with your edit" : "same as now"}</div>
                  </div>
                </div>
                <p className="text-xs text-subtle">
                  {num(impact.matches)} policies match its conditions. {num(impact.matches - impact.draftWins)} of those are decided by a higher-precedence rule.
                </p>
                <ul className="space-y-1 text-xs">
                  {PRODUCTS.map((p) => (
                    <li key={p} className="flex justify-between"><span className="text-subtle">{p}</span><span className="font-semibold text-foreground tabular">{num(impact.byProduct[p])}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel eyebrow="Conflict check" title="Same level, same weight" tiers={["live-engine"]}>
            {!impact || !draft ? null : impact.conflicts.length === 0 ? (
              <StatusPill status="healthy">No conflicts at this level and priority</StatusPill>
            ) : (
              <ul className="space-y-2">
                {impact.conflicts.map((c) => {
                  const other = rules.find((r) => r.id === c.id);
                  return (
                    <li key={c.id} className="rounded-input border border-attention/40 bg-attention/10 p-3">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground"><AlertTriangle className="size-3.5 text-attention" /> {draft.id} and {c.id} could both match {num(c.n)} policies</p>
                      <p className="mt-0.5 text-xs text-subtle">{other?.name}. Same level, {dimensionCount(draft)} dimensions each, priority {draft.priority}. Pick a priority so one wins.</p>
                      {!draft.locked && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => setDraft({ ...draft, priority: draft.priority - 1 })}>
                          Make {draft.id} win (priority {draft.priority - 1})
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel eyebrow="Approvals" title={`${pending.length} pending changes`} tiers={["live-engine"]}>
            {pending.length === 0 ? (
              <p className="text-xs text-subtle">Nothing waiting.</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((c) => (
                  <li key={c.id} className="rounded-input border border-border bg-surface-translucent p-2.5">
                    <p className="text-xs font-semibold text-foreground">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">{c.source} · waits for {c.rule.needsApprovalFrom}</p>
                    {persona.id === "head" ? (
                      <div className="mt-2 flex gap-1.5">
                        <Button size="sm" className="h-7 text-[11px]" onClick={() => { approve(c.id); toast(`Approved: ${c.title}`); }}><Check /> Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => reject(c.id)}><X /> Reject</Button>
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-subtle">Switch to Head of Persistency to approve.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <ProductMatrix policies={scoped} />
    </div>
  );
}

function RuleSummary({ rule }: { rule: Rule }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(rule.when) as [DimensionKey, string[]][]).map(([k, v]) => (
          <Chip key={k} active><span className="text-muted-foreground">{DIMENSION_LABEL[k]}:</span> {v.join(", ")}</Chip>
        ))}
      </div>
      <p className="text-subtle">Then: <span className="font-semibold text-foreground">{rule.then.action}</span> via {rule.then.executor} ({rule.then.workflowId})</p>
      {rule.then.contactRule && <p className="text-subtle">Contact rule: {rule.then.contactRule}</p>}
      <p className="text-muted-foreground">Effective from {date(rule.effectiveFrom)} · approved by {rule.needsApprovalFrom} · {rule.source}</p>
    </div>
  );
}

function ProductMatrix({ policies }: { policies: Policy[] }) {
  const rules = usePersistencyStore((s) => s.rules);
  const pending = usePersistencyStore((s) => s.pending);
  const propose = usePersistencyStore((s) => s.propose);
  const { persona } = useShell();
  const ctx = useEngineContext();

  const cells = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const totals = new Map<string, number>();
    for (const p of policies) {
      const key = `${p.product}|${stageColumn(p.lifecycleStage)}`;
      const d = evaluate(p, rules, ctx);
      const label = `${d.ruleId}|${d.action}`;
      const m = map.get(key) ?? new Map<string, number>();
      m.set(label, (m.get(label) ?? 0) + 1);
      map.set(key, m);
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
    return { map, totals };
  }, [policies, rules, ctx]);

  return (
    <Panel eyebrow="Product matrix" title="Active treatment by product and stage" tiers={["live-engine"]}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-2 text-[12px]">
          <thead>
            <tr>
              <th className="w-28" />
              {STAGE_COLUMNS.map((c) => <th key={c} className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((prod) => (
              <tr key={prod}>
                <th scope="row" className="text-left align-top text-[13px] font-bold text-foreground">{prod}</th>
                {STAGE_COLUMNS.map((col) => {
                  const key = `${prod}|${col}`;
                  const m = cells.map.get(key);
                  const total = cells.totals.get(key) ?? 0;
                  const top = m ? [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2) : [];
                  const waiting = pending.find((c) => c.source === "Product matrix" && c.rule.when.product?.[0] === prod && c.rule.stage === col);
                  const stageWfs = WORKFLOWS.filter((w) => (w.stage === col || w.stage === "Cross-cutting") && w.products.includes(prod));
                  return (
                    <td key={col} className="rounded-input border border-border bg-surface-translucent p-3 align-top">
                      {top.length === 0 ? (
                        <p className="text-subtle">No policies in view</p>
                      ) : (
                        <ul className="space-y-1">
                          {top.map(([label, n]) => {
                            const [rid, action] = label.split("|");
                            return (
                              <li key={label}>
                                <span className="mr-1 text-[10px] font-bold text-primary">{rid}</span>
                                <span className="text-foreground">{action}</span>
                                <span className="ml-1 text-muted-foreground tabular">{pct(n / Math.max(total, 1), 0)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {MATRIX_NOTES[prod][col] && <p className="mt-1.5 text-[11px] text-subtle">{MATRIX_NOTES[prod][col]}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        {waiting ? (
                          <StatusPill status="attention">Override waiting for approval</StatusPill>
                        ) : (
                          <Select
                            value=""
                            onValueChange={(wfId) => {
                              const wf = workflowById(wfId);
                              if (!wf) return;
                              const stages = col === "Lapse and revival" ? ["Early lapse", "Late lapse"] : [col];
                              const id = `M-${prod.slice(0, 2).toUpperCase()}${STAGE_COLUMNS.indexOf(col) + 1}`;
                              propose({
                                id: `PC-${id}`,
                                title: `${prod}, ${col}: use ${wf.id} ${wf.name}`,
                                source: "Product matrix",
                                proposedBy: persona.label,
                                at: new Date().toISOString(),
                                effect: `Overrides the treatment for ${num(total)} ${prod} policies in ${col}`,
                                rule: {
                                  id,
                                  name: `${prod} ${col} override: ${wf.name}`,
                                  stage: col,
                                  level: "insurer",
                                  priority: 9,
                                  when: { product: [prod], stage: stages },
                                  then: { workflowId: wf.id, action: wf.name, executor: wf.executor, delayHours: 6 },
                                  effectiveFrom: "2026-11-01",
                                  needsApprovalFrom: "Head of Persistency",
                                  source: "Insurer rule",
                                },
                              });
                              toast("Override sent for approval", { description: `${prod}, ${col}: ${wf.id} ${wf.name}` });
                            }}
                          >
                            <SelectTrigger aria-label={`Override ${prod} ${col}`} className="h-7 w-full rounded-input border-border bg-card text-[11px]"><SelectValue placeholder="Override" /></SelectTrigger>
                            <SelectContent className="border-border bg-card">
                              {stageWfs.map((w) => <SelectItem key={w.id} value={w.id} className="text-xs">{w.id} {w.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Each cell shows the top two rules deciding policies in that cell now, with their share. An override becomes an insurer default once approved.</p>
    </Panel>
  );
}
