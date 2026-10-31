import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Check, FileWarning, GitMerge, ShieldAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { AiMarker, DataTable, EmptyState, StatusPill } from "@/components/ds/primitives";
import { AXIS_TICK, GRID, SERIES, TOOLTIP_STYLE } from "@/components/ds/chart-theme";
import type { PanelId } from "@/config/panels";
import {
  BANK_PARTNERS,
  CITIES,
  CONDUCT_CHECKS,
  PEOPLE,
  RETENTION_OFFERS,
  UNIT_COSTS,
  agentIndex,
  bankBranch,
  bounceStage,
  cohortFileStats,
  isHoldout,
  lastMonthInsurer,
  mandateState,
  persistency,
  qaSamples,
  revivalRequirement,
  revivalStatus,
  rmName,
  stageSummary,
  wantsOutReason,
  zoneForCity,
  type Decision,
  type Policy,
  type ProductFilter,
} from "@/data/persistency";
import { cohortLabel } from "@/engine/persistency";
import { useAdapters, usePersistencyStore } from "@/store/persistency";
import { useShell } from "@/hooks/use-shell";
import { croreValue, date, inr, money, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StateBadge } from "./state-badge";
import { PersistencyTable } from "./persistency-table";
import { RunRateChart, useMonth } from "./month";
import { RecommendationsList } from "./recommendations";
import { KillSwitchControls } from "./kill-switch";
import { AuditLogTable } from "./audit-log";
import { HoldoutCompare } from "./holdout";

export interface PanelData {
  scoped: Policy[];
  all: Policy[];
  product: ProductFilter;
  decisions: Map<string, Decision>;
  openPolicy: (id: string) => void;
}
export const PanelDataContext = createContext<PanelData | null>(null);
function useData(): PanelData {
  const v = useContext(PanelDataContext);
  if (!v) throw new Error("Panel used outside PersonaHome");
  return v;
}

const CASH = new Set(["Cash/cheque", "Bank branch"]);
const HIGH = new Set(["A4", "A5", "High", "Band 4", "Band 5"]);

function first(role: string) {
  return PEOPLE.find((p) => p.role === role);
}

/* ---------- Small shared bits ---------- */

