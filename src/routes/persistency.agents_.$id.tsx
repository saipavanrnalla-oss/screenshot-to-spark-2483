import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, NoteBanner, Panel } from "@/components/ds/primitives";
import { DataGrid } from "@/components/r1/data-grid";
import { EditFooter } from "@/components/r1/edit-footer";
import { StatusChip, versionTone } from "@/components/r1/status-chip";
import { PageTabs, inputCls, selectCls } from "@/components/r1/tabs";
import { agentDef, agentDiff, agentVersions, routeAffects } from "@/components/r1/agent-model";
import { AGENT_META, DISPOSITIONS, ROUTE_OPTIONS, TOOL_KEYS, type AgentConfig, type ScriptDoc } from "@/data/persistency/r1/agents";
import { TASKS, THREADS, TRANSCRIPTS, agentStats, type AgentTask } from "@/data/persistency/r1/tasks";
import { useCan, useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { dateTime, inr, num, pct } from "@/lib/format";
import { usePolicy } from "@/store/persistency";
import { useWork } from "@/store/work";

const search = z.object({
  tab: fallback(z.enum(["overview", "configure", "versions", "tasks", "test"]).optional(), undefined),
  section: fallback(z.string().optional(), undefined),
  result: fallback(z.string().optional(), undefined),
  task: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/agents_/$id")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("agents", search),
  head: ({ params }) => ({
    meta: [
      { title: `Agent ${params.id} · Agents · desible.ai` },
      { name: "description", content: "Agent overview, configuration, versions, tasks and tests." },
      { property: "og:title", content: `Agent ${params.id} · Agents · desible.ai` },
      { property: "og:description", content: "Agent overview, configuration, versions, tasks and tests." },
    ],
  }),
  component: AgentPage,
});

const SECTIONS = ["Instructions", "Scripts and templates", "Tools allowed", "Allowed offers", "Languages", "Windows and retries", "Dispositions", "Confidence thresholds", "Handoff rules", "Limits", "Conduct checks"] as const;

function AgentPage() {
  const { id } = Route.useParams();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const def = agentDef(id);
  const saved = useWork((st) => st.versions);
  const pauses = useWork((st) => st.agentPause);
  const list = useMemo(() => agentVersions(saved, id), [saved, id]);
  if (!def) return <EmptyState title={`There is no agent called ${id}.`} action={<Link to="/persistency/agents" className="text-[13px] text-primary hover:underline">Back to Agents</Link>} />;
  const disabled = def.status === "Not enabled";
  const active = list.find((v) => v.status === "Active");
  const tab = disabled ? "overview" : (s.tab ?? "overview");
  const paused = pauses[id];
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <Link to="/persistency/agents" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Agents</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[20px] font-semibold text-foreground">{def.name}</h1>
        <StatusChip tone={disabled ? "off" : paused ? "risk" : "ok"}>{disabled ? "Not enabled" : paused ? "Paused" : "Active"}</StatusChip>
        {active && <span className="text-[12px] text-muted-foreground">Active version {active.no}</span>}
        {active && (active.reviewedCalls ?? 30) < 30 && <StatusChip tone="neutral">Reviewed calls {active.reviewedCalls ?? 0} of 30</StatusChip>}
      </div>
      {paused && <NoteBanner tone="attention">Paused by {paused.by} at {dateTime(paused.at)}: {paused.reason}</NoteBanner>}
      {disabled && <NoteBanner>Not enabled in this release. This page is read-only.</NoteBanner>}
      {!disabled && (
        <PageTabs
          label="Agent"
          value={tab}
          onChange={(v) => navigate({ search: { tab: v === "overview" ? undefined : v } })}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "configure", label: "Configure" },
            { id: "versions", label: "Versions", count: list.length },
            { id: "tasks", label: "Tasks" },
            { id: "test", label: "Test" },
          ]}
        />
      )}
      {tab === "overview" && <Overview id={id} />}
      {tab === "configure" && <Configure id={id} />}
      {tab === "versions" && <Versions id={id} />}
      {tab === "tasks" && <Tasks id={id} />}
      {tab === "test" && <TestTab id={id} />}
    </div>
  );
}

