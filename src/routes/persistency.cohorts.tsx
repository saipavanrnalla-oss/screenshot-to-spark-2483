import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileUp, Info, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Chip, DataTable, EmptyState, Eyebrow, NoteBanner, PageHeader, Panel, PillTabs, SegmentedControl, StatusPill } from "@/components/ds/primitives";
import { AXIS_TICK, GRID, SERIES, TOOLTIP_STYLE, heat } from "@/components/ds/chart-theme";
import { BUILDER_DIMS, cohortMatches, describeGroups } from "@/components/persistency/cohort-builder-model";
import { useScopedPolicies } from "@/hooks/use-shell";
import {
  DEFAULT_BAND_CUTOFFS,
  DEFAULT_WEIGHTS,
  INSURER_COHORTS,
  PRODUCTS,
  RULES_COHORTS,
  STARTER_LABEL,
  bandFor,
  rebalanceWeights as rebalance,
  cohortFileStats,
  isLapsed,
  lastMonthBand,
  lastMonthInsurer,
  lastMonthRules,
  scorePolicy,
  type CohortSet,
  type Policy,
  type ScoreFactor,
} from "@/data/persistency";
import { usePersistencyStore, type CohortGroup } from "@/store/persistency";
import { date, money, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "byo", label: "Bring your own" },
  { id: "rules", label: "Rules builder" },
  { id: "starter", label: "Desible starter score" },
  { id: "compare", label: "Compare" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const cohortSearch = z.object({ tab: fallback(z.enum(["byo", "rules", "starter", "compare"]).optional(), undefined) });

export const Route = createFileRoute("/persistency/cohorts")({
  beforeLoad: ({ search }) => gate("cohorts", search),
  validateSearch: zodValidator(cohortSearch),
  head: () => ({
    meta: [
      { title: "Cohorts · Persistency · desible.ai" },
      { name: "description", content: "Bring your own cohorts, build them with rules, or start with Desible's starter scorecard, and compare all three on the same policies." },
      { property: "og:title", content: "Cohorts · Persistency · desible.ai" },
      { property: "og:description", content: "Bring your own cohorts, build them with rules, or start with Desible's starter scorecard, and compare all three on the same policies." },
    ],
  }),
  component: CohortsPage,
});

const SET_LABEL: Record<CohortSet, string> = { insurer: "Your file", rules: "Rules", starter: "Starter score" };
const SET_OPTIONS = ["Your file", "Rules", "Starter score"] as const;
const SET_FROM_LABEL: Record<(typeof SET_OPTIONS)[number], CohortSet> = { "Your file": "insurer", Rules: "rules", "Starter score": "starter" };

function CohortsPage() {
  const search = Route.useSearch();
  const tab: TabId = search.tab ?? "byo";
  const navigate = useNavigate({ from: "/persistency/cohorts" });
  const { scoped } = useScopedPolicies();
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const setActive = usePersistencyStore((s) => s.setActiveCohortSet);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Cohorts"
        title="Your cohorts, your rules or a starter score"
        description="Three cohort sets sit on every policy side by side. Pick which one drives decisions for each product."
        tiers={["live-engine", "simulated"]}
      />

      <Panel eyebrow="Active for decisions" title="Which cohort set each product uses" tiers={["live-engine"]}>
        <div className="grid gap-4 md:grid-cols-3">
          {PRODUCTS.map((p) => (
            <div key={p} className="flex flex-col gap-2 rounded-input border border-border bg-surface-translucent p-3">
              <span className="text-[13px] font-bold text-foreground">{p}</span>
              <SegmentedControl
                size="sm"
                label={`Cohort set for ${p}`}
                value={SET_LABEL[activeCohortSet[p]] as (typeof SET_OPTIONS)[number]}
                options={SET_OPTIONS}
                onChange={(v) => {
                  setActive(p, SET_FROM_LABEL[v]);
                  toast(`${p} now decides with ${v.toLowerCase()}`, { description: "Rules that match on cohort use the new labels from the next decision." });
                }}
              />
            </div>
          ))}
        </div>
      </Panel>

      <PillTabs label="Cohort views" value={tab} tabs={TABS} onChange={(t) => navigate({ search: (prev) => ({ ...prev, tab: t === "byo" ? undefined : t }) })} />

      <div role="tabpanel">
        {tab === "byo" && <BringYourOwn policies={scoped} />}
        {tab === "rules" && <RulesBuilder policies={scoped} />}
        {tab === "starter" && <StarterScore policies={scoped} />}
        {tab === "compare" && <Compare policies={scoped} />}
      </div>
    </div>
  );
}