function Kpis({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
      {items.map(([l, v]) => (
        <div key={l} className="rounded-input border border-border bg-surface-translucent px-3 py-2">
          <div className="text-lg font-extrabold text-foreground tabular">{v}</div>
          <div className="text-[11px] text-muted-foreground">{l}</div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({ actKey, label, done, actor, policyId, detail }: { actKey: string; label: string; done: string; actor: string; policyId?: string; detail: string }) {
  const actions = usePersistencyStore((s) => s.personaActions);
  const record = usePersistencyStore((s) => s.recordAction);
  const value = actions[actKey];
  if (value) return <StatusPill status="healthy">{value}</StatusPill>;
  return (
    <Button
      size="sm"
      variant="tint"
      className="h-7 text-[11px]"
      onClick={() => {
        record(actor, actKey, done, policyId);
        toast(detail);
      }}
    >
      {label}
    </Button>
  );
}

function PolicyCell({ p }: { p: Policy }) {
  const { openPolicy } = useData();
  return (
    <button type="button" onClick={() => openPolicy(p.policyId)} className="cursor-pointer text-left">
      <span className="block font-semibold text-foreground tabular hover:text-primary">{p.policyId}</span>
      <span className="block text-[11px] text-muted-foreground">{p.customerName}</span>
    </button>
  );
}

function paidStats(list: Policy[]) {
  let due = 0, paid = 0, promised = 0, unpaid = 0, dueAmt = 0, paidAmt = 0;
  for (const p of list) {
    const d = p.monthDue;
    if (!d || d.status === "upcoming") continue;
    due++;
    dueAmt += d.amount;
    if (d.status === "paid") { paid++; paidAmt += d.amount; }
    else if (d.status === "promised") promised++;
    else unpaid++;
  }
  return { due, paid, promised, unpaid, dueAmt, paidAmt, rate: due ? paid / due : 0 };
}

/* ---------- CXO ---------- */

function Persistency1361() {
  const { scoped } = useData();
  return <PersistencyTable policies={scoped} compact />;
}

function CollectionVsPlan() {
  const m = useMonth();
  const share = m.col.collectedCr / Math.max(m.col.planCr, 0.0001);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="stat-number">{croreValue(m.col.collectedCr)}</span>
        <span className="text-xs text-subtle">of {croreValue(m.col.planCr)} plan · {pct(share, 0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-translucent"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, share * 100)}%` }} /></div>
      <Kpis items={[["Paid this month", num(m.col.paidCount)], ["Promised, not paid", num(m.col.promisedCount)], ["Not yet due", num(m.col.upcomingCount)]]} />
      <p className="text-[11px] text-dim">Plan from the insurer; collection rate from the seeded policies, scaled to the book.</p>
    </div>
  );
}

function MonthEndGap() {
  const m = useMonth();
  return (
    <div className="space-y-3">
      <Kpis items={[["Gap to plan", croreValue(m.gap)], ["Run-rate per day", croreValue(m.runRate, 2)], ["Needed per day", croreValue(m.required, 2)], ["Days left after today", String(m.daysLeft)], ["Month-end at run-rate", croreValue(m.projected)], ["Short at run-rate", croreValue(Math.max(0, m.col.planCr - m.projected))]]} />
      <Link to="/persistency/war-room" className="text-xs font-semibold text-primary hover:underline">Open the war room</Link>
    </div>
  );
}

function RiskFlags() {
  const { scoped, decisions } = useData();
  const adapters = useAdapters();
  const killAll = usePersistencyStore((s) => s.killSwitchGlobal);
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const flags = useMemo(() => {
    let cap = 0, conflicts = 0, highGrace = 0;
    for (const p of scoped) {
      const d = decisions.get(p.policyId);
      if (d?.ruleId === "G2") cap++;
      if (d?.conflictWith) conflicts++;
      if (p.state === "Grace" && HIGH.has(cohortLabel(p, activeCohortSet[p.product]))) highGrace++;
    }
    const qaFails = qaSamples(scoped).filter((q) => CONDUCT_CHECKS.some((c) => !q.results[c])).length;
    return { cap, conflicts, highGrace, qaFails };
  }, [scoped, decisions, activeCohortSet]);
  const stale = adapters.filter((a) => a.stale);
  const items: { icon: typeof AlertTriangle; text: string; tone: string }[] = [
    ...(killAll ? [{ icon: AlertTriangle, text: "Global kill switch is on. Nothing is being sent.", tone: "text-failed" }] : []),
    ...stale.map((a) => ({ icon: FileWarning, text: `${a.name} is late (last ${a.lastReceived}). ${a.feeds.join(", ")} paused.`, tone: "text-attention" })),
    { icon: AlertTriangle, text: `${num(flags.highGrace)} high-risk cohort policies are in grace.`, tone: "text-attention" },
    { icon: ShieldAlert, text: `${num(flags.cap)} policies held at the contact cap (G2).`, tone: "text-attention" },
    { icon: GitMerge, text: `${num(flags.conflicts)} policies match two rules equally.`, tone: "text-attention" },
    { icon: ShieldAlert, text: `${num(flags.qaFails)} of 30 sampled calls failed a conduct check.`, tone: flags.qaFails ? "text-failed" : "text-healthy" },
  ];
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.text} className="flex gap-2 text-xs text-foreground"><it.icon className={cn("mt-0.5 size-3.5 shrink-0", it.tone)} aria-hidden />{it.text}</li>
      ))}
    </ul>
  );
}

function VendorSpend() {
  const { scoped } = useData();
  const m = useMonth();
  const rows = useMemo(() => {
    return Object.entries(UNIT_COSTS).map(([vendor, c]) => {
      const list = scoped.filter((p) => p.assignedVendor === vendor);
      const touches = list.reduce((s, p) => s + p.touchesLast30d, 0);
      const spend = touches * c.cost * m.col.scale;
      const collected = list.reduce((s, p) => s + (p.monthDue?.status === "paid" ? p.monthDue.amount : 0), 0) * m.col.scale;
      return { vendor, touches, spend, collected, unit: c };
    });
  }, [scoped, m.col.scale]);
  return (
    <div>
      <DataTable head={["Vendor", "Touches (30 days)", "Spend", "Collected on its policies", "Spend per ₹100"]} minWidth={540}>
        {rows.map((r) => (
          <tr key={r.vendor}>
            <td className="font-semibold text-foreground">{r.vendor}</td>
            <td className="text-subtle tabular">{num(r.touches)}</td>
            <td className="text-subtle tabular">{money(r.spend)}</td>
            <td className="text-subtle tabular">{money(r.collected)}</td>
            <td className="text-subtle tabular">{r.collected ? inr((100 * r.spend) / r.collected) : "None"}</td>
          </tr>
        ))}
      </DataTable>
      <p className="mt-2 text-[11px] text-dim">Illustrative unit costs (for example Pace Setters ₹38 per call). Edit them in Measurement. Collected is not caused by the vendor alone.</p>
    </div>
  );
}

/* ---------- Head ---------- */

function LifecycleMap() {
  const { scoped } = useData();
  const stages = useMemo(() => stageSummary(scoped), [scoped]);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stages.map((s) => (
        <Link key={s.column} to="/persistency/lifecycle" search={(prev) => ({ ...prev, sub: `stage:${s.column}` })} className="rounded-input border border-border bg-surface-translucent p-3 hover:border-brand-tint-border">
          <p className="text-[11px] text-muted-foreground">{s.column}</p>
          <p className="text-lg font-extrabold text-foreground tabular">{num(s.count)}</p>
          <p className="text-[11px] text-subtle tabular">{money(s.premium)} at stake</p>
        </Link>
      ))}
    </div>
  );
}

