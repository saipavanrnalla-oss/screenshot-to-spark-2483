import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiMarker, Chip, EmptyState, Eyebrow, Panel, StatusPill } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { DIMENSION_LABEL, PEOPLE, VENDORS, agentIndex, type DimensionKey, type Policy } from "@/data/persistency";
import { OBJECTIONS as OBJECTIONS_LIST, OUTCOMES, SCRIPTS, fillScript } from "@/data/persistency/scripts";
import { baseTimeline, cohortLabel, LEVEL_LABEL } from "@/engine/persistency";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useDecisions, useEngineContext, usePersistencyStore } from "@/store/persistency";
import { date, inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StateBadge } from "./state-badge";
import { SendTestButton } from "./send-test";
import { PolicyDrawer } from "./policy-drawer";

const CALLABLE = new Set(["Grace", "Promised", "Lapsed early", "Revival offered", "Renewal window open"]);
const ORDER: Record<string, number> = { Grace: 0, Promised: 1, "Renewal window open": 2, "Lapsed early": 3, "Revival offered": 4 };
function callable(p: Policy): boolean {
  if (!CALLABLE.has(p.state)) return false;
  if (p.lifecycleStage === "Late lapse") return false;
  if (p.state === "Renewal window open") return !!p.monthDue;
  return true;
}
const TELECALL = new Set(["Pace Setters", "ATS", "Desible", "Ubona"]);

function summary(p: Policy): string {
  const touches = baseTimeline(p).filter((t) => t.kind === "touch").slice(0, 3);
  if (touches.length === 0) return "No touches in the last 30 days. First contact in this window.";
  const parts = touches.map((t) => `${t.title.replace(/:.*/, "")} on ${date(t.at)}`);
  const reason = p.reasonCode !== "None" ? ` Last reason given: ${p.reasonCode.toLowerCase()}.` : "";
  return `${touches.length} recent touches: ${parts.join("; ")}.${reason} Prefers ${p.language}.`;
}