/* ---------------- Bring your own ---------------- */

function labelStats<T extends string>(policies: Policy[], labels: readonly T[], get: (p: Policy) => T) {
  const rows = labels.map((l) => ({ label: l, count: 0, premium: 0, lapsed: 0 }));
  const idx = new Map(labels.map((l, i) => [l, i]));
  for (const p of policies) {
    const i = idx.get(get(p));
    if (i === undefined) continue;
    const r = rows[i]!;
    r.count++;
    r.premium += p.annualisedPremium;
    if (isLapsed(p)) r.lapsed++;
  }
  return rows;
}

function BringYourOwn({ policies }: { policies: Policy[] }) {
  const cohortFile = usePersistencyStore((s) => s.cohortFile);
  const load = usePersistencyStore((s) => s.loadCohortFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const stats = useMemo(() => cohortFileStats(policies), [policies]);
  const rows = useMemo(() => labelStats(policies, [...INSURER_COHORTS, "Unscored"] as const, (p) => p.insurerCohort), [policies]);
  const [mapping, setMapping] = useState<Record<string, string>>({ policyId: "policy_no", label: "risk_cohort", score: "risk_score", date: "scored_on" });

  const onFile = (name: string) => {
    load(name);
    toast("Cohort file read", { description: `Using the seeded risk_cohorts_2026-10.csv for this demo (you dropped ${name}).` });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
      <div className="space-y-6">
        <Panel eyebrow="Step 1" title="Drop your cohort file" tiers={["simulated"]}>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              onFile(f?.name ?? "dropped file");
            }}
            className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed px-6 py-8 text-center transition-colors", dragging ? "border-primary bg-brand-tint" : "border-border hover:border-brand-tint-border")}
          >
            <FileUp className="size-6 text-primary" aria-hidden />
            <span className="text-sm font-semibold text-foreground">Drop a CSV or XLSX, or click to choose</span>
            <span className="text-xs text-muted-foreground">Any file works in this demo. The seeded risk_cohorts_2026-10.csv is used.</span>
            <input ref={inputRef} type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => onFile(e.target.files?.[0]?.name ?? "chosen file")} />
          </label>
          {cohortFile && (
            <p className="mt-3 text-xs text-subtle">
              Last read: <span className="font-semibold text-foreground">{cohortFile.droppedName}</span> on {date(cohortFile.at)}. Labels used: {stats.fileName}.
            </p>
          )}
        </Panel>

        {cohortFile ? (
          <Panel eyebrow="Step 2" title="Map columns" tiers={["simulated"]}>
            <div className="space-y-2.5">
              {[
                ["policyId", "Policy number", true],
                ["label", "Cohort label", true],
                ["score", "Score", false],
                ["date", "Scored on", false],
              ].map(([key, label, required]) => (
                <div key={key as string} className="grid grid-cols-[1fr_180px] items-center gap-3">
                  <span className="text-[13px] text-foreground">
                    {label as string} <span className="text-[11px] text-muted-foreground">{required ? "required" : "optional"}</span>
                  </span>
                  <Select value={mapping[key as string] ?? "none"} onValueChange={(v) => setMapping((m) => ({ ...m, [key as string]: v }))}>
                    <SelectTrigger aria-label={`Column for ${label as string}`} className="h-8 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      {!required && <SelectItem value="none" className="text-xs">Not in file</SelectItem>}
                      {stats.columns.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Eyebrow className="mt-5">First 5 rows</Eyebrow>
            <DataTable head={stats.columns} minWidth={420} className="mt-2">
              {stats.sample.map((r) => (
                <tr key={r["policy_no"]}>{stats.columns.map((c) => <td key={c} className="tabular text-subtle">{r[c]}</td>)}</tr>
              ))}
            </DataTable>
          </Panel>
        ) : (
          <EmptyState title="No cohort file yet. Drop one above to see the column mapper." />
        )}
      </div>

      {cohortFile ? (
        <div className="space-y-6">
          <Panel eyebrow="Step 3" title="Validation" tiers={["simulated"]}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Rows in file", stats.rows, "healthy"],
                ["Matched to a policy", stats.matched, "healthy"],
                ["Not on the book", stats.unmatched, "attention"],
                ["Duplicates ignored", stats.duplicates, "attention"],
              ].map(([l, v, s]) => (
                <div key={l as string} className="rounded-input border border-border bg-surface-translucent p-3">
                  <div className="text-lg font-extrabold text-foreground tabular">{num(v as number)}</div>
                  <StatusPill status={s as "healthy"} className="mt-1">{l as string}</StatusPill>
                </div>
              ))}
            </div>
            <NoteBanner tone="attention" className="mt-4">
              <span className="font-semibold">{num(stats.unscoredOnBook)} policies unscored.</span> They stay visible as the cohort "Unscored" and follow your insurer default rules until the next file scores them.
            </NoteBanner>
          </Panel>

          <Panel
            eyebrow="Your labels"
            title={
              <span className="flex items-center gap-2">
                Cohorts as named in your file
                <TooltipProvider>
                  <UiTooltip>
                    <TooltipTrigger aria-label="About labels"><Info className="size-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs border-border bg-card text-xs text-subtle">Labels come from your file. Yours could be P1-P10 or anything else; this seed uses A1-A5.</TooltipContent>
                  </UiTooltip>
                </TooltipProvider>
              </span>
            }
            tiers={["live-engine"]}
          >
            <DataTable head={["Cohort", "Policies", "Share", "Annual premium", "Lapsed now"]} minWidth={480}>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="font-semibold text-foreground">{r.label === "Unscored" ? <StatusPill status="attention">Unscored</StatusPill> : r.label}</td>
                  <td className="tabular text-subtle">{num(r.count)}</td>
                  <td className="tabular text-subtle">{pct(r.count / Math.max(policies.length, 1))}</td>
                  <td className="tabular text-subtle">{money(r.premium)}</td>
                  <td className="tabular text-subtle">{pct(r.lapsed / Math.max(r.count, 1))}</td>
                </tr>
              ))}
            </DataTable>
            <p className="mt-2 text-[11px] text-dim">Lapsed now: share of the cohort currently in early or late lapse. Synthetic data.</p>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Rules builder ---------------- */

const emptyGroup = (): CohortGroup => ({ op: "AND", conditions: [{ dim: "paymentMode", values: [] }] });

function RulesBuilder({ policies }: { policies: Policy[] }) {
  const saved = usePersistencyStore((s) => s.savedCohorts);
  const saveCohort = usePersistencyStore((s) => s.saveCohort);
  const [groups, setGroups] = useState<CohortGroup[]>([
    { op: "AND", conditions: [{ dim: "paymentMode", values: ["Monthly"] }, { dim: "paymentMethod", values: ["Cash/cheque", "Bank branch"] }] },
  ]);
  const [op, setOp] = useState<"AND" | "OR">("OR");
  const [name, setName] = useState("Monthly cash payers");

  const matched = useMemo(() => policies.filter((p) => cohortMatches(p, groups, op)), [policies, groups, op]);
  const lapsed = matched.filter(isLapsed).length;
  const seeded = useMemo(() => labelStats(policies, [...RULES_COHORTS, "Unscored"] as const, (p) => p.rulesCohort), [policies]);

  const update = (gi: number, fn: (g: CohortGroup) => CohortGroup) => setGroups((gs) => gs.map((g, i) => (i === gi ? fn(g) : g)));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Panel eyebrow="Build a cohort" title="Conditions" tiers={["live-engine"]}>
        <div className="space-y-4">
          {groups.map((g, gi) => (
            <div key={gi}>
              {gi > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <SegmentedControl size="sm" label="Join groups with" value={op} options={["AND", "OR"] as const} onChange={setOp} />
                  <span className="text-[11px] text-muted-foreground">between groups</span>
                </div>
              )}
              <div className="rounded-input border border-border bg-surface-translucent p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eyebrow>Group {gi + 1}</Eyebrow>
                    <SegmentedControl size="sm" label={`Join conditions in group ${gi + 1}`} value={g.op} options={["AND", "OR"] as const} onChange={(v) => update(gi, (x) => ({ ...x, op: v }))} />
                  </div>
                  {groups.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))} aria-label={`Remove group ${gi + 1}`}><Trash2 /></Button>
                  )}
                </div>
                <div className="space-y-3">
                  {g.conditions.map((c, ci) => {
                    const dim = BUILDER_DIMS.find((d) => d.key === c.dim)!;
                    return (
                      <div key={ci} className="flex flex-wrap items-start gap-2">
                        <Select value={c.dim} onValueChange={(v) => update(gi, (x) => ({ ...x, conditions: x.conditions.map((cc, i) => (i === ci ? { dim: v, values: [] } : cc)) }))}>
                          <SelectTrigger aria-label="Dimension" className="h-8 w-44 rounded-input border-border bg-card text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="border-border bg-card">
                            {BUILDER_DIMS.map((d) => <SelectItem key={d.key} value={d.key} className="text-xs">{d.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <span className="pt-1.5 text-[11px] text-muted-foreground">is any of</span>
                        <div className="flex flex-1 flex-wrap gap-1.5 pt-0.5">
                          {dim.values.map((v) => (
                            <Chip
                              key={v}
                              active={c.values.includes(v)}
                              onClick={() =>
                                update(gi, (x) => ({
                                  ...x,
                                  conditions: x.conditions.map((cc, i) => (i === ci ? { ...cc, values: cc.values.includes(v) ? cc.values.filter((y) => y !== v) : [...cc.values, v] } : cc)),
                                }))
                              }
                            >
                              {v}
                            </Chip>
                          ))}
                        </div>
                        {g.conditions.length > 1 && (
                          <Button variant="ghost" size="icon" className="size-7" aria-label="Remove condition" onClick={() => update(gi, (x) => ({ ...x, conditions: x.conditions.filter((_, i) => i !== ci) }))}><Trash2 /></Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => update(gi, (x) => ({ ...x, conditions: [...x.conditions, { dim: "advisorStatus", values: [] }] }))}>
                  <Plus /> Add condition
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setGroups((gs) => [...gs, emptyGroup()])}><Plus /> Add group</Button>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel eyebrow="Live count" title="Policies matched" tiers={["live-engine"]}>
          <div className="stat-number">{num(matched.length)}</div>
          <p className="stat-label">of {num(policies.length)} in view · {pct(lapsed / Math.max(matched.length, 1))} currently lapsed</p>
          <p className="mt-3 text-xs text-subtle">{describeGroups(groups, op) || "Pick at least one value to match policies."}</p>
          <div className="mt-4 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Cohort name" placeholder="Name the cohort" className="h-8 rounded-input border-border bg-surface-translucent text-xs" />
            <Button
              size="sm"
              disabled={!name.trim() || matched.length === 0}
              onClick={() => {
                saveCohort({ id: `RC-${saved.length + 1}`, name: name.trim(), groups, groupsOp: op, count: matched.length, savedAt: new Date().toISOString() });
                toast(`Cohort "${name.trim()}" saved`, { description: `${num(matched.length)} policies. Use it as a dimension in Configuration.` });
              }}
            >
              <Save /> Save
            </Button>
          </div>
        </Panel>

        <Panel eyebrow="Seeded rules cohorts" title="High, Medium, Low" tiers={["live-engine"]}>
          <p className="text-xs text-subtle">Counts flags: Monthly mode, cash or branch payment, advisor left, policy year 1-2, two or more late payments. Three or more flags is High, one or two Medium, none Low.</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {seeded.map((r) => (
              <div key={r.label} className="rounded-input border border-border bg-surface-translucent p-2.5">
                <div className="text-[11px] text-muted-foreground">{r.label}</div>
                <div className="text-base font-extrabold text-foreground tabular">{num(r.count)}</div>
              </div>
            ))}
          </div>
          {saved.length > 0 && (
            <>
              <Eyebrow className="mt-4">Saved this session</Eyebrow>
              <ul className="mt-2 space-y-2">
                {saved.map((c) => (
                  <li key={c.id} className="rounded-input border border-border p-2.5 text-xs">
                    <span className="font-semibold text-foreground">{c.name}</span> <span className="text-muted-foreground">· {num(c.count)} policies</span>
                    <p className="text-[11px] text-subtle">{describeGroups(c.groups, c.groupsOp)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Starter score ---------------- */

function StarterScore({ policies }: { policies: Policy[] }) {
  const weightsRaw = usePersistencyStore((s) => s.starterWeights);
  const cutoffs = usePersistencyStore((s) => s.bandCutoffs);
  const setWeights = usePersistencyStore((s) => s.setStarterWeights);
  const setCutoffs = usePersistencyStore((s) => s.setBandCutoffs);
  const bureauOn = usePersistencyStore((s) => s.adapterEnabled["bureau_fields"] ?? false);
  const log = usePersistencyStore((s) => s.log);
  const [policyId, setPolicyId] = useState("");

  const weights = useMemo(
    () => weightsRaw.map((w) => (w.key === "bureau" ? { ...w, disabled: !bureauOn, disabledNote: bureauOn ? undefined : w.disabledNote } : w)),
    [weightsRaw, bureauOn],
  );
  const enabledSum = weights.reduce((s, w) => s + w.weight, 0);

  const bands = useMemo(() => {
    const rows = [1, 2, 3, 4, 5].map((b) => ({ band: `Band ${b}`, count: 0, lapsed: 0 }));
    let unscored = 0;
    for (const p of policies) {
      if (p.starterBand === null) { unscored++; continue; }
      const b = bandFor(scorePolicy(p, weights).score, cutoffs);
      const r = rows[b - 1]!;
      r.count++;
      if (isLapsed(p)) r.lapsed++;
    }
    return { rows: rows.map((r) => ({ ...r, lapseRate: r.count ? +(100 * r.lapsed / r.count).toFixed(1) : 0 })), unscored };
  }, [policies, weights, cutoffs]);

  const sample = useMemo(() => {
    const id = policyId.trim().toUpperCase();
    return (id && policies.find((p) => p.policyId === id)) || policies.find((p) => p.starterBand !== null && p.lifecycleStage === "Renewal window") || policies[0];
  }, [policies, policyId]);
  const breakdown = sample ? scorePolicy(sample, weights) : null;

  return (
    <div className="space-y-6">
      <NoteBanner>
        <span className="font-semibold">{STARTER_LABEL}</span> No accuracy figure until tested on your data.
      </NoteBanner>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel
          eyebrow="Weights"
          title={<span>Factors and weights <span className="ml-2 text-xs font-semibold text-muted-foreground tabular">Sum {enabledSum}</span></span>}
          tiers={["live-engine"]}
          actions={
            <Button variant="ghost" size="sm" onClick={() => { setWeights(DEFAULT_WEIGHTS); setCutoffs([...DEFAULT_BAND_CUTOFFS]); }}>
              <RotateCcw /> Reset
            </Button>
          }
        >
          <ul className="space-y-3">
            {weights.map((w) => (
              <li key={w.key} className={cn("grid grid-cols-[170px_1fr_40px] items-center gap-3", w.disabled && "opacity-50")}>
                <span className="text-[13px] text-foreground">
                  {w.label}
                  {w.disabled && <span className="block text-[11px] text-muted-foreground">{w.disabledNote}</span>}
                </span>
                <Slider
                  aria-label={`Weight for ${w.label}`}
                  disabled={!!w.disabled}
                  min={0}
                  max={40}
                  step={1}
                  value={[w.weight]}
                  onValueChange={([v]) => setWeights(rebalance(weights, w.key, v ?? w.weight))}
                />
                <span className="text-right text-sm font-bold text-foreground tabular">{w.weight}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-dim">Moving one weight rebalances the others so all weights always total 100; a greyed-out factor keeps its weight in reserve. Bureau signals stay off until a bureau_fields file is mapped in Data and integrations.</p>
          <div className="mt-5">
            <Eyebrow>Band cut-offs (score at which each band starts)</Eyebrow>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {cutoffs.map((c, i) => (
                <label key={i} className="flex items-center gap-1.5 text-xs text-subtle">
                  Band {i + 2}
                  <Input
                    type="number"
                    value={c}
                    min={0}
                    max={100}
                    onChange={(e) => setCutoffs(cutoffs.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                    className="h-8 w-16 rounded-input border-border bg-surface-translucent text-xs tabular"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button
              size="sm"
              variant="tint"
              onClick={() => {
                log({ actor: "Head of Persistency", kind: "rule-change", detail: `Starter weights proposed: ${weights.filter((w) => !w.disabled).map((w) => `${w.label} ${w.weight}`).join(", ")}` });
                toast("Weights logged as a proposal", { description: "Decisions keep the approved weights until the change is confirmed." });
              }}
            >
              Log as proposal
            </Button>
            <span className="text-[11px] text-muted-foreground">Preview only. Bands below update live.</span>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel eyebrow="Bands with these weights" title="Policies and lapse rate by band" tiers={["live-engine"]}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bands.rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="band" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis yAxisId="l" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="l" dataKey="count" name="Policies" fill={SERIES[1]} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="r" dataKey="lapseRate" name="Lapsed now (%)" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] text-dim">{num(bands.unscored)} policies unscored (missing fields). Synthetic data.</p>
          </Panel>

          <Panel eyebrow="Score explainer" title="Which factors added how many points" tiers={["live-engine"]}>
            <Input value={policyId} onChange={(e) => setPolicyId(e.target.value)} placeholder={sample?.policyId ?? "Policy number"} aria-label="Policy number to explain" className="h-8 rounded-input border-border bg-surface-translucent text-xs" />
            {sample && breakdown ? (
              <div className="mt-3">
                <p className="text-[13px] text-foreground">
                  <span className="font-bold">{sample.policyId}</span> · {sample.product} · {sample.paymentMode} · {sample.paymentMethod}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  Score <span className="font-bold text-primary tabular">{breakdown.score}</span> of {breakdown.maxAvailable} · Band {bandFor(breakdown.score, cutoffs)}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {breakdown.parts.filter((x) => !x.disabled).map((x) => (
                    <li key={x.key} className="grid grid-cols-[150px_1fr_44px] items-center gap-2 text-xs">
                      <span className="text-subtle">{x.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-translucent">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(x.points / Math.max(x.weight, 1)) * 100}%` }} />
                      </span>
                      <span className="text-right font-semibold text-foreground tabular">{x.points} / {x.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState title="No policy with that number in this view." />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Compare ---------------- */

const BAND_LABELS = ["Band 1", "Band 2", "Band 3", "Band 4", "Band 5"] as const;
type Pair = "insurer-starter" | "insurer-rules" | "rules-starter";

function starterLabel(p: Policy): string {
  return p.starterBand === null ? "Unscored" : `Band ${p.starterBand}`;
}

function Compare({ policies }: { policies: Policy[] }) {
  const [pair, setPair] = useState<Pair>("insurer-starter");
  const axes: Record<Pair, { rows: string[]; cols: string[]; r: (p: Policy) => string; c: (p: Policy) => string; rl: string; cl: string }> = {
    "insurer-starter": { rows: [...INSURER_COHORTS], cols: [...BAND_LABELS], r: (p) => p.insurerCohort, c: starterLabel, rl: "Your file", cl: "Starter score" },
    "insurer-rules": { rows: [...INSURER_COHORTS], cols: ["Low", "Medium", "High"], r: (p) => p.insurerCohort, c: (p) => p.rulesCohort, rl: "Your file", cl: "Rules" },
    "rules-starter": { rows: ["Low", "Medium", "High"], cols: [...BAND_LABELS], r: (p) => p.rulesCohort, c: starterLabel, rl: "Rules", cl: "Starter score" },
  };
  const a = axes[pair];

  const matrix = useMemo(() => {
    const m = a.rows.map(() => a.cols.map(() => 0));
    let both = 0;
    for (const p of policies) {
      const ri = a.rows.indexOf(a.r(p));
      const ci = a.cols.indexOf(a.c(p));
      if (ri < 0 || ci < 0) continue;
      m[ri]![ci]!++;
      both++;
    }
    // "Agree" means both sets put the policy in the same relative third of risk.
    let agree = 0;
    m.forEach((row, ri) => row.forEach((v, ci) => {
      const rt = Math.floor((ri / a.rows.length) * 3);
      const ct = Math.floor((ci / a.cols.length) * 3);
      if (rt === ct) agree += v;
    }));
    const max = Math.max(1, ...m.flat());
    return { m, both, agree, max };
  }, [policies, pair]); // eslint-disable-line react-hooks/exhaustive-deps

  const lapseBy = useMemo(() => {
    const set = (labels: readonly string[], get: (p: Policy) => string) =>
      labelStats(policies, labels as readonly string[], get).map((r) => ({ label: r.label, rate: r.count ? +(100 * r.lapsed / r.count).toFixed(1) : 0, count: r.count }));
    return {
      insurer: set([...INSURER_COHORTS, "Unscored"], (p) => p.insurerCohort),
      rules: set(["Low", "Medium", "High", "Unscored"], (p) => p.rulesCohort),
      starter: set([...BAND_LABELS, "Unscored"], starterLabel),
    };
  }, [policies]);

  const drift = useMemo(() => {
    const build = (labels: readonly string[], now: (p: Policy) => string, last: (p: Policy) => string) => {
      const rows = labels.map((l) => ({ label: l, thisMonth: 0, lastMonth: 0 }));
      let changed = 0;
      for (const p of policies) {
        const n = now(p), l = last(p);
        const ni = labels.indexOf(n), li = labels.indexOf(l);
        if (ni >= 0) rows[ni]!.thisMonth++;
        if (li >= 0) rows[li]!.lastMonth++;
        if (n !== l) changed++;
      }
      // Population stability index, computed from the two distributions.
      const total = Math.max(policies.length, 1);
      let psi = 0;
      for (const r of rows) {
        const x = Math.max(r.thisMonth / total, 1e-4), y = Math.max(r.lastMonth / total, 1e-4);
        psi += (x - y) * Math.log(x / y);
      }
      return { rows, changed, psi };
    };
    return {
      insurer: build([...INSURER_COHORTS, "Unscored"], (p) => p.insurerCohort, lastMonthInsurer),
      rules: build(["Low", "Medium", "High", "Unscored"], (p) => p.rulesCohort, lastMonthRules),
      starter: build([...BAND_LABELS, "Unscored"], starterLabel, (p) => { const b = lastMonthBand(p); return b === null ? "Unscored" : `Band ${b}`; }),
    };
  }, [policies]);
  const [driftSet, setDriftSet] = useState<"insurer" | "rules" | "starter">("insurer");
  const d = drift[driftSet];

  return (
    <div className="space-y-6">
      <NoteBanner>Results on synthetic data. They show how the comparison works, not how any set would perform on your book.</NoteBanner>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Panel
          eyebrow="Agreement matrix"
          title="Same policies, two cohort sets"
          tiers={["live-engine"]}
          actions={
            <Select value={pair} onValueChange={(v) => setPair(v as Pair)}>
              <SelectTrigger aria-label="Compare which sets" className="h-8 w-52 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="insurer-starter" className="text-xs">Your file vs starter score</SelectItem>
                <SelectItem value="insurer-rules" className="text-xs">Your file vs rules</SelectItem>
                <SelectItem value="rules-starter" className="text-xs">Rules vs starter score</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-[12px]">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{a.rl} ↓ / {a.cl} →</th>
                  {a.cols.map((c) => <th key={c} className="px-1 text-[11px] font-semibold text-subtle">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {a.rows.map((r, ri) => (
                  <tr key={r}>
                    <th scope="row" className="pr-2 text-left text-[11px] font-semibold text-subtle">{r}</th>
                    {a.cols.map((c, ci) => {
                      const v = matrix.m[ri]![ci]!;
                      return (
                        <td key={c} className="rounded-md px-2 py-2 text-center font-semibold text-foreground tabular" style={{ background: heat(v / matrix.max) }}>
                          {num(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-subtle">
            {pct(matrix.agree / Math.max(matrix.both, 1), 0)} of {num(matrix.both)} policies scored by both sets land in the same third of risk (low, middle, high). Unscored policies are left out.
          </p>
        </Panel>

        <Panel eyebrow="Lapse rate by band" title="Share of each band lapsed now" tiers={["live-engine"]}>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            {([["Your file", lapseBy.insurer], ["Rules", lapseBy.rules], ["Starter score", lapseBy.starter]] as const).map(([title, data], i) => (
              <div key={title}>
                <p className="text-xs font-semibold text-foreground">{title}</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 9 }} axisLine={{ stroke: GRID }} tickLine={false} interval={0} />
                      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="rate" name="Lapsed now (%)" fill={SERIES[i]} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Drift"
        title="Distribution this month vs last month"
        tiers={["simulated"]}
        actions={<SegmentedControl size="sm" label="Drift for set" value={driftSet} options={["insurer", "rules", "starter"] as const} onChange={setDriftSet} />}
      >
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="lastMonth" name="September 2026" fill={SERIES[2]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="thisMonth" name="October 2026" fill={SERIES[0]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="panel-translucent p-3">
              <div className="text-lg font-extrabold text-foreground tabular">{num(d.changed)}</div>
              <p className="text-xs text-subtle">policies changed label since last month</p>
            </div>
            <div className="panel-translucent p-3">
              <div className="text-lg font-extrabold text-foreground tabular">{d.psi.toFixed(3)}</div>
              <p className="text-xs text-subtle">population stability index, computed from the two distributions above. Under 0.1 is usually read as stable.</p>
            </div>
            <p className="text-[11px] text-dim">Last month's labels are part of the seeded demo data.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

