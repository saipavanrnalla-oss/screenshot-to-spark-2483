import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatusPill } from "@/components/ds/primitives";
import { CHANGE_LABEL, PANEL_META } from "@/config/panels";
import type { PersonaConfig } from "@/config/personas";
import { BANK_PARTNERS, CITIES, PEOPLE, agentIndex, bankBranch, revivalStatus, rmName, sinceYesterday } from "@/data/persistency";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useDecisions, usePersistencyStore } from "@/store/persistency";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PanelDataContext, PANEL_COMPONENTS, WIDE_PANELS } from "./persona-panels";
import { HandoffScreen } from "./handoff-screen";
import { PolicyDrawer } from "./policy-drawer";
import { useRecommendations } from "./recommendations";

function ChangesStrip({ persona }: { persona: PersonaConfig }) {
  const { scoped } = useScopedPolicies();
  const audit = usePersistencyStore((s) => s.audit);
  const changes = useMemo(() => sinceYesterday(scoped), [scoped]);
  const sessionChanges = audit.filter((a) => a.kind === "approval" || a.kind === "rule-change" || a.kind === "outcome").length;
  return (
    <div className="flex flex-wrap items-stretch gap-2 rounded-card border border-border bg-surface-translucent p-2" aria-label="What changed since yesterday">
      <span className="flex items-center px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">What changed since yesterday</span>
      {persona.changes.map((k) => (
        <span key={k} className="flex items-baseline gap-1.5 rounded-input border border-border bg-card px-3 py-1.5">
          <span className="text-sm font-extrabold text-foreground tabular">{num(changes[k] ?? 0)}</span>
          <span className="text-[11px] text-subtle">{CHANGE_LABEL[k]}</span>
        </span>
      ))}
      <span className="flex items-baseline gap-1.5 rounded-input border border-border bg-card px-3 py-1.5">
        <span className="text-sm font-extrabold text-foreground tabular">{num(sessionChanges)}</span>
        <span className="text-[11px] text-subtle">Changes and outcomes logged</span>
      </span>
    </div>
  );
}

