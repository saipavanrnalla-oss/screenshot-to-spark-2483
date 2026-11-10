import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ds/primitives";
import { StatusChip } from "@/components/r1/status-chip";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { BASE_POLICIES, hashId, type Policy } from "@/data/persistency";
import { gate } from "@/lib/gate";
import { useUser } from "@/hooks/use-user";

export const Route = createFileRoute("/persistency/decisions")({
  beforeLoad: ({ search }) => gate("decisions", search),
  head: () => ({ meta: [{ title: "Waivers and changes · Persistency · desible.ai" }] }),
  component: DecisionsPage,
});

type Kind = "Mode change" | "Late-fee waiver" | "Health declaration waiver" | "Revival offer";

interface Request {
  id: string;
  kind: Kind;
  policy: Policy;
  age: number;
  ask: string;
  atStake: number;
  rule: string;
  meetsRule: boolean;
  evidence: string;
  raisedBy: string;
  recommended: "Approve" | "Decline";
  hoursOpen: number;
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-IN")}`;

function buildRequests(): Request[] {
  const pick = (pred: (p: Policy) => boolean, n: number) => BASE_POLICIES.filter(pred).slice(0, n);
  const out: Request[] = [];
  const h = (p: Policy, s: string) => hashId(p.policyId + s) % 100;
  for (const p of pick((x) => x.state === "Grace" && x.paymentMode === "Annual", 4)) {
    const monthly = (p.annualisedPremium / 12) * 1.04;
    out.push({ id: `MC-${p.policyId.slice(-4)}`, kind: "Mode change", policy: p, age: 30 + (h(p, "a") % 30), ask: `Annual to monthly: ${rs(p.annualisedPremium)} once becomes ${rs(monthly)} a month`, atStake: p.annualisedPremium, rule: "Mode change in the Grace Period needs GM sign-off; first monthly instalment collected on approval", meetsRule: true, evidence: "Customer: \"I can't pay the full amount now, but I can manage something every month.\"", raisedBy: "Persistency callers", recommended: "Approve", hoursOpen: 3 + (h(p, "h") % 30) });
  }
  for (const p of pick((x) => x.lifecycleStage === "Early lapse", 4)) {
    const fee = p.instalmentAmount * 0.015 * (1 + (h(p, "m") % 4));
    out.push({ id: `LF-${p.policyId.slice(-4)}`, kind: "Late-fee waiver", policy: p, age: 28 + (h(p, "a") % 35), ask: `Waive late fee of ${rs(fee)} if the premium of ${rs(p.instalmentAmount)} is paid this week`, atStake: p.instalmentAmount, rule: "Late-fee waiver up to Rs 5,000 for a first lapse; above that, Head of Persistency", meetsRule: fee <= 5000 && p.priorLatePayments === 0, evidence: "Customer: \"I will pay today if the penalty is removed; I was in hospital last month.\"", raisedBy: "Persistency callers", recommended: fee <= 5000 && p.priorLatePayments === 0 ? "Approve" : "Decline", hoursOpen: 1 + (h(p, "h") % 40) });
  }
  for (const p of pick((x) => x.lifecycleStage === "Late lapse", 4)) {
    const age = 25 + (h(p, "a") % 40);
    const sumAtRisk = p.annualisedPremium * 10 - p.annualisedPremium * (p.instalmentsPaid / 4);
    const meets = age < 45 && p.annualisedPremium < 50_000 && sumAtRisk < 1_000_000;
    out.push({ id: `DG-${p.policyId.slice(-4)}`, kind: "Health declaration waiver", policy: p, age, ask: `Revive without a declaration of good health. Premium held in suspense: ${rs(p.instalmentAmount)}`, atStake: p.annualisedPremium, rule: `Waive between 180 and 365 days when age is under 45, annualised premium under Rs 50,000 and sum at risk under Rs 10 lakh. Age ${age}, premium ${rs(p.annualisedPremium)}, sum at risk ${rs(sumAtRisk)}`, meetsRule: meets, evidence: "Money received, reinstatement pending the declaration. If not reinstated in 30 days it is refunded.", raisedBy: "Revival underwriting", recommended: meets ? "Approve" : "Decline", hoursOpen: 5 + (h(p, "h") % 50) });
  }
  for (const p of pick((x) => x.lifecycleStage === "Late lapse" && x.annualisedPremium > 60_000, 2)) {
    out.push({ id: `RV-${p.policyId.slice(-4)}`, kind: "Revival offer", policy: p, age: 40 + (h(p, "a") % 20), ask: "Vintage lapse campaign: waive penalty interest and the reinstatement requirement for a limited period", atStake: p.annualisedPremium, rule: "Campaign list approved by the Head of Persistency; each offer signed by GM", meetsRule: true, evidence: "Customer agreed to pay the pending premiums if the interest is waived.", raisedBy: "Specialist vendor, variable payout", recommended: "Approve", hoursOpen: 10 + (h(p, "h") % 30) });
  }
  return out;
}

const REQUESTS = buildRequests();

interface Decision { verdict: "Approved" | "Declined"; by: string; note: string; at: string }
const useDecisions = create<{ d: Record<string, Decision>; decide: (id: string, x: Decision) => void }>()(
  persist((set, get) => ({ d: {}, decide: (id, x) => set({ d: { ...get().d, [id]: x } }) }), { name: "pct-gm-decisions-v1", storage: createJSONStorage(() => localStorage) }),
);

function DecisionsPage() {
  const user = useUser();
  const { d, decide } = useDecisions();
  const [kind, setKind] = useState<"All" | Kind>("All");
  const [note, setNote] = useState<Record<string, string>>({});
  const open = useMemo(() => REQUESTS.filter((r) => !d[r.id] && (kind === "All" || r.kind === kind)), [d, kind]);
  const done = REQUESTS.filter((r) => d[r.id]);
  const atStake = open.reduce((a, r) => a + r.atStake, 0);

  const act = (r: Request, verdict: Decision["verdict"]) => {
    decide(r.id, { verdict, by: user?.name ?? "GM, Persistency", note: note[r.id] ?? "", at: new Date().toISOString() });
    toast.success(`${r.id} ${verdict.toLowerCase()}. ${verdict === "Approved" ? "The policy continues in its workflow." : "The caller is told the reason."}`);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader title="Waivers and changes" meta={`${open.length} waiting · ${rs(atStake)} annualised premium depends on them · mode changes, late-fee and health-declaration waivers, revival offers`} />
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={selectCls} aria-label="Type">{["All", "Mode change", "Late-fee waiver", "Health declaration waiver", "Revival offer"].map((x) => <option key={x}>{x}</option>)}</select>
        <Link to="/persistency/scripts" className="ml-auto text-[13px] font-medium text-primary hover:underline">Script sign-offs</Link>
      </div>
      {open.map((r) => (
        <article key={r.id} className="panel space-y-3 p-4">
          <header className="flex flex-wrap items-start gap-2">
            <div className="flex-1">
              <p className="text-[12px] text-muted-foreground">{r.id} · {r.kind} · raised by {r.raisedBy} · open {r.hoursOpen} h</p>
              <p className="text-[14px] font-semibold text-foreground">{r.policy.customerName} · {r.policy.policyId} · {r.policy.product} · {r.policy.paymentMode}</p>
            </div>
            <StatusChip tone={r.meetsRule ? "ok" : "risk"}>{r.meetsRule ? "Within the rule" : "Outside the rule"}</StatusChip>
          </header>
          <p className="text-[13px] text-foreground">{r.ask}</p>
          <div className="grid gap-3 text-[13px] md:grid-cols-2">
            <div className="rounded-card border border-border p-3"><p className="text-[12px] text-muted-foreground">Rule</p><p>{r.rule}</p></div>
            <div className="rounded-card border border-border p-3"><p className="text-[12px] text-muted-foreground">Evidence</p><p>{r.evidence}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-[12px] text-muted-foreground">Recommended: <span className="font-medium text-foreground">{r.recommended}</span> · {rs(r.atStake)} annualised premium</span>
            <input value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} placeholder="Note to the caller (optional)" className={`${inputCls} ml-auto max-w-[280px]`} aria-label={`Note on ${r.id}`} />
            <Button size="sm" variant="outline" onClick={() => act(r, "Declined")}>Decline</Button>
            <Button size="sm" onClick={() => act(r, "Approved")}>Approve</Button>
          </div>
        </article>
      ))}
      {done.length > 0 && (
        <section className="panel p-4">
          <h2 className="mb-2 text-[14px] font-semibold text-foreground">Decided</h2>
          <ul className="space-y-1 text-[13px]">{done.map((r) => <li key={r.id}>{r.id} · {r.kind} · {r.policy.customerName}: <span className="font-medium">{d[r.id]!.verdict}</span> by {d[r.id]!.by}{d[r.id]!.note ? `, "${d[r.id]!.note}"` : ""}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
