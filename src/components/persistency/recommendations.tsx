import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, StatusPill } from "@/components/ds/primitives";
import { CITIES, type Policy, type Rule } from "@/data/persistency";
import { cohortLabel } from "@/engine/persistency";
import { useShell } from "@/hooks/use-shell";
import { usePersistencyStore } from "@/store/persistency";
import { money, num, pct } from "@/lib/format";
import { useMonth } from "./month";

interface Rec {
  id: string;
  title: string;
  why: string;
  count: number;
  effect: string;
  assumption: string;
  rule: Rule;
  editable: boolean;
  executor?: string | undefined;
}

const HIGH = new Set(["A4", "A5", "High", "Band 4", "Band 5"]);
const CASH = new Set(["Cash/cheque", "Bank branch"]);

function paidRate(list: Policy[]): { rate: number; n: number } {
  let due = 0, paid = 0;
  for (const p of list) {
    if (!p.monthDue || p.monthDue.status === "upcoming") continue;
    due++;
    if (p.monthDue.status === "paid") paid++;
  }
  return { rate: due ? paid / due : 0, n: due };
}

export function useRecommendations(): Rec[] {
  const m = useMonth();
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  return useMemo(() => {
    const out: Rec[] = [];
    const policies = m.scoped;
    const avgInstalment = (() => {
      const due = policies.filter((p) => p.monthDue);
      return due.reduce((s, p) => s + (p.monthDue?.amount ?? 0), 0) / Math.max(due.length, 1);
    })();

    // 1. Move grace calls for the high-risk cohort with the most Pace Setters calls.
    const byCohort = new Map<string, Policy[]>();
    for (const p of policies) {
      if (p.state !== "Grace" || p.assignedVendor !== "Pace Setters") continue;
      const c = cohortLabel(p, activeCohortSet[p.product]);
      if (!HIGH.has(c)) continue;
      byCohort.set(c, [...(byCohort.get(c) ?? []), p]);
    }
    const top = [...byCohort.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (top) {
      const [cohort, list] = top;
      const same = policies.filter((p) => cohortLabel(p, activeCohortSet[p.product]) === cohort);
      const rP = paidRate(same.filter((p) => p.assignedVendor === "Pace Setters"));
      const rD = paidRate(same.filter((p) => p.assignedVendor === "Desible"));
      const lift = Math.max(0, rD.rate - rP.rate);
      const lo = Math.round(list.length * lift * 0.5), hi = Math.round(list.length * lift);
      out.push({
        id: "WR1",
        title: `Move ${num(list.length)} grace calls from Pace Setters to Desible for cohort ${cohort}`,
        why: `${num(list.length)} ${cohort} policies in grace sit with Pace Setters. This month ${cohort} paid at ${pct(rP.rate)} with Pace Setters (${num(rP.n)} due) and ${pct(rD.rate)} with Desible (${num(rD.n)} due).`,
        count: list.length,
        effect: lift > 0 ? `Between ${num(lo)} and ${num(hi)} more policies paid (${money(lo * avgInstalment * m.col.scale)} to ${money(hi * avgInstalment * m.col.scale)})` : "No gain expected from this month's rates; approve only to test",
        assumption: "Assumes moved calls convert somewhere between half of and the full gap between the two vendors' paid rates on the same cohort this month.",
        editable: true,
        executor: "Desible",
        rule: {
          id: "R-WR1", name: `Grace ${cohort}: ${"Desible"} voice instead of Pace Setters`, stage: "Renewal window", level: "rule", priority: 17,
          source: "Proposed by Desible, insurer to confirm",
          when: { state: ["Grace"], cohort: [cohort], executor: ["Pace Setters"] },
          then: { workflowId: "R2", action: "Desible voice call, telecall fallback", executor: "Desible", delayHours: 1, target: `Move up to ${list.length} calls` },
          effectiveFrom: "2026-10-28", needsApprovalFrom: "Head of Persistency",
        },
      });
    }

    // 2. Extend field visits to the branch with the most unpaid cash payers in grace.
    const byCity = new Map<string, Policy[]>();
    for (const p of policies) if (p.state === "Grace" && CASH.has(p.paymentMethod)) byCity.set(p.city, [...(byCity.get(p.city) ?? []), p]);
    const city = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (city) {
      const [name, list] = city;
      const region = CITIES.find((c) => c.city === name)?.region ?? "West";
      const cash = policies.filter((p) => CASH.has(p.paymentMethod));
      const visited = paidRate(cash.filter((p) => p.lastTouchChannel === "Field visit"));
      const others = paidRate(cash.filter((p) => p.lastTouchChannel !== "Field visit"));
      const lift = Math.max(0, visited.rate - others.rate);
      const lo = Math.round(list.length * lift * 0.5), hi = Math.round(list.length * lift);
      out.push({
        id: "WR2",
        title: `Extend field visits to the ${name} branch`,
        why: `${num(list.length)} cash or branch payers in ${name} are in grace. Visited cash payers paid at ${pct(visited.rate)} this month (${num(visited.n)} due) against ${pct(others.rate)} for those not visited.`,
        count: list.length,
        effect: lift > 0 ? `Between ${num(lo)} and ${num(hi)} more policies paid (${money(lo * avgInstalment * m.col.scale)} to ${money(hi * avgInstalment * m.col.scale)})` : "No gain expected from this month's rates",
        assumption: "Assumes newly visited customers pay at between half of and the full difference seen between visited and not-visited cash payers this month.",
        editable: false,
        rule: {
          id: "R-WR2", name: `${name} branch: field visits for cash payers in grace`, stage: "Renewal window", level: "rule", priority: 16,
          source: "Proposed by Desible, insurer to confirm",
          when: { state: ["Grace"], paymentMethod: ["Cash/cheque", "Bank branch"], language: [region] },
          then: { workflowId: "R5", action: `Schedule field visit (${name} branch)`, executor: "Sales officer", delayHours: 24 },
          effectiveFrom: "2026-10-28", needsApprovalFrom: "Regional lead",
        },
      });
    }

    // 3. Pause outreach to branch payers who may have paid meanwhile.
    const branchGrace = policies.filter((p) => p.state === "Grace" && p.paymentMethod === "Bank branch");
    out.push({
      id: "WR3",
      title: "Pause outreach for a day to branch payers who may have paid meanwhile",
      why: `Branch payments reach the receipts file a day late. ${num(branchGrace.length)} branch payers are in grace and could be called after they have paid.`,
      count: branchGrace.length,
      effect: `Up to ${num(branchGrace.length)} fewer calls to people who already paid. Collection timing moves by one day; no collection gain is claimed.`,
      assumption: "Assumes branch receipts keep arriving one day late, as in the last 30 days of the receipts file.",
      editable: false,
      rule: {
        id: "R-WR3", name: "Branch payers in grace: wait one day for the receipt", stage: "Renewal window", level: "rule", priority: 14,
        source: "Proposed by Desible, insurer to confirm",
        when: { state: ["Grace"], paymentMethod: ["Bank branch"] },
        then: { workflowId: "X2", action: "Wait one day for branch receipt, then call", executor: "Desible", delayHours: 24 },
        effectiveFrom: "2026-10-28", needsApprovalFrom: "Head of Persistency",
      },
    });
    return out;
  }, [m, activeCohortSet]);
}

export function RecommendationsList({ compact }: { compact?: boolean }) {
  const recs = useRecommendations();
  const pending = usePersistencyStore((s) => s.pending);
  const rules = usePersistencyStore((s) => s.rules);
  const propose = usePersistencyStore((s) => s.propose);
  const log = usePersistencyStore((s) => s.log);
  const { persona } = useShell();
  const [ignored, setIgnored] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, { count: number; executor: string }>>({});
  const [editing, setEditing] = useState<Rec | null>(null);
  const [draft, setDraft] = useState({ count: 0, executor: "Desible" });

  const visible = recs.filter((r) => !ignored.includes(r.id));
  if (visible.length === 0) return <EmptyState title="No recommendations left. Ignored ones come back tomorrow if the numbers still support them." />;

  return (
    <>
      <ul className="space-y-3">
        {visible.map((r) => {
          const e = edits[r.id];
          const count = e?.count ?? r.count;
          const executor = e?.executor ?? r.executor;
          const isPending = pending.some((c) => c.rule.id === r.rule.id);
          const isLive = rules.some((x) => x.id === r.rule.id);
          return (
            <li key={r.id} className="rounded-input border border-border bg-surface-translucent p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status="live">Rule-based</StatusPill>
                {isPending && <StatusPill status="attention">Waiting for {r.rule.needsApprovalFrom}</StatusPill>}
                {isLive && <StatusPill status="healthy">Live</StatusPill>}
              </div>
              <p className="mt-1.5 text-[13px] font-semibold text-foreground">
                {e ? r.title.replace(num(r.count), num(count)).replace("to Desible", `to ${executor}`) : r.title}
              </p>
              {!compact && <p className="mt-0.5 text-xs text-subtle">{r.why}</p>}
              <p className="mt-1.5 text-xs text-foreground">Expected effect: {r.effect}</p>
              <p className="text-[11px] text-muted-foreground">Assumption: {r.assumption}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={isPending || isLive}
                  onClick={() => {
                    const rule: Rule = e
                      ? { ...r.rule, name: r.rule.name.replace("Desible", e.executor), then: { ...r.rule.then, executor: e.executor, action: `${e.executor} call, telecall fallback`, target: `Move up to ${e.count} calls` } }
                      : r.rule;
                    propose({
                      id: `PC-${r.id}`,
                      title: e ? `Move ${num(count)} grace calls to ${executor}` : r.title,
                      source: "War-room recommendation",
                      proposedBy: `${persona.label} (war room)`,
                      at: new Date().toISOString(),
                      rule,
                      effect: `${r.effect}. ${r.assumption}`,
                    });
                    toast("Pending change written to the engine", { description: `Waits for ${r.rule.needsApprovalFrom}.` });
                  }}
                >
                  <Check /> Approve
                </Button>
                {r.editable && (
                  <Button size="sm" variant="outline" disabled={isPending || isLive} onClick={() => { setEditing(r); setDraft({ count, executor: executor ?? "Desible" }); }}>
                    <Pencil /> Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIgnored((x) => [...x, r.id]);
                    log({ actor: persona.label, kind: "rule-change", detail: `Ignored recommendation: ${r.title}` });
                  }}
                >
                  <X /> Ignore
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit recommendation</DialogTitle>
            <DialogDescription>{editing?.why}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="text-xs text-subtle">
              Calls to move (up to {num(editing?.count ?? 0)})
              <Input type="number" min={1} max={editing?.count ?? 1} value={draft.count} onChange={(ev) => setDraft((d) => ({ ...d, count: Math.max(1, Math.min(editing?.count ?? 1, Number(ev.target.value))) }))} className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs" />
            </label>
            <label className="text-xs text-subtle">
              Move to
              <Select value={draft.executor} onValueChange={(v) => setDraft((d) => ({ ...d, executor: v }))}>
                <SelectTrigger className="mt-1 h-8 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {["Desible", "ATS", "Ubona"].map((x) => <SelectItem key={x} value={x} className="text-xs">{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => { if (editing) setEdits((x) => ({ ...x, [editing.id]: draft })); setEditing(null); }}>Save edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