const SAMPLES: Record<string, { label: string; input: string; output: [string, string][] }[]> = {
  "reason-classifier": [
    {
      label: "ULIP, fund value fell",
      input: "Call transcript, 13th-month premium due 12 Dec. Customer: \"The fund has gone down since last year. Why should I put in more money now? I will think about it after the market recovers.\"",
      output: [["Reason", "Market-linked concern: fund value below premiums paid"], ["Confidence", "0.91"], ["Suggested next step", "Retention desk call with fund value statement"], ["Route", "ULIP Surrender Prevention (L3) if the customer mentions surrender"]],
    },
    {
      label: "Traditional, mandate failed",
      input: "WhatsApp reply to the debit failed message: \"My bank changed the account number last month. The auto debit did not go through.\"",
      output: [["Reason", "Mandate failure: bank account changed"], ["Confidence", "0.96"], ["Suggested next step", "New e-NACH mandate link and payment link"], ["Route", "Failed Autopay and ECS Bounce Recovery (R4)"]],
    },
    {
      label: "Term, cash short",
      input: "Call transcript, grace period day 12. Customer: \"Salary is delayed this month. I can pay on the 20th, please do not cancel my policy.\"",
      output: [["Reason", "Affordability: short of cash this month"], ["Confidence", "0.88"], ["Promise to pay", "Recorded as stated: 20th"], ["Route", "Promise-to-Pay Follow-up (R3)"]],
    },
  ],
  "handoff-summariser": [
    {
      label: "Customer asked for a person",
      input: "Policy SLI02400113, ULIP, premium \u20b948,000 half-yearly, 13th-month due 12 Dec. Two calls, one WhatsApp reminder read. Customer asked to speak to someone about fund options.",
      output: [["Who the customer is", "Mr Customer A, ULIP, policy year 1, half-yearly mode"], ["Why the case moved", "Customer asked for a person about fund options"], ["What was said", "Doubts about fund performance; open to continuing if switch options are explained"], ["What was offered", "Payment link, not used"], ["What the customer asked for", "Call from a person this week"], ["Next step", "Telecaller call by 6 Dec; payment due 12 Dec"]],
    },
    {
      label: "Wants to surrender",
      input: "Policy SLI02400347, Traditional, \u20b936,000 yearly, lapsed 20 days. Customer said on the call that the policy is no longer needed and asked how to surrender.",
      output: [["Who the customer is", "Mrs Customer B, Traditional, policy year 4, yearly mode"], ["Why the case moved", "Customer wants to surrender"], ["What was said", "Policy no longer needed after a job change"], ["What was offered", "Premium holiday not offered yet"], ["What the customer asked for", "Surrender process"], ["Next step", "Surrender retention desk call within 24 hours"]],
    },
  ],
};