export function HandoffScreen() {
  const { scoped } = useScopedPolicies();
  const ctx = useEngineContext();
  const decisions = useDecisions(scoped);
  const receipts = usePersistencyStore((s) => s.receipts);
  const vendorModes = usePersistencyStore((s) => s.vendorModes);
  const actions = usePersistencyStore((s) => s.personaActions);
  const logOutcome = usePersistencyStore((s) => s.logOutcome);
  const me = PEOPLE.find((p) => p.role === "Agent");
  const [i, setI] = useState(0);
  const [objection, setObjection] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);

  const queue = useMemo(
    () =>
      scoped
        .filter((p) => agentIndex(p) % 20 === 0 && (callable(p) || actions[`outcome:${p.policyId}`]))
        .filter((p) => {
          const d = decisions.get(p.policyId);
          return !!d && (TELECALL.has(d.executor) || !!actions[`outcome:${p.policyId}`]);
        })
        .sort((a, b) => (ORDER[a.state] ?? 9) - (ORDER[b.state] ?? 9) || (a.graceEnd < b.graceEnd ? -1 : 1))
        .slice(0, 30),
    [scoped, decisions, actions],
  );
  const idx = Math.min(i, Math.max(0, queue.length - 1));
  const p = queue[idx];

  if (!p) {
    return <EmptyState title="Your queue is empty for this product filter. Switch the product to All to see more calls." />;
  }
  const d = decisions.get(p.policyId)!;
  const script = SCRIPTS[p.product];
  const vars = { policy: p.policyId, amount: inr(p.monthDue?.amount ?? p.instalmentAmount), due: date(p.dueDate) };
  const logged = actions[`outcome:${p.policyId}`];
  const paidMeanwhile = receipts.includes(p.policyId) || p.monthDue?.status === "paid";
  const vendor = VENDORS.find((v) => v.name === d.executor);
  const observe = vendor && vendorModes[vendor.id] === "Observe";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          {me?.name ?? "Agent"} · Call {idx + 1} of {queue.length} in your queue · grace first, then promises, then early lapse
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => { setI(idx - 1); setObjection(null); }}><ChevronLeft /> Previous</Button>
          <Button variant="outline" size="sm" disabled={idx >= queue.length - 1} onClick={() => { setI(idx + 1); setObjection(null); }}>Next <ChevronRight /></Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_1fr_300px]">
        {/* Customer card */}
        <Panel eyebrow="Customer" title={p.customerName} tiers={["live-engine"]}>
          <div className="flex flex-wrap gap-1.5">
            <StateBadge state={p.state} />
            <Chip>{p.lifecycleStage}</Chip>
            <Chip>Cohort {cohortLabel(p, ctx.activeCohortSet[p.product])}</Chip>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {[
              ["Policy", p.policyId],
              ["Product", p.product],
              ["Premium", inr(p.annualisedPremium)],
              ["Instalment", inr(p.instalmentAmount)],
              ["Mode", p.paymentMode],
              ["Method", p.paymentMethod],
              ["Due date", date(p.dueDate)],
              ["Grace ends", date(p.graceEnd)],
              ["Language", p.language],
              ["City", p.city],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="font-semibold text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <Button variant="ghost" size="sm" className="mt-3 px-0 text-primary" onClick={() => setOpenPolicy(p.policyId)}>Open full timeline</Button>
        </Panel>

        {/* Why + script */}
        <div className="space-y-4">
          <Panel eyebrow="Why this call, why now" title={<span><span className="mr-1.5 rounded-sm bg-brand-tint px-1.5 py-0.5 text-[11px] text-primary">{d.ruleId}</span>{d.ruleName}</span>} tiers={["live-engine"]}>
            <p className="text-[11px] text-muted-foreground">Precedence {LEVEL_LABEL[d.level]} · next action: {d.action} via {d.executor}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(d.matchedDimensions).map(([k, v]) => (
                <Chip key={k} active><span className="text-muted-foreground">{DIMENSION_LABEL[k as DimensionKey]}:</span> {v}</Chip>
              ))}
            </div>
            {observe && <p className="mt-2"><StatusPill status="simulated">{d.executor} is in Observe mode: Desible suggests, {d.executor} acts on its own list</StatusPill></p>}
            {d.frozen && <p className="mt-2"><StatusPill status="failed">Outreach frozen. Do not call.</StatusPill></p>}
            <p className="mt-2 text-[11px] text-dim">The decision and the script are chosen by rules, not by AI.</p>
          </Panel>

          <Panel eyebrow={`Script · ${p.product}`} title="What to say" tiers={["live-engine"]}>
            <ol className="space-y-2 text-[13px] text-foreground">
              <li>{fillScript(script.opening, vars)}</li>
              <li>{fillScript(script.value, vars)}</li>
              <li>{fillScript(script.ask, vars)}</li>
            </ol>
            <Eyebrow className="mt-4">If the customer says</Eyebrow>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OBJECTIONS_LIST.map((o) => (
                <Chip key={o.key} active={objection === o.key} onClick={() => setObjection(objection === o.key ? null : o.key)}>{o.label}</Chip>
              ))}
            </div>
            {objection && (
              <p className="mt-3 rounded-input border border-border bg-surface-translucent p-3 text-xs text-subtle">
                {OBJECTIONS_LIST.find((o) => o.key === objection)?.reply}
              </p>
            )}
          </Panel>
        </div>

        {/* Outcomes */}
        <div className="space-y-4">
          <Panel eyebrow="Before you dial" title="Paid meanwhile?" tiers={["simulated"]}>
            <Button variant="tint" size="sm" onClick={() => setChecked((c) => ({ ...c, [p.policyId]: true }))}>
              <ReceiptText /> Re-read latest receipts
            </Button>
            {checked[p.policyId] && (
              <div className="mt-2 space-y-1">
                {paidMeanwhile ? <StatusPill status="healthy">Paid meanwhile. Do not call.</StatusPill> : <StatusPill status="attention">No receipt found. Go ahead.</StatusPill>}
                <p className="text-[11px] text-muted-foreground">Checked receipts file received 28 Oct 2026, 07:05. Branch payments can arrive a day late.</p>
              </div>
            )}
          </Panel>

          <Panel eyebrow="Outcome" title={logged ? `Logged: ${logged}` : "Log the call"} tiers={["live-engine"]}>
            <div className="grid gap-2">
              {OUTCOMES.map((o) => (
                <Button
                  key={o}
                  variant={logged === o ? "default" : "outline"}
                  size="sm"
                  className={cn("justify-start", (o === "Wants to surrender" || o === "Complaint raised") && "text-attention")}
                  onClick={() => {
                    logOutcome(p.policyId, o, me ? `${me.name} (agent)` : "Agent");
                    toast(`${o}: ${p.policyId}`, { description: "State, next action and audit log updated." });
                    if (idx < queue.length - 1) { setI(idx + 1); setObjection(null); }
                  }}
                >
                  {o}
                </Button>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Last touches" title={<span className="flex items-center gap-2">Summary <AiMarker /></span>} tiers={["live-engine"]}>
            <p className="text-xs text-subtle">{summary(p)}</p>
            <p className="mt-2 text-[11px] text-dim">Canned summary built from the timeline in this build.</p>
          </Panel>

          <div className="flex items-center gap-2">
            <SendTestButton what={`Payment link WhatsApp for ${p.product} (${p.language})`} />
            <TierBadge tiers={["live-channels"]} />
          </div>
        </div>
      </div>

      <Panel eyebrow="Your queue" title={`${queue.length} calls`} tiers={["live-engine"]} bodyClassName="p-0">
        <ul className="divide-y divide-border/70">
          {queue.map((q, k) => (
            <li key={q.policyId}>
              <button type="button" onClick={() => { setI(k); setObjection(null); }} className={cn("grid w-full cursor-pointer grid-cols-[110px_1fr_auto] items-center gap-3 px-5 py-2 text-left text-xs transition-colors", k === idx ? "bg-brand-tint" : "hover:bg-surface-translucent")}>
                <span className="font-semibold text-foreground tabular">{q.policyId}</span>
                <span className="truncate text-subtle">{q.customerName} · {q.product} · grace ends {date(q.graceEnd)}</span>
                {actions[`outcome:${q.policyId}`] ? <StatusPill status="healthy">{actions[`outcome:${q.policyId}`]}</StatusPill> : <StateBadge state={q.state} />}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <PolicyDrawer policyId={openPolicy} onClose={() => setOpenPolicy(null)} />
    </div>
  );
}