function CohortPerformance() {
  const { scoped } = useData();
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const rows = useMemo(() => {
    const map = new Map<string, Policy[]>();
    for (const p of scoped) {
      const c = cohortLabel(p, activeCohortSet[p.product]);
      map.set(c, [...(map.get(c) ?? []), p]);
    }
    return [...map.entries()].map(([c, list]) => ({ c, n: list.length, ...paidStats(list) })).sort((a, b) => a.c.localeCompare(b.c));
  }, [scoped, activeCohortSet]);
  return (
    <DataTable head={["Cohort", "Policies", "Due so far", "Paid", "Promised", "Paid rate"]} minWidth={480} maxHeight={300}>
      {rows.map((r) => (
        <tr key={r.c}>
          <td className="font-semibold text-foreground">{r.c}</td>
          <td className="text-subtle tabular">{num(r.n)}</td>
          <td className="text-subtle tabular">{num(r.due)}</td>
          <td className="text-subtle tabular">{num(r.paid)}</td>
          <td className="text-subtle tabular">{num(r.promised)}</td>
          <td className="font-semibold text-foreground tabular">{pct(r.rate)}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function Approvals() {
  const pending = usePersistencyStore((s) => s.pending);
  const approve = usePersistencyStore((s) => s.approve);
  const reject = usePersistencyStore((s) => s.reject);
  const { persona } = useShell();
  if (pending.length === 0) return <EmptyState title="No approvals waiting." action={<Link to="/persistency/configuration" className="text-xs font-semibold text-primary hover:underline">Change a rule</Link>} />;
  return (
    <ul className="space-y-2">
      {pending.map((c) => (
        <li key={c.id} className="rounded-input border border-border bg-surface-translucent p-3">
          <p className="text-[13px] font-semibold text-foreground">{c.title}</p>
          <p className="text-[11px] text-muted-foreground">{c.source} · {c.proposedBy} · waits for {c.rule.needsApprovalFrom}</p>
          {c.effect && <p className="mt-1 text-xs text-subtle">{c.effect}</p>}
          {persona.id === "head" ? (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => { approve(c.id); toast(`Approved: ${c.title}`); }}><Check /> Approve</Button>
              <Button size="sm" variant="outline" onClick={() => reject(c.id)}>Reject</Button>
            </div>
          ) : (
            <StatusPill status="attention" className="mt-2">Waiting for {c.rule.needsApprovalFrom}</StatusPill>
          )}
        </li>
      ))}
    </ul>
  );
}

function GuardrailBreaches() {
  const { scoped, decisions } = useData();
  const rules = usePersistencyStore((s) => s.rules);
  const rows = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of scoped) {
      const d = decisions.get(p.policyId);
      if (d?.level === "guardrail") count.set(d.ruleId, (count.get(d.ruleId) ?? 0) + 1);
    }
    return rules.filter((r) => r.level === "guardrail").map((r) => ({ r, n: count.get(r.id) ?? 0 }));
  }, [scoped, decisions, rules]);
  return (
    <div>
      <ul className="space-y-1.5">
        {rows.map(({ r, n }) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-subtle"><span className="mr-1.5 font-bold text-primary">{r.id}</span>{r.name}</span>
            <span className="font-semibold text-foreground tabular">{num(n)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-dim">Policies where a guardrail stopped or changed the action today.</p>
    </div>
  );
}

/* ---------- Regional ---------- */

function TeamCollection() {
  const { scoped } = useData();
  const m = useMonth();
  const leads = PEOPLE.filter((p) => p.role === "Team lead");
  const rows = useMemo(() => {
    return leads
      .map((lead, t) => {
        const list = scoped.filter((p) => Math.floor(agentIndex(p) / 5) === t);
        return { lead, ...paidStats(list) };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [scoped, leads]);
  return (
    <DataTable head={["#", "Team", "Region", "Due so far", "Collected", "Paid rate"]} minWidth={520} maxHeight={340}>
      {rows.map((r, i) => (
        <tr key={r.lead.id}>
          <td className="text-muted-foreground tabular">{i + 1}</td>
          <td className="font-semibold text-foreground">{r.lead.name}</td>
          <td className="text-subtle">{r.lead.region}</td>
          <td className="text-subtle tabular">{num(r.due)}</td>
          <td className="text-subtle tabular">{money(r.paidAmt * m.col.scale)}</td>
          <td className="font-semibold text-foreground tabular">{pct(r.rate)}</td>
        </tr>
      ))}
    </DataTable>
  );
}

/* ---------- Team lead ---------- */

const CALLABLE = new Set(["Grace", "Promised", "Lapsed early", "Revival offered", "Renewal window open"]);

function useTeam(t = 0) {
  const { scoped, decisions } = useData();
  const agents = PEOPLE.filter((p) => p.role === "Agent").slice(t * 5, t * 5 + 5);
  return useMemo(() => {
    const list = scoped.filter((p) => Math.floor(agentIndex(p) / 5) === t);
    const callable = list.filter((p) => CALLABLE.has(p.state) && !decisions.get(p.policyId)?.frozen);
    return { agents, list, callable };
  }, [scoped, decisions, t, agents]);
}

function AgentQueues() {
  const { agents, callable } = useTeam();
  const actions = usePersistencyStore((s) => s.personaActions);
  return (
    <DataTable head={["Agent", "In queue", "Grace", "Promised", "Reassigned in"]} minWidth={440}>
      {agents.map((a, k) => {
        const mine = callable.filter((p) => agentIndex(p) % 5 === k);
        const moved = Object.entries(actions).filter(([key, v]) => key.startsWith("reassign:") && v.includes(a.name)).length;
        return (
          <tr key={a.id}>
            <td className="font-semibold text-foreground">{a.name}</td>
            <td className="text-subtle tabular">{num(mine.length)}</td>
            <td className="text-subtle tabular">{num(mine.filter((p) => p.state === "Grace").length)}</td>
            <td className="text-subtle tabular">{num(mine.filter((p) => p.state === "Promised").length)}</td>
            <td className="text-subtle tabular">{moved ? `${moved} batch` : "None"}</td>
          </tr>
        );
      })}
    </DataTable>
  );
}

function PromisedVsPaid() {
  const { list } = useTeam();
  const s = paidStats(list);
  const data = [{ name: "This month", Paid: s.paid, Promised: s.promised, Unpaid: s.unpaid }];
  return (
    <div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={70} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="Paid" stackId="a" fill={SERIES[4]} />
            <Bar dataKey="Promised" stackId="a" fill={SERIES[0]} />
            <Bar dataKey="Unpaid" stackId="a" fill={SERIES[2]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-subtle">{num(s.paid)} paid, {num(s.promised)} promised and waiting, {num(s.unpaid)} unpaid of {num(s.due)} due so far. A promise counts as kept only when the receipt arrives.</p>
    </div>
  );
}

function CallsPending() {
  const { callable } = useTeam();
  const { decisions } = useData();
  const rows = callable.slice().sort((a, b) => (a.graceEnd < b.graceEnd ? -1 : 1)).slice(0, 8);
  if (!rows.length) return <EmptyState title="No calls pending for your team in this view." />;
  return (
    <DataTable head={["Policy", "State", "Grace ends", "Next action"]} minWidth={480}>
      {rows.map((p) => (
        <tr key={p.policyId}>
          <td><PolicyCell p={p} /></td>
          <td><StateBadge state={p.state} /></td>
          <td className="text-subtle tabular">{date(p.graceEnd)}</td>
          <td className="text-foreground"><span className="mr-1 text-[10px] font-bold text-primary">{decisions.get(p.policyId)?.ruleId}</span>{decisions.get(p.policyId)?.action}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function VendorSplit() {
  const { callable } = useTeam();
  const { decisions } = useData();
  const rows = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of callable) {
      const e = decisions.get(p.policyId)?.executor ?? "None";
      m.set(e, (m.get(e) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [callable, decisions]);
  return (
    <ul className="space-y-1.5">
      {rows.map(([e, n]) => (
        <li key={e} className="grid grid-cols-[130px_1fr_40px] items-center gap-2 text-xs">
          <span className="text-subtle">{e}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-translucent"><span className="block h-full rounded-full bg-primary" style={{ width: `${(n / Math.max(callable.length, 1)) * 100}%` }} /></span>
          <span className="text-right font-semibold text-foreground tabular">{num(n)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Sales officer and zonal ---------- */

export function useBranch() {
  const { scoped } = useData();
  const receipts = usePersistencyStore((s) => s.receipts);
  return useMemo(() => {
    const city = CITIES[0]!.city;
    const list = scoped
      .filter((p) => p.city === city && CASH.has(p.paymentMethod) && (p.state === "Grace" || p.state === "Lapsed early" || (p.state === "Renewal window open" && p.monthDue)))
      .sort((a, b) => (agentIndex(a, 997) - agentIndex(b, 997)));
    const flagged = list.filter((p) => receipts.includes(p.policyId) || p.monthDue?.status === "paid");
    return { city, list, flagged, receipts };
  }, [scoped, receipts]);
}

function VisitList() {
  const { city, list, receipts } = useBranch();
  const me = first("Sales officer");
  if (!list.length) return <EmptyState title={`No cash or cheque payers due in ${city} for this product.`} />;
  return (
    <div>
      <p className="mb-2 text-xs text-subtle">{city} branch · {num(list.length)} stops · route order by locality</p>
      <DataTable head={["Stop", "Customer", "Amount", "Due", "State", "Flag", ""]} minWidth={720} maxHeight={420}>
        {list.slice(0, 25).map((p, i) => {
          const paid = receipts.includes(p.policyId) || p.monthDue?.status === "paid";
          return (
            <tr key={p.policyId}>
              <td className="text-muted-foreground tabular">{i + 1}</td>
              <td><PolicyCell p={p} /></td>
              <td className="text-subtle tabular">{inr(p.monthDue?.amount ?? p.instalmentAmount)}</td>
              <td className="text-subtle tabular">{date(p.dueDate)}</td>
              <td><StateBadge state={p.state} /></td>
              <td>{paid ? <StatusPill status="healthy">Paid meanwhile, skip</StatusPill> : p.paymentMethod === "Bank branch" ? <StatusPill status="simulated">Branch payer: receipt may lag</StatusPill> : null}</td>
              <td><ActionButton actKey={`visit:${p.policyId}`} label="Mark visited" done="Visited" actor={me?.name ?? "Sales officer"} policyId={p.policyId} detail={`Visit logged for ${p.policyId}`} /></td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}

function PaidMeanwhileFlags() {
  const { list, flagged } = useBranch();
  const branchPayers = list.filter((p) => p.paymentMethod === "Bank branch").length;
  return (
    <div className="space-y-3">
      <Kpis items={[["Paid meanwhile, visit skipped", num(flagged.length)], ["Branch payers on the list", num(branchPayers)], ["Stops left", num(list.length - flagged.length)]]} />
      <p className="text-xs text-subtle">The receipts file is re-read before each visit. Payments at a bank branch reach the file a day later, so those stops show a caution flag.</p>
    </div>
  );
}

function useZone() {
  const { scoped } = useData();
  const actions = usePersistencyStore((s) => s.personaActions);
  return useMemo(() => {
    const zone = zoneForCity("Delhi");
    const cities = CITIES.filter((c) => zoneForCity(c.city) === zone).map((c) => c.city);
    const rows = cities.map((city) => {
      const list = scoped.filter((p) => p.city === city);
      const s = paidStats(list);
      const grace = list.filter((p) => p.state === "Grace");
      const early = list.filter((p) => p.state === "Lapsed early");
      const visitsPlanned = grace.filter((p) => CASH.has(p.paymentMethod));
      const visitsDone = visitsPlanned.filter((p) => p.lastTouchChannel === "Field visit" || actions[`visit:${p.policyId}`]).length;
      const old = grace.filter((p) => p.dueDate < "2026-10-14").length;
      return { city, list, s, grace: grace.length, early: early.length, old, planned: visitsPlanned.length, done: visitsDone };
    });
    return { zone, rows };
  }, [scoped, actions]);
}

function BranchComparison() {
  const { zone, rows } = useZone();
  return (
    <div>
      <p className="mb-2 text-xs text-subtle">Zone {zone}</p>
      <DataTable head={["Branch", "Policies", "Due so far", "Paid rate", "In grace"]} minWidth={460}>
        {rows.map((r) => (
          <tr key={r.city}>
            <td className="font-semibold text-foreground">{r.city}</td>
            <td className="text-subtle tabular">{num(r.list.length)}</td>
            <td className="text-subtle tabular">{num(r.s.due)}</td>
            <td className="font-semibold text-foreground tabular">{pct(r.s.rate)}</td>
            <td className="text-subtle tabular">{num(r.grace)}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

function Backlog() {
  const { rows } = useZone();
  return (
    <DataTable head={["Branch", "Grace over 14 days", "Lapsed early", "Total backlog"]} minWidth={420}>
      {rows.map((r) => (
        <tr key={r.city}>
          <td className="font-semibold text-foreground">{r.city}</td>
          <td className="text-subtle tabular">{num(r.old)}</td>
          <td className="text-subtle tabular">{num(r.early)}</td>
          <td className="font-semibold text-foreground tabular">{num(r.old + r.early)}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function VisitCompletion() {
  const { rows } = useZone();
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.city} className="grid grid-cols-[100px_1fr_70px] items-center gap-2 text-xs">
          <span className="text-subtle">{r.city}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-translucent"><span className="block h-full rounded-full bg-primary" style={{ width: `${(r.done / Math.max(r.planned, 1)) * 100}%` }} /></span>
          <span className="text-right font-semibold text-foreground tabular">{r.done} of {r.planned}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Bank partner ---------- */

function useBank() {
  const { scoped } = useData();
  return useMemo(() => {
    const bank = BANK_PARTNERS[0];
    const list = scoped.filter((p) => p.sourceBankOrAdvisor === bank);
    const branches = new Map<string, Policy[]>();
    for (const p of list) {
      const b = bankBranch(p);
      if (b) branches.set(b, [...(branches.get(b) ?? []), p]);
    }
    const rows = [...branches.entries()].map(([branch, ps]) => {
      const per = persistency(ps)[0]!;
      return { branch, ps, inWindow: ps.filter((p) => p.lifecycleStage === "Renewal window" && p.state !== "Paid").length, grace: ps.filter((p) => p.state === "Grace").length, p13: per.eligible ? per.premiumWeighted : null, n13: per.eligible, s: paidStats(ps) };
    }).sort((a, b) => b.ps.length - a.ps.length);
    return { bank, list, rows };
  }, [scoped]);
}

function BankBranches() {
  const { bank, list, rows } = useBank();
  return (
    <div>
      <p className="mb-2 text-xs text-subtle">{bank} · {num(list.length)} policies</p>
      <DataTable head={["Branch", "Policies", "In window, unpaid", "Paid rate this month", "13M persistency"]} minWidth={560} maxHeight={320}>
        {rows.map((r) => (
          <tr key={r.branch}>
            <td className="font-semibold text-foreground">{r.branch.split(", ")[1]}</td>
            <td className="text-subtle tabular">{num(r.ps.length)}</td>
            <td className="text-subtle tabular">{num(r.inWindow)}</td>
            <td className="text-subtle tabular">{pct(r.s.rate)}</td>
            <td className="font-semibold text-foreground tabular">{r.p13 === null ? "Too few" : `${pct(r.p13)} (${r.n13})`}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

function RmList() {
  const { rows } = useBank();
  const me = first("Bank partner manager");
  return (
    <DataTable head={["RM", "Branch", "Customers to chase", ""]} minWidth={460} maxHeight={320}>
      {rows.map((r) => (
        <tr key={r.branch}>
          <td className="font-semibold text-foreground">{rmName(r.branch)}</td>
          <td className="text-subtle">{r.branch.split(", ")[1]}</td>
          <td className="text-subtle tabular">{num(r.inWindow)}</td>
          <td>{r.inWindow > 0 && <ActionButton actKey={`nudge:${r.branch}`} label="Send nudge" done="Queued (simulated in this build)" actor={me?.name ?? "Bank partner manager"} detail={`Nudge queued for ${rmName(r.branch)} with ${r.inWindow} customers (simulated)`} />}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function RmNudges() {
  const actions = usePersistencyStore((s) => s.personaActions);
  const { list } = useBank();
  const sent = Object.keys(actions).filter((k) => k.startsWith("nudge:"));
  const seeded = list.filter((p) => p.lastTouchChannel === "Bank RM").length;
  return (
    <div className="space-y-2">
      <Kpis items={[["RM touches in last 30 days", num(seeded)], ["Nudges queued this session", num(sent.length)]]} />
      <ul className="space-y-1 text-xs">
        {sent.map((k) => (
          <li key={k} className="flex items-center justify-between gap-2"><span className="text-subtle">{rmName(k.slice(6))}</span><StatusPill status="simulated">Queued (simulated in this build)</StatusPill></li>
        ))}
      </ul>
      <p className="text-[11px] text-dim">Nudges go to RMs by email or WhatsApp. No delivered or read state is shown in this build.</p>
    </div>
  );
}

/* ---------- HNI ---------- */

function useHni() {
  const { scoped, decisions } = useData();
  return useMemo(
    () => scoped.filter((p) => p.annualisedPremium >= 500_000 && (p.lifecycleStage === "Renewal window" || p.lifecycleStage === "Early lapse") && p.state !== "Paid").sort((a, b) => b.annualisedPremium - a.annualisedPremium).map((p) => ({ p, d: decisions.get(p.policyId)! })),
    [scoped, decisions],
  );
}

function HniList() {
  const rows = useHni();
  if (!rows.length) return <EmptyState title="No high-ticket policies due in this view." />;
  return (
    <DataTable head={["Policy", "Premium", "State", "Due", "Next action"]} minWidth={560} maxHeight={360}>
      {rows.slice(0, 20).map(({ p, d }) => (
        <tr key={p.policyId}>
          <td><PolicyCell p={p} /></td>
          <td className="font-semibold text-foreground tabular">{inr(p.annualisedPremium)}</td>
          <td><StateBadge state={p.state} /></td>
          <td className="text-subtle tabular">{date(p.dueDate)}</td>
          <td className="text-foreground"><span className="mr-1 text-[10px] font-bold text-primary">{d.ruleId}</span>{d.action}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function RelationshipNotes() {
  const rows = useHni().slice(0, 4);
  return (
    <ul className="space-y-2">
      {rows.map(({ p }) => (
        <li key={p.policyId} className="rounded-input border border-border bg-surface-translucent p-2.5 text-xs">
          <div className="flex items-center justify-between"><span className="font-semibold text-foreground">{p.customerName}</span><AiMarker /></div>
          <p className="mt-1 text-subtle">
            {p.customerProfile} customer in {p.city}, prefers {p.language}. {p.policyYear > 3 ? `With us ${p.policyYear} years.` : "Early in the policy."}{" "}
            {p.advisorStatus === "Left" ? "Original advisor has left; needs a named contact." : p.lastTouchChannel ? `Last spoke via ${p.lastTouchChannel.toLowerCase()}.` : "No recent contact."}
          </p>
        </li>
      ))}
      <p className="text-[11px] text-dim">Canned notes built from policy fields in this build.</p>
    </ul>
  );
}

function OutreachDrafts() {
  const rows = useHni().slice(0, 3);
  const me = first("HNI desk");
  return (
    <ul className="space-y-2">
      {rows.map(({ p }) => (
        <li key={p.policyId} className="rounded-input border border-border bg-surface-translucent p-3 text-xs">
          <div className="flex items-center justify-between"><span className="font-semibold text-foreground">{p.customerName} · {p.policyId}</span><AiMarker /></div>
          <p className="mt-1.5 text-subtle">
            Dear {p.customerName.split(" ")[0]}, your {p.product} policy renews on {date(p.dueDate)} for {inr(p.annualisedPremium)}. I would be glad to walk you through your {p.product === "ULIP" ? "fund performance" : "benefits"} and the payment options at a time that suits you. Regards, {me?.name ?? "HNI desk"}, Sample Life Insurance.
          </p>
          <div className="mt-2"><ActionButton actKey={`outreach:${p.policyId}`} label="Approve outreach" done="Approved, queued (simulated)" actor={me?.name ?? "HNI desk"} policyId={p.policyId} detail={`Outreach approved for ${p.customerName}`} /></div>
        </li>
      ))}
      {rows.length === 0 && <EmptyState title="No drafts. Nothing high-ticket is due in this view." />}
    </ul>
  );
}

/* ---------- Retention, underwriting, ops ---------- */

function WantsOutQueue() {
  const { scoped } = useData();
  const me = first("Surrender retention");
  const rows = scoped.filter((p) => p.state === "Surrender-intent");
  if (!rows.length) return <EmptyState title="Nobody is asking to surrender in this view." />;
  return (
    <DataTable head={["Policy", "Product", "Premium", "Reason", "Offer", "Next step"]} minWidth={760} maxHeight={420}>
      {rows.slice(0, 25).map((p) => (
        <tr key={p.policyId}>
          <td><PolicyCell p={p} /></td>
          <td className="text-subtle">{p.product}</td>
          <td className="text-subtle tabular">{inr(p.annualisedPremium)}</td>
          <td className="text-subtle">{wantsOutReason(p)}</td>
          <td className="text-subtle">{RETENTION_OFFERS[p.product][0]}</td>
          <td><ActionButton actKey={`retain:${p.policyId}`} label="Offer alternative" done="Offer made" actor={me?.name ?? "Retention desk"} policyId={p.policyId} detail={`Offered "${RETENTION_OFFERS[p.product][0]}" to ${p.customerName}`} /></td>
        </tr>
      ))}
    </DataTable>
  );
}

function RetentionOffers() {
  const { scoped } = useData();
  return (
    <ul className="space-y-3">
      {(Object.keys(RETENTION_OFFERS) as (keyof typeof RETENTION_OFFERS)[]).map((prod) => (
        <li key={prod}>
          <p className="text-xs font-semibold text-foreground">{prod} · {num(scoped.filter((p) => p.product === prod && p.state === "Surrender-intent").length)} in queue</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-subtle">{RETENTION_OFFERS[prod].map((o) => <li key={o}>{o}</li>)}</ul>
        </li>
      ))}
    </ul>
  );
}

function RevivalMedicals() {
  const { scoped } = useData();
  const me = first("Underwriter");
  const rows = scoped.filter((p) => p.lifecycleStage === "Late lapse" && p.state === "Revival offered");
  if (!rows.length) return <EmptyState title="No late-lapse revivals waiting for underwriting in this view." />;
  return (
    <DataTable head={["Policy", "Product", "Premium", "Lapsed on", "Needs", "Status", "Decision"]} minWidth={820} maxHeight={480}>
      {rows.slice(0, 30).map((p) => {
        const st = revivalStatus(p);
        const ready = st === "Declaration received" || st === "Medical reports in";
        return (
          <tr key={p.policyId}>
            <td><PolicyCell p={p} /></td>
            <td className="text-subtle">{p.product}</td>
            <td className="text-subtle tabular">{inr(p.annualisedPremium)}</td>
            <td className="text-subtle tabular">{p.lapseDate ? date(p.lapseDate) : ""}</td>
            <td className="text-subtle">{revivalRequirement(p)}</td>
            <td><StatusPill status={ready ? "healthy" : "attention"}>{st}</StatusPill></td>
            <td className="space-x-1 whitespace-nowrap">
              {ready ? (
                <>
                  <ActionButton actKey={`uw:${p.policyId}`} label="Clear" done="Cleared for revival" actor={me?.name ?? "Underwriting"} policyId={p.policyId} detail={`${p.policyId} cleared for revival`} />
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">Waiting</span>
              )}
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}

function MandateStatus() {
  const { scoped } = useData();
  const rows = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of scoped) {
      const st = mandateState(p);
      if (st) m.set(st, (m.get(st) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [scoped]);
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="space-y-2">
      {rows.map(([st, n]) => (
        <div key={st} className="grid grid-cols-[170px_1fr_60px] items-center gap-2 text-xs">
          <span className="text-subtle">{st}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-translucent"><span className={cn("block h-full rounded-full", st === "Active" ? "bg-healthy" : st === "Rejected by bank" ? "bg-failed" : "bg-attention")} style={{ width: `${(n / Math.max(total, 1)) * 100}%` }} /></span>
          <span className="text-right font-semibold text-foreground tabular">{num(n)}</span>
        </div>
      ))}
      <p className="text-[11px] text-dim">From mandate_status, received 28 Oct 2026 05:41. Bank responses are simulated.</p>
    </div>
  );
}

function BounceReturns() {
  const { scoped } = useData();
  const me = first("Ops / remittance");
  const rows = scoped.filter((p) => p.reasonCode === "Mandate bounce" || (p.reasonCode === "Mandate failed" && p.lifecycleStage !== "Late lapse"));
  const failed = rows.filter((p) => bounceStage(p) === "Failed again");
  const actions = usePersistencyStore((s) => s.personaActions);
  return (
    <div className="space-y-3">
      <Kpis items={[["Bounces and failures", num(rows.length)], ["Failed again after retry", num(failed.length)], ["Retry batches this session", num(Object.keys(actions).filter((k) => k.startsWith("retry")).length)]]} />
      <DataTable head={["Policy", "Method", "Amount", "Reason", "Re-presentation", ""]} minWidth={720} maxHeight={360}>
        {rows.slice(0, 20).map((p) => (
          <tr key={p.policyId}>
            <td><PolicyCell p={p} /></td>
            <td className="text-subtle">{p.paymentMethod}</td>
            <td className="text-subtle tabular">{inr(p.instalmentAmount)}</td>
            <td className="text-subtle">{p.reasonCode}</td>
            <td><StatusPill status={bounceStage(p) === "Failed again" ? "failed" : "simulated"}>{bounceStage(p)}</StatusPill></td>
            <td>{bounceStage(p) === "Failed again" && <ActionButton actKey={`retry-one:${p.policyId}`} label="Retry" done="Retry queued (simulated)" actor={me?.name ?? "Ops"} policyId={p.policyId} detail={`Retry queued for ${p.policyId} (simulated)`} />}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

/* ---------- MIS ---------- */

function FileFreshness() {
  const adapters = useAdapters();
  return (
    <DataTable head={["File", "Last received", "Rows", "Rejects", "Status"]} minWidth={520}>
      {adapters.map((a) => (
        <tr key={a.id}>
          <td className="font-semibold text-foreground">{a.name}</td>
          <td className="text-subtle tabular">{a.lastReceived}</td>
          <td className="text-subtle tabular">{num(a.rows)}</td>
          <td className="text-subtle tabular">{num(a.rejects)}</td>
          <td>{!a.enabled ? <StatusPill status="simulated">Off</StatusPill> : a.stale ? <StatusPill status="attention">Late</StatusPill> : <StatusPill status="healthy">On time</StatusPill>}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function CohortUploads() {
  const { scoped } = useData();
  const file = usePersistencyStore((s) => s.cohortFile);
  const stats = useMemo(() => cohortFileStats(scoped), [scoped]);
  return (
    <div className="space-y-2 text-xs">
      {file ? <p className="text-subtle">Last file: <span className="font-semibold text-foreground">{file.droppedName}</span> on {date(file.at)}</p> : <p className="text-subtle">No cohort file loaded.</p>}
      <Kpis items={[["Matched", num(stats.matched)], ["Not on the book", num(stats.unmatched)], ["Unscored on book", num(stats.unscoredOnBook)]]} />
      <Link to="/persistency/cohorts" className="font-semibold text-primary hover:underline">Open Cohorts</Link>
    </div>
  );
}

function Drift() {
  const { scoped } = useData();
  const changed = useMemo(() => scoped.filter((p) => lastMonthInsurer(p) !== p.insurerCohort).length, [scoped]);
  return (
    <div className="space-y-2 text-xs">
      <Kpis items={[["Changed insurer cohort since September", num(changed)], ["Share of book", pct(changed / Math.max(scoped.length, 1))]]} />
      <Link to="/persistency/cohorts" search={(prev) => ({ ...prev, tab: "compare" as const })} className="font-semibold text-primary hover:underline">See drift by band</Link>
    </div>
  );
}

function Holdout() {
  const { scoped } = useData();
  const size = scoped.filter(isHoldout).length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-subtle">{num(size)} policies ({pct(size / Math.max(scoped.length, 1))}) sit in the fixed 15% holdout and receive insurer business-as-usual only.</p>
      <HoldoutCompare policies={scoped} height={150} />
    </div>
  );
}

/* ---------- Compliance ---------- */

function ContactBreaches() {
  const { scoped, decisions } = useData();
  const cap = scoped.filter((p) => decisions.get(p.policyId)?.ruleId === "G2");
  const near = scoped.filter((p) => p.touchesLast30d >= 6 && p.touchesLast30d < 8);
  return (
    <div className="space-y-2">
      <Kpis items={[["At the cap (8 in 30 days), held", num(cap.length)], ["Close to the cap (6 or 7)", num(near.length)]]} />
      <p className="text-[11px] text-dim">G2 holds outreach once a customer has 8 touches in 30 days, across all vendors.</p>
    </div>
  );
}

function Consent() {
  const { scoped } = useData();
  const dnd = scoped.filter((p) => p.state === "Do-not-contact").length;
  const holds = scoped.filter((p) => p.state === "Complaint-hold" || p.state === "Bereavement-hold").length;
  const qa = qaSamples(scoped);
  const lang = qa.filter((q) => !q.results["Language matches customer"]).length;
  return <Kpis items={[["Do-not-contact", num(dnd)], ["Complaint or bereavement holds", num(holds)], ["Language mismatches in QA sample", `${lang} of ${qa.length}`]]} />;
}

function QaSamplesPanel() {
  const { scoped } = useData();
  const qa = useMemo(() => qaSamples(scoped), [scoped]);
  return (
    <DataTable head={["Sample", "Policy", "Executor", ...CONDUCT_CHECKS.map((c) => c.split(" ").slice(0, 2).join(" "))]} minWidth={760} maxHeight={320}>
      {qa.map((q) => (
        <tr key={q.id}>
          <td className="text-muted-foreground tabular">{q.id}</td>
          <td className="font-semibold text-foreground tabular">{q.policyId}</td>
          <td className="text-subtle">{q.executor}</td>
          {CONDUCT_CHECKS.map((c) => <td key={c}>{q.results[c] ? <StatusPill status="healthy">Pass</StatusPill> : <StatusPill status="failed">Fail</StatusPill>}</td>)}
        </tr>
      ))}
    </DataTable>
  );
}

/* ---------- Registry ---------- */

export const PANEL_COMPONENTS: Record<PanelId, () => ReactNode> = {
  "persistency-13-61": Persistency1361,
  "collection-vs-plan": CollectionVsPlan,
  "month-end-gap": MonthEndGap,
  "risk-flags": RiskFlags,
  "vendor-spend": VendorSpend,
  "lifecycle-map": LifecycleMap,
  "run-rate": () => <RunRateChart height={220} />,
  "cohort-performance": CohortPerformance,
  approvals: Approvals,
  "guardrail-breaches": GuardrailBreaches,
  "team-collection": TeamCollection,
  reallocations: () => <RecommendationsList compact />,
  "agent-queues": AgentQueues,
  "promised-vs-paid": PromisedVsPaid,
  "calls-pending": CallsPending,
  "vendor-split": VendorSplit,
  handoff: () => null,
  "visit-list": VisitList,
  "paid-meanwhile-flags": PaidMeanwhileFlags,
  "branch-comparison": BranchComparison,
  backlog: Backlog,
  "visit-completion": VisitCompletion,
  "bank-branches": BankBranches,
  "rm-list": RmList,
  "rm-nudges": RmNudges,
  "hni-list": HniList,
  "relationship-notes": RelationshipNotes,
  "outreach-drafts": OutreachDrafts,
  "wants-out-queue": WantsOutQueue,
  "retention-offers": RetentionOffers,
  "revival-medicals": RevivalMedicals,
  "mandate-status": MandateStatus,
  "bounce-returns": BounceReturns,
  "file-freshness": FileFreshness,
  "cohort-uploads": CohortUploads,
  drift: Drift,
  holdout: Holdout,
  "contact-breaches": ContactBreaches,
  consent: Consent,
  "qa-samples": QaSamplesPanel,
  "kill-switch": () => <KillSwitchControls />,
  "audit-log": () => <AuditLogTable maxHeight={320} />,
};

/** Wide panels span two columns on large screens. */
export const WIDE_PANELS = new Set<PanelId>(["vendor-spend", "lifecycle-map", "run-rate", "visit-list", "bank-branches", "hni-list", "wants-out-queue", "revival-medicals", "bounce-returns", "qa-samples", "kill-switch", "audit-log", "team-collection", "reallocations"]);