function SampleRun({ id }: { id: string }) {
  const samples = SAMPLES[id];
  const [i, setI] = useState(0);
  const [ran, setRan] = useState(false);
  if (!samples) return null;
  const sample = samples[i]!;
  return (
    <Panel title="Try it on a sample">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12px] font-medium text-muted-foreground">Sample
          <select value={i} onChange={(e) => { setI(Number(e.target.value)); setRan(false); }} className={`${selectCls} mt-1 block`} aria-label="Sample">{samples.map((x, k) => <option key={x.label} value={k}>{x.label}</option>)}</select>
        </label>
        <Button size="sm" onClick={() => setRan(true)}>Run</Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Input</p>
          <p className="mt-1 rounded-input border border-border bg-surface-translucent p-3 text-[13px]">{sample.input}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Output</p>
          {ran ? (
            <dl className="mt-1 grid grid-cols-[150px_1fr] gap-y-1.5 rounded-input border border-border p-3 text-[13px]">
              {sample.output.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></Fragment>))}
            </dl>
          ) : (
            <p className="mt-1 rounded-input border border-dashed border-border p-3 text-[13px] text-muted-foreground">Run the agent to see the output.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Overview({ id }: { id: string }) {
  const def = agentDef(id)!;
  const meta = AGENT_META[id];
  const s7 = agentStats(id, 7);
  const s30 = agentStats(id, 30);
  const row = (label: string, f: (x: typeof s7) => string) => (
    <tr className="border-t border-border/60">
      <td className="py-1.5 text-subtle">{label}</td>
      <td className="py-1.5 text-right tabular">{f(s7)}</td>
      <td className="py-1.5 text-right tabular">{f(s30)}</td>
    </tr>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(id === "reason-classifier" || id === "handoff-summariser") && <div className="lg:col-span-2"><SampleRun id={id} /></div>}
      <Panel title="What it does">
        <p className="text-[13px]">{def.does}</p>
        {id === "renewal-voice" && <p className="mt-2 text-[13px] font-medium">Decisions: none. It converses and records.</p>}
        <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-muted-foreground">Inputs</dt><dd>{meta?.inputs.join(", ")}</dd>
          <dt className="text-muted-foreground">Outputs</dt><dd>{meta?.outputs.join(", ")}</dd>
          <dt className="text-muted-foreground">Workflows</dt>
          <dd className="flex flex-wrap gap-1.5">{def.workflows.length ? def.workflows.map((w) => <Link key={w} to="/persistency/workflows/$id" params={{ id: w }} className="text-primary hover:underline">{w}</Link>) : "None"}</dd>
        </dl>
      </Panel>
      {def.status !== "Not enabled" && (
        <Panel title="Performance">
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium" /><th className="py-1 text-right font-medium">7 days</th><th className="py-1 text-right font-medium">30 days</th></tr></thead>
            <tbody>
              {row("Tasks", (x) => num(x.tasks))}
              {row("Success", (x) => pct(x.success))}
              {row("Handoffs", (x) => pct(x.handoffs))}
              {row("Handling time", (x) => (x.aht ? `${Math.round(x.aht)} s` : "None"))}
              {row("Conduct score", (x) => pct(x.conduct))}
              {row("Cost", (x) => inr(Math.round(x.cost)))}
            </tbody>
          </table>
          <p className="mt-3 text-[12px] font-medium text-muted-foreground">Where it passed cases to people (30 days)</p>
          <ul className="mt-1 space-y-0.5 text-[13px]">
            {s30.reasons.length ? s30.reasons.map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular">{num(v)}</span></li>) : <li className="text-muted-foreground">None</li>}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/* ---------- Configure ---------- */

function Configure({ id }: { id: string }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const def = agentDef(id)!;
  const saved = useWork((st) => st.versions);
  const list = useMemo(() => agentVersions(saved, id), [saved, id]);
  const last = list[list.length - 1];
  const draftV = last?.status === "Draft" ? last : undefined;
  const inReview = list.find((v) => v.status === "In review");
  const active = list.find((v) => v.status === "Active");
  const base = (draftV ?? inReview ?? active ?? last)!.data;
  const [cfg, setCfg] = useState<AgentConfig>(base);
  useEffect(() => setCfg(base), [base]);
  const handoffRules = useWork((st) => st.handoffRules);
  const saveDraft = useWork((st) => st.saveDraft);
  const discardDraft = useWork((st) => st.discardDraft);
  const submit = useWork((st) => st.submit);
  const mayEdit = useCan("agents.edit");
  const mayThreshold = useCan("agents.thresholds");
  const user = useUser();
  const author = user?.name ?? "User";
  const locked = !!inReview || !mayEdit;
  const section = (SECTIONS as readonly string[]).includes(s.section ?? "") ? (s.section as (typeof SECTIONS)[number]) : "Instructions";
  const dirty = JSON.stringify(cfg) !== JSON.stringify(base);
  const [script, setScript] = useState<number | null>(null);
  const [template, setTemplate] = useState<number | null>(null);
  const changedRoutes = (Object.keys(cfg.routes) as (keyof AgentConfig["routes"])[]).filter((k) => active && cfg.routes[k] !== active.data.routes[k]);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Configure sections" className="space-y-0.5">
        {SECTIONS.map((sec) => (
          <button key={sec} type="button" onClick={() => navigate({ search: (p) => ({ ...p, section: sec }) })} className={`block w-full rounded-input px-2 py-1.5 text-left text-[13px] ${section === sec ? "bg-brand-tint text-foreground" : "text-subtle hover:text-foreground"}`}>
            {sec}
          </button>
        ))}
      </nav>
      <div className="space-y-4">
        {inReview && <NoteBanner>Version {inReview.no} is in review. Configure opens again after a decision.</NoteBanner>}
        {draftV?.returnReason && <NoteBanner tone="attention">Returned: {draftV.returnReason}</NoteBanner>}
        {draftV?.reviewNotes?.length ? (
          <NoteBanner>
            <p className="font-medium">Notes from task reviews</p>
            <ul className="mt-1 list-disc pl-5">{draftV.reviewNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </NoteBanner>
        ) : null}
        {id === "renewal-voice" && <NoteBanner>Decisions: none. It converses and records. A date the customer states is recorded as stated.</NoteBanner>}
        <Panel title={section}>
          {section === "Instructions" && (
            <textarea disabled={locked} rows={8} value={cfg.instructions} onChange={(e) => setCfg({ ...cfg, instructions: e.target.value })} aria-label="Instructions" className="block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px]" placeholder="Role, tone, coverage and what it never says" />
          )}
          {section === "Scripts and templates" && (
            <div className="space-y-4">
              {cfg.scripts.length > 0 && (
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium">Product</th><th className="font-medium">Language</th><th className="font-medium">Objections</th><th /></tr></thead>
                  <tbody>
                    {cfg.scripts.map((sc, i) => (
                      <tr key={`${sc.product}-${sc.language}`} className="cursor-pointer border-t border-border/60 hover:bg-surface-translucent" onClick={() => setScript(i)}>
                        <td className="py-1.5">{sc.product}</td><td>{sc.language}</td><td className="tabular">{sc.objections.length}</td><td className="text-right text-primary">Open</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {cfg.templates.length > 0 && (
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium">Template</th><th className="font-medium">Language</th><th className="font-medium">Text</th></tr></thead>
                  <tbody>
                    {cfg.templates.map((t, i) => (
                      <tr key={t.id} className="cursor-pointer border-t border-border/60 hover:bg-surface-translucent" onClick={() => setTemplate(i)}>
                        <td className="py-1.5">{t.name}</td><td>{t.language}</td><td className="text-subtle"><Placeholders text={t.text} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!cfg.scripts.length && !cfg.templates.length && <p className="text-[13px] text-muted-foreground">This agent has no scripts or templates.</p>}
            </div>
          )}
          {section === "Tools allowed" && (
            <ul className="space-y-2">
              {TOOL_KEYS.map((k) => (
                <li key={k} className="flex items-center justify-between text-[13px]"><span>{k}</span><Switch disabled={locked} checked={cfg.tools[k]} onCheckedChange={(v) => setCfg({ ...cfg, tools: { ...cfg.tools, [k]: v } })} aria-label={k} /></li>
              ))}
            </ul>
          )}
          {section === "Allowed offers" && (
            <div className="space-y-2">
              {cfg.offers.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input disabled={locked || i < 2} value={o.name} onChange={(e) => setCfg({ ...cfg, offers: cfg.offers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className={`${inputCls} flex-1`} aria-label="Offer" />
                  <label className="flex items-center gap-1.5 text-[12px] text-subtle"><Switch disabled={locked} checked={o.needsApproval} onCheckedChange={(v) => setCfg({ ...cfg, offers: cfg.offers.map((x, j) => (j === i ? { ...x, needsApproval: v } : x)) })} /> Needs approval</label>
                  {i >= 2 && !locked && <Button size="icon" variant="ghost" className="size-7" aria-label="Remove offer" onClick={() => setCfg({ ...cfg, offers: cfg.offers.filter((_, j) => j !== i) })}><Trash2 /></Button>}
                </div>
              ))}
              {!locked && <Button size="sm" variant="ghost" onClick={() => setCfg({ ...cfg, offers: [...cfg.offers, { name: "Approved alternative", needsApproval: true }] })}><Plus /> Add approved alternative</Button>}
              <p className="text-[12px] text-muted-foreground">The agent cannot offer anything that is not on this list.</p>
            </div>
          )}
          {section === "Languages" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {["Hindi", "English", "Tamil", "Telugu", "Marathi", "Bengali", "Kannada", "Gujarati"].map((l) => (
                  <button key={l} type="button" disabled={locked} onClick={() => setCfg({ ...cfg, languages: cfg.languages.includes(l) ? cfg.languages.filter((x) => x !== l) : [...cfg.languages, l] })} className={`rounded-pill border px-2.5 py-0.5 text-[12px] ${cfg.languages.includes(l) ? "border-primary text-foreground" : "border-border text-subtle"}`}>{l}</button>
                ))}
              </div>
              <label className="block text-[12px] font-medium text-muted-foreground">Transfer to
                <select disabled={locked} value={cfg.transferLanguage} onChange={(e) => setCfg({ ...cfg, transferLanguage: e.target.value })} className={`${selectCls} mt-1 block`}>{cfg.languages.map((l) => <option key={l}>{l}</option>)}</select>
              </label>
            </div>
          )}
          {section === "Windows and retries" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-[12px] font-medium text-muted-foreground">Window starts<input disabled={locked} type="time" value={cfg.windowStart} onChange={(e) => setCfg({ ...cfg, windowStart: e.target.value })} className={`${inputCls} mt-1`} /></label>
              <label className="block text-[12px] font-medium text-muted-foreground">Window ends<input disabled={locked} type="time" value={cfg.windowEnd} onChange={(e) => setCfg({ ...cfg, windowEnd: e.target.value })} className={`${inputCls} mt-1`} /></label>
              <label className="block text-[12px] font-medium text-muted-foreground">Gap between attempts (days)<input disabled={locked} type="number" min={0} value={cfg.gapDays} onChange={(e) => setCfg({ ...cfg, gapDays: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} mt-1 tabular`} /></label>
              {(["window", "grace", "lapse"] as const).map((k) => (
                <label key={k} className="block text-[12px] font-medium text-muted-foreground">Attempts in {k === "window" ? "renewal window" : k === "grace" ? "grace" : "early lapse"}<input disabled={locked} type="number" min={0} value={cfg.attempts[k]} onChange={(e) => setCfg({ ...cfg, attempts: { ...cfg.attempts, [k]: Math.max(0, Number(e.target.value) || 0) } })} className={`${inputCls} mt-1 tabular`} /></label>
              ))}
              {(cfg.windowStart < "09:00" || cfg.windowEnd > "19:00") && <p className="text-[12px] text-attention sm:col-span-3">Calls are only allowed from 9 am to 7 pm. The guardrail keeps calls inside that window.</p>}
            </div>
          )}
          {section === "Dispositions" && (
            <div className="space-y-3">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium">Disposition</th><th className="font-medium">Route that follows</th></tr></thead>
                <tbody>
                  {DISPOSITIONS.map((d) => (
                    <tr key={d} className="border-t border-border/60">
                      <td className="py-1.5">{d}</td>
                      <td>
                        <select disabled={locked} value={cfg.routes[d]} onChange={(e) => setCfg({ ...cfg, routes: { ...cfg.routes, [d]: e.target.value } })} className={`${selectCls} w-full`} aria-label={`Route for ${d}`}>
                          {[...new Set([cfg.routes[d], ...ROUTE_OPTIONS])].map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {changedRoutes.length > 0 && (
                <NoteBanner>
                  <p className="font-medium">Workflows affected</p>
                  <ul className="mt-1 space-y-0.5">
                    {changedRoutes.map((k) => <li key={k}>"{k}": {active?.data.routes[k]} → {cfg.routes[k]} · {routeAffects(def.workflows, cfg.routes[k]).join(", ")}</li>)}
                  </ul>
                </NoteBanner>
              )}
            </div>
          )}
          {section === "Confidence thresholds" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["classifier", "voice"] as const).map((k) => (
                <label key={k} className="block text-[12px] font-medium text-muted-foreground">{k === "classifier" ? "Lapse Reason Classifier" : "Voice outcomes"} (0 to 1)
                  <input disabled={locked || !mayThreshold} type="number" step={0.05} min={0} max={1} value={cfg.thresholds[k]} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, [k]: Math.min(1, Math.max(0, Number(e.target.value) || 0)) } })} className={`${inputCls} mt-1 tabular`} />
                </label>
              ))}
              <p className="text-[12px] text-muted-foreground sm:col-span-2">Results below the threshold go to a person.</p>
            </div>
          )}
          {section === "Handoff rules" && (
            <div>
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium">From</th><th className="font-medium">To</th><th className="font-medium">Trigger</th></tr></thead>
                <tbody>
                  {handoffRules.filter((r) => r.from === def.name || r.from === "Any agent").map((r) => <tr key={r.id} className="border-t border-border/60"><td className="py-1.5">{r.from}</td><td>{r.to}</td><td className="text-subtle">{r.trigger}</td></tr>)}
                </tbody>
              </table>
              <Link to="/persistency/agents" search={{ tab: "handoffs", sub: "rules" }} className="mt-2 inline-block text-[12px] text-primary hover:underline">Edit handoff rules</Link>
            </div>
          )}
          {section === "Limits" && (
            <div className="grid gap-3 sm:grid-cols-3">
              {(["tasks", "retries", "cost"] as const).map((k) => (
                <label key={k} className="block text-[12px] font-medium text-muted-foreground">{k === "cost" ? "Cost (₹)" : k[0]!.toUpperCase() + k.slice(1)} per policy per month
                  <input disabled={locked} type="number" min={0} value={cfg.limits[k]} onChange={(e) => setCfg({ ...cfg, limits: { ...cfg.limits, [k]: Math.max(0, Number(e.target.value) || 0) } })} className={`${inputCls} mt-1 tabular`} />
                </label>
              ))}
            </div>
          )}
          {section === "Conduct checks" && (
            <div className="space-y-2">
              {cfg.conduct.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input disabled={locked} value={c} onChange={(e) => setCfg({ ...cfg, conduct: cfg.conduct.map((x, j) => (j === i ? e.target.value : x)) })} className={`${inputCls} flex-1`} aria-label="Conduct check" />
                  {!locked && <Button size="icon" variant="ghost" className="size-7" aria-label="Remove check" onClick={() => setCfg({ ...cfg, conduct: cfg.conduct.filter((_, j) => j !== i) })}><Trash2 /></Button>}
                </div>
              ))}
              {!locked && <Button size="sm" variant="ghost" onClick={() => setCfg({ ...cfg, conduct: [...cfg.conduct, "New check"] })}><Plus /> Add check</Button>}
              <p className="text-[12px] text-muted-foreground">The quality agent runs these on this agent's calls and messages.</p>
            </div>
          )}
        </Panel>
        {!locked && (
          <EditFooter
            dirty={dirty}
            status={dirty ? "Unsaved changes" : draftV ? `Draft version ${draftV.no} saved` : "No unsaved changes"}
            onDiscard={() => setCfg(base)}
            onSave={() => {
              const no = saveDraft(`agent:${id}`, cfg, author, "Configuration change");
              toast.success(`Saved draft version ${no}`);
            }}
            onSubmit={() => {
              const no = draftV && !dirty ? draftV.no : saveDraft(`agent:${id}`, cfg, author, "Configuration change");
              submit({
                kind: "agent",
                objectId: id,
                objectName: def.name,
                versionNo: no,
                requestedBy: author,
                summary: agentDiff(active?.data, cfg).slice(0, 2).join("; "),
                reach: agentStats(id, 30).tasks,
                diff: agentDiff(active?.data, cfg),
                conflicts: [],
                needs: ["head"],
              });
              toast.success(`Version ${no} sent for review`, { description: "Needs Head of Persistency and Compliance and quality." });
            }}
            submitDisabled={!draftV && !dirty}
            extra={draftV && !dirty ? <Button variant="ghost" onClick={() => { discardDraft(`agent:${id}`); toast.success("Draft discarded"); }}>Delete draft</Button> : undefined}
          />
        )}
      </div>
      <Sheet open={script !== null} onOpenChange={(o) => !o && setScript(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-border bg-background sm:max-w-[560px]">
          {script !== null && cfg.scripts[script] && (
            <ScriptEditor doc={cfg.scripts[script]!} locked={locked} onChange={(d) => setCfg({ ...cfg, scripts: cfg.scripts.map((x, i) => (i === script ? d : x)) })} />
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={template !== null} onOpenChange={(o) => !o && setTemplate(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-border bg-background sm:max-w-[480px]">
          {template !== null && cfg.templates[template] && (
            <div className="space-y-3">
              <SheetHeader className="text-left"><SheetTitle className="text-[16px]">{cfg.templates[template]!.name} · {cfg.templates[template]!.language}</SheetTitle></SheetHeader>
              <textarea disabled={locked} rows={5} value={cfg.templates[template]!.text} onChange={(e) => setCfg({ ...cfg, templates: cfg.templates.map((t, i) => (i === template ? { ...t, text: e.target.value } : t)) })} aria-label="Template text" className="block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px]" />
              <p className="text-[12px] text-muted-foreground">Placeholders from policy facts: {"{customer}"}, {"{policy}"}, {"{amount}"}, {"{due}"}, {"{graceEnd}"}, {"{link}"}</p>
              <p className="text-[13px]"><Placeholders text={cfg.templates[template]!.text} /></p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Placeholders({ text }: { text: string }) {
  const parts = text.split(/(\{[a-zA-Z]+\})/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("{") ? <span key={i} className="rounded-sm bg-brand-tint px-0.5 text-primary">{p}</span> : <span key={i}>{p}</span>))}
    </>
  );
}

function ScriptEditor({ doc, locked, onChange }: { doc: ScriptDoc; locked: boolean; onChange: (d: ScriptDoc) => void }) {
  const area = (k: "opening" | "identity" | "body" | "closing", label: string) => (
    <label className="block text-[12px] font-medium text-muted-foreground">{label}
      <textarea disabled={locked} rows={2} value={doc[k]} onChange={(e) => onChange({ ...doc, [k]: e.target.value })} className="mt-1 block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px] text-foreground" />
    </label>
  );
  return (
    <div className="space-y-3">
      <SheetHeader className="text-left"><SheetTitle className="text-[16px]">{doc.product} · {doc.language}</SheetTitle></SheetHeader>
      {area("opening", "Opening line")}
      {area("identity", "Identity and consent line")}
      {area("body", "Product script")}
      <div>
        <p className="text-[12px] font-medium text-muted-foreground">Objections and responses</p>
        <div className="mt-1 space-y-2">
          {doc.objections.map((o, i) => (
            <div key={i} className="space-y-1 rounded-input border border-border p-2">
              <div className="flex items-center gap-2">
                <input disabled={locked} value={o.q} onChange={(e) => onChange({ ...doc, objections: doc.objections.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} className={`${inputCls} flex-1`} aria-label="Objection" />
                {!locked && <Button size="icon" variant="ghost" className="size-7" aria-label="Delete objection" onClick={() => onChange({ ...doc, objections: doc.objections.filter((_, j) => j !== i) })}><Trash2 /></Button>}
              </div>
              <textarea disabled={locked} rows={2} value={o.a} onChange={(e) => onChange({ ...doc, objections: doc.objections.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} aria-label={`Response to ${o.q}`} className="block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px]" />
            </div>
          ))}
          {!locked && <Button size="sm" variant="ghost" onClick={() => onChange({ ...doc, objections: [...doc.objections, { q: "New objection", a: "" }] })}><Plus /> Add objection</Button>}
        </div>
      </div>
      {area("closing", "Closing line")}
      <p className="text-[12px] text-muted-foreground">Changes go into the draft. Save the draft from the footer.</p>
    </div>
  );
}

/* ---------- Versions ---------- */

function Versions({ id }: { id: string }) {
  const saved = useWork((st) => st.versions);
  const list = useMemo(() => agentVersions(saved, id), [saved, id]);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <table className="w-full text-[13px]">
        <thead className="bg-card"><tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">{["Version", "Status", "Author", "Approver", "Time", "Change note", ""].map((h, i) => <th key={i} className="border-b border-border px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {[...list].reverse().map((v) => {
            const prev = list.find((x) => x.no === v.no - 1);
            return [
              <tr key={v.no} className="border-b border-border/60">
                <td className="px-3 py-2 tabular">v{v.no}</td>
                <td className="px-3 py-2"><span className="flex flex-wrap gap-1"><StatusChip tone={versionTone(v.status)}>{v.status}</StatusChip>{v.status === "Active" && (v.reviewedCalls ?? 30) < 30 && <StatusChip tone="neutral">Reviewed calls {v.reviewedCalls ?? 0} of 30</StatusChip>}</span></td>
                <td className="px-3 py-2">{v.author}</td>
                <td className="px-3 py-2">{v.approver ?? ""}</td>
                <td className="px-3 py-2 tabular">{dateTime(v.at)}</td>
                <td className="px-3 py-2 text-subtle">{v.note}{v.returnReason ? ` · Returned: ${v.returnReason}` : ""}</td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => setOpen(open === v.no ? null : v.no)}>{open === v.no ? "Hide diff" : "Diff"}</Button></td>
              </tr>,
              open === v.no && (
                <tr key={`${v.no}-d`} className="border-b border-border/60 bg-surface-translucent">
                  <td colSpan={7} className="px-3 py-2">
                    <ul className="space-y-1 font-mono text-[12px]">{agentDiff(prev?.data, v.data).map((d, i) => <li key={i}>{d}</li>)}</ul>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tasks ---------- */

function Tasks({ id }: { id: string }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tests = useWork((st) => st.testTasks);
  const rows = useMemo(() => [...tests.filter((t) => t.agentId === id), ...TASKS.filter((t) => t.agentId === id)].sort((a, b) => (a.at < b.at ? 1 : -1)), [tests, id]);
  const filtered = s.result ? rows.filter((t) => (s.result === "Test" ? t.test : t.result === s.result)) : rows;
  const open = rows.find((t) => t.id === s.task);
  return (
    <>
      <div className="flex items-center gap-2">
        <select value={s.result ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, result: e.target.value || undefined }) })} className={selectCls} aria-label="Result">
          <option value="">All results</option>
          {["Completed", "Handed off", "No answer", "Failed", "Test"].map((r) => <option key={r}>{r}</option>)}
        </select>
        <span className="text-[12px] text-muted-foreground tabular">{num(filtered.length)} tasks</span>
      </div>
      <DataGrid
        label="Tasks"
        rows={filtered}
        rowKey={(t) => t.id}
        onRowClick={(t) => navigate({ search: (p) => ({ ...p, task: t.id }) })}
        csvName={`${id}-tasks.csv`}
        columns={[
          { id: "at", label: "Time", value: (t) => t.at, render: (t) => <span className="flex items-center gap-1.5">{dateTime(t.at)}{t.test && <StatusChip tone="accent">Test</StatusChip>}</span> },
          { id: "policy", label: "Policy", value: (t) => t.policyId },
          { id: "trigger", label: "Trigger", value: (t) => t.trigger },
          { id: "result", label: "Result", value: (t) => t.result },
          { id: "disp", label: "Disposition", value: (t) => t.disposition ?? t.msgStatus ?? "" },
          { id: "to", label: "Handoff destination", value: (t) => t.handoffTo ?? "" },
          { id: "dur", label: "Duration", align: "right", value: (t) => t.durationSec, render: (t) => (t.durationSec ? `${t.durationSec} s` : "") },
        ]}
      />
      <Sheet open={!!open} onOpenChange={(o) => !o && navigate({ search: (p) => ({ ...p, task: undefined }) })}>
        <SheetContent side="right" className="w-full overflow-y-auto border-border bg-background sm:max-w-[560px]">{open && <TaskPacket task={open} />}</SheetContent>
      </Sheet>
    </>
  );
}

function TaskPacket({ task }: { task: AgentTask }) {
  const p = usePolicy(task.policyId);
  const addNote = useWork((s) => s.addReviewNote);
  const user = useUser();
  const mayEdit = useCan("agents.edit");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const tr = TRANSCRIPTS.find((t) => t.id === task.transcriptId);
  const th = THREADS.find((t) => t.id === task.threadId);
  const fields: [string, string][] = [
    ["Policy", p ? `${p.policyId} · ${p.customerName} · ${p.product}` : task.policyId],
    ["Premium and due date", p ? `${inr(p.annualisedPremium)} · ${p.dueDate}` : ""],
    ["Language", task.language],
    ["Workflow and step", `${task.workflow} · ${task.step}`],
    ["Trigger", task.trigger],
    ["Agent version", `v${task.agentVersion}`],
    ["Result", `${task.result}${task.disposition ? ` · ${task.disposition}` : ""}${task.reason ? ` · reason ${task.reason}` : ""}`],
    ["Rule that fired", task.ruleId],
  ];
  return (
    <div className="space-y-4">
      <SheetHeader className="text-left">
        <SheetTitle className="text-[16px]">Task {task.id}</SheetTitle>
        <p className="text-[12px] text-muted-foreground">{dateTime(task.at)}{task.test ? " · test" : ""}</p>
      </SheetHeader>
      <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-[13px]">
        {fields.map(([k, v]) => [<dt key={`${k}-k`} className="text-muted-foreground">{k}</dt>, <dd key={`${k}-v`}>{k === "Rule that fired" ? <Link to="/persistency/rules/$id" params={{ id: v }} className="text-primary hover:underline">{v}</Link> : v}</dd>])}
      </dl>
      {tr && (
        <div>
          <p className="text-[13px] font-semibold">Transcript</p>
          <ul className="mt-1 space-y-1.5">
            {tr.turns.map((t, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] gap-2 text-[13px]">
                <span><span className="font-medium text-muted-foreground">{t.speaker}:</span> {t.text}</span>
                {t.tag && <span className="h-fit rounded-pill border border-primary px-2 text-[11px] text-primary">{t.tag}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {th && (
        <div>
          <p className="text-[13px] font-semibold">Messages</p>
          <ul className="mt-1 space-y-1.5 text-[13px]">
            {th.messages.map((m, i) => <li key={i}><span className="font-medium text-muted-foreground">{m.from}:</span> {m.text.replace("{policy}", task.policyId).replace("{due}", p?.dueDate ?? "")} {m.status && <StatusChip tone="neutral">{m.status}</StatusChip>}</li>)}
          </ul>
        </div>
      )}
      <div>
        <p className="text-[13px] font-semibold">Conduct checks</p>
        <ul className="mt-1 space-y-0.5 text-[13px]">
          {task.conduct.map((c) => <li key={c.check} className="flex justify-between"><span>{c.check}</span><StatusChip tone={c.pass ? "ok" : "risk"}>{c.pass ? "Pass" : "Fail"}</StatusChip></li>)}
        </ul>
      </div>
      {mayEdit && <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>Add to script review</Button>}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md rounded-card border-border bg-card">
          <DialogHeader><DialogTitle className="text-[14px] font-semibold">Add to script review</DialogTitle></DialogHeader>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" placeholder="What should change in the script" className="block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px]" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button disabled={!note.trim()} onClick={() => { addNote(`agent:${task.agentId}`, `${task.id} (${user?.name ?? "User"}): ${note.trim()}`); setNoteOpen(false); setNote(""); toast.success("Note attached to the next draft"); }}>Attach note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Test ---------- */

function TestTab({ id }: { id: string }) {
  const numbers = useWork((s) => s.testNumbers);
  const addNumber = useWork((s) => s.addTestNumber);
  const sendTest = useWork((s) => s.sendTest);
  const tests = useWork((s) => s.testTasks);
  const saved = useWork((s) => s.versions);
  const list = useMemo(() => agentVersions(saved, id), [saved, id]);
  const last = list[list.length - 1]!;
  const navigate = useNavigate({ from: Route.fullPath });
  const [n, setN] = useState(numbers[0] ?? "");
  const [add, setAdd] = useState("");
  const valid = /^\+91 \d{5} \d{5}$/.test(add.trim());
  return (
    <Panel title="Send a test">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12px] font-medium text-muted-foreground">Registered test number
          <select value={n} onChange={(e) => setN(e.target.value)} className={`${selectCls} mt-1 block`} aria-label="Test number">{numbers.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
        <Button
          size="sm"
          disabled={!n}
          onClick={() => {
            const i = tests.length + 1;
            sendTest({
              id: `TEST-${id}-${i}`,
              agentId: id,
              agentVersion: last.no,
              policyId: "TEST-0001",
              at: "",
              trigger: `Test to ${n}`,
              workflow: "Test",
              step: id === "message" ? "Test message" : "Test call",
              result: "Completed",
              disposition: id === "renewal-voice" ? "Will pay (link requested)" : undefined,
              msgStatus: id === "message" ? "Delivered" : undefined,
              durationSec: id === "renewal-voice" ? 74 : 0,
              language: "Hindi",
              conduct: [{ check: "Identity and consent line said", pass: true }, { check: "Calling window kept", pass: true }],
              ruleId: "R02",
              cost: 0,
              test: true,
            });
            toast.success(`Test sent to ${n} with version ${last.no}`);
            navigate({ search: { tab: "tasks", result: "Test" } });
          }}
        >
          Send test
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">Uses version {last.no} ({last.status}). The result appears in Tasks, flagged as a test.</p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-[12px] font-medium text-muted-foreground">Add test number
          <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="+91 98200 00003" className={`${inputCls} mt-1 w-48`} aria-label="New test number" />
        </label>
        <Button size="sm" variant="outline" disabled={!valid} onClick={() => { addNumber(add.trim()); setN(add.trim()); setAdd(""); toast.success("Test number added"); }}>Add test number</Button>
        {add && !valid && <span className="text-[12px] text-attention">Use the form +91 98200 00003</span>}
      </div>
    </Panel>
  );
}