function PrimaryAction({ persona }: { persona: PersonaConfig }) {
  const { scoped } = useScopedPolicies();
  const record = usePersistencyStore((s) => s.recordAction);
  const actions = usePersistencyStore((s) => s.personaActions);
  const receipts = usePersistencyStore((s) => s.receipts);
  const recs = useRecommendations();
  const propose = usePersistencyStore((s) => s.propose);
  const pending = usePersistencyStore((s) => s.pending);
  const [dialog, setDialog] = useState(false);
  const [from, setFrom] = useState("0");
  const [to, setTo] = useState("1");
  const me = PEOPLE.find((p) => p.role === persona.role);
  const actor = me ? `${me.name} (${persona.label})` : persona.label;
  const kind = persona.primaryAction.kind;
  const label = persona.primaryAction.label;

  if (kind === "open-war-room") return <Button asChild><Link to="/persistency/collections">{label} <ArrowRight /></Link></Button>;
  if (kind === "approve-rule") return <Button asChild><Link to="/persistency/rules">{label} <ArrowRight /></Link></Button>;
  if (kind === "upload-cohort") return <Button asChild><Link to="/persistency/cohorts">{label} <ArrowRight /></Link></Button>;
  if (kind === "pause-workflow") return <Button asChild><Link to="/persistency/contact-policy">{label} <ArrowRight /></Link></Button>;
  if (kind === "log-outcome") return null;

  const act = () => {
    if (kind === "reassign-cohort") {
      const r = recs[0];
      if (!r) return toast("No reallocation is supported by the numbers right now.");
      if (pending.some((c) => c.rule.id === r.rule.id)) return toast("Already waiting for approval", { description: r.title });
      propose({ id: `PC-${r.id}`, title: r.title, source: "War-room recommendation", proposedBy: actor, at: new Date().toISOString(), rule: r.rule, effect: `${r.effect}. ${r.assumption}` });
      return toast("Reassignment sent for approval", { description: r.title });
    }
    if (kind === "reassign-calls") return setDialog(true);
    if (kind === "escalate") {
      const city = CITIES.find((c) => c.city === "Delhi")!.city;
      record(actor, `escalate:${city}`, `Escalated ${city} backlog to regional lead`);
      return toast(`Escalated the ${city} backlog to the regional lead`);
    }
    if (kind === "send-rm-nudge") {
      const bank = BANK_PARTNERS[0];
      const branches = [...new Set(scoped.filter((p) => p.sourceBankOrAdvisor === bank && p.lifecycleStage === "Renewal window" && p.state !== "Paid").map((p) => bankBranch(p)!))];
      const next = branches.find((b) => !actions[`nudge:${b}`]);
      if (!next) return toast("Every RM with customers to chase has a nudge queued.");
      record(actor, `nudge:${next}`, "Queued (simulated in this build)");
      return toast(`Nudge queued for ${rmName(next)} (simulated)`);
    }
    if (kind === "retry-batch") {
      const n = scoped.filter((p) => p.reasonCode === "Mandate bounce").length;
      record(actor, `retry:batch-${Object.keys(actions).length}`, `Retry batch of ${n} approved`);
      return toast(`Retry batch of ${num(n)} bounces approved`, { description: "Re-presentation is simulated in this build." });
    }
    const pickNext = (prefix: string, list: { policyId: string }[]) => list.find((p) => !actions[`${prefix}:${p.policyId}`]);
    if (kind === "mark-visited") {
      const city = CITIES[0]!.city;
      const p = pickNext("visit", scoped.filter((x) => x.city === city && (x.paymentMethod === "Cash/cheque" || x.paymentMethod === "Bank branch") && (x.state === "Grace" || x.state === "Lapsed early" || (x.state === "Renewal window open" && x.monthDue))).sort((a, b) => agentIndex(a, 997) - agentIndex(b, 997)).filter((x) => !receipts.includes(x.policyId)));
      if (!p) return toast("No visits left on today's list.");
      record(actor, `visit:${p.policyId}`, "Visited", p.policyId);
      return toast(`Visit logged for ${p.policyId}`);
    }
    if (kind === "approve-outreach") {
      const p = pickNext("outreach", scoped.filter((x) => x.annualisedPremium >= 500_000 && (x.lifecycleStage === "Renewal window" || x.lifecycleStage === "Early lapse") && x.state !== "Paid").sort((a, b) => b.annualisedPremium - a.annualisedPremium).slice(0, 3));
      if (!p) return toast("All drafts on screen are approved.");
      record(actor, `outreach:${p.policyId}`, "Approved, queued (simulated)", p.policyId);
      return toast(`Outreach approved for ${p.policyId}`);
    }
    if (kind === "offer-alternative") {
      const p = pickNext("retain", scoped.filter((x) => x.state === "Surrender-intent"));
      if (!p) return toast("Everyone in the queue has an offer.");
      record(actor, `retain:${p.policyId}`, "Offer made", p.policyId);
      return toast(`Offer made to ${p.policyId}`);
    }
    if (kind === "clear-refer") {
      const p = pickNext("uw", scoped.filter((x) => x.lifecycleStage === "Late lapse" && x.state === "Revival offered" && (revivalStatus(x) === "Declaration received" || revivalStatus(x) === "Medical reports in")));
      if (!p) return toast("Nothing ready to clear.");
      record(actor, `uw:${p.policyId}`, "Cleared for revival", p.policyId);
      return toast(`${p.policyId} cleared for revival`);
    }
    return undefined;
  };

  const agents = PEOPLE.filter((p) => p.role === "Agent").slice(0, 5);
  return (
    <>
      <Button onClick={act}>{label}</Button>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign calls</DialogTitle>
            <DialogDescription>Move today's pending calls from one agent to another in your team.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[["From", from, setFrom], ["To", to, setTo]].map(([l, v, set]) => (
              <label key={l as string} className="text-xs text-subtle">
                {l as string}
                <Select value={v as string} onValueChange={set as (x: string) => void}>
                  <SelectTrigger className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-border bg-card">{agents.map((a, k) => <SelectItem key={a.id} value={String(k)} className="text-xs">{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button
              disabled={from === to}
              onClick={() => {
                const a = agents[Number(from)]!, b = agents[Number(to)]!;
                record(actor, `reassign:${Date.now()}`, `Calls moved from ${a.name} to ${b.name}`);
                toast(`Calls moved from ${a.name} to ${b.name}`);
                setDialog(false);
              }}
            >
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PersonaHome({ persona }: { persona: PersonaConfig }) {
  const { scoped, all, product } = useScopedPolicies();
  const decisions = useDecisions(scoped);
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);
  const me = PEOPLE.find((p) => p.role === persona.role);
  const isAgent = persona.panels.includes("handoff");
  const tiers = [...new Set(persona.panels.flatMap((id) => PANEL_META[id].tiers))];
  const ctx = useMemo(() => ({ scoped, all, product, decisions, openPolicy: setOpenPolicy }), [scoped, all, product, decisions]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow={`Work queue · ${persona.label}`}
        title={persona.landsOn}
        description={`${me ? `Viewing as ${me.name}, ${persona.label}` : persona.label}. ${product === "All" ? "All products" : product} · 28 Oct 2026.`}
        tiers={tiers}
        actions={<PrimaryAction persona={persona} />}
      />
      <ChangesStrip persona={persona} />
      <PanelDataContext.Provider value={ctx}>
        {isAgent ? (
          <HandoffScreen />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {persona.panels.map((id) => {
              const Comp = PANEL_COMPONENTS[id];
              return (
                <Panel key={id} title={PANEL_META[id].title} tiers={[...PANEL_META[id].tiers]} className={cn(WIDE_PANELS.has(id) && "lg:col-span-2")}>
                  <Comp />
                </Panel>
              );
            })}
          </div>
        )}
      </PanelDataContext.Provider>
      {!isAgent && (
        <p className="text-[11px] text-dim">
          Primary action: <span className="font-semibold text-subtle">{persona.primaryAction.label}</span>. Every action here is written to the audit log. <StatusPill status="simulated" className="ml-1">Payments and sends simulated</StatusPill>
        </p>
      )}
      <PolicyDrawer policyId={openPolicy} onClose={() => setOpenPolicy(null)} />
    </div>
  );
}
