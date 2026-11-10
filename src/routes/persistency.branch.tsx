import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ds/primitives";
import { StatusChip } from "@/components/r1/status-chip";
import { selectCls } from "@/components/r1/tabs";
import { sellerOf, slice, total } from "@/components/r1/cohort-model";
import { BASE_POLICIES } from "@/data/persistency";
import { branchOf } from "@/data/persistency/r1/common";
import { gate } from "@/lib/gate";
import { date } from "@/lib/format";

export const Route = createFileRoute("/persistency/branch")({
  beforeLoad: ({ search }) => gate("branch", search),
  head: () => ({ meta: [{ title: "My branch · Persistency · desible.ai" }] }),
  component: BranchPage,
});

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-IN")}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const BANK_BRANCHES = (() => {
  const m = new Map<string, number>();
  for (const p of BASE_POLICIES) if (p.channel === "Bancassurance") m.set(branchOf(p), (m.get(branchOf(p)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
})();

function BranchPage() {
  const [branch, setBranch] = useState(BANK_BRANCHES[0] ?? "");
  const [sent, setSent] = useState<Record<string, string>>({});
  const mine = useMemo(() => BASE_POLICIES.filter((p) => branchOf(p) === branch), [branch]);
  const bookRate = useMemo(() => total(slice(BASE_POLICIES, 13, "Channel")).rate, []);
  const here = total(slice(mine, 13, "Channel"));
  const sellers = slice(mine, 13, "Seller").sort((a, b) => a.rate - b.rate);
  const due = mine.filter((p) => p.monthDue).sort((a, b) => (a.monthDue!.date < b.monthDue!.date ? -1 : 1));
  const unpaid = due.filter((p) => p.monthDue!.status !== "paid");
  const grace = mine.filter((p) => p.state === "Grace" || p.state === "Promised");
  const visits = grace.filter((p) => p.annualisedPremium >= 50_000).slice(0, 8);
  const mark = (id: string, what: string) => { setSent({ ...sent, [id]: what }); toast.success(what); };

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <PageHeader title="My branch" meta="Your due list, the policies at risk, and what each seller needs to do today" />
      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">Branch
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className={selectCls} aria-label="Branch">{BANK_BRANCHES.map((b) => <option key={b}>{b}</option>)}</select>
      </label>
      <section className="grid gap-3 md:grid-cols-4">
        <Kpi label="13th-month persistency" value={pct(here.rate)} sub={`Book ${pct(bookRate)} · ${here.rate >= bookRate ? "above" : "below"} the book`} />
        <Kpi label="Due this month" value={`${due.length}`} sub={`${rs(due.reduce((a, p) => a + p.monthDue!.amount, 0))} due`} />
        <Kpi label="Still unpaid" value={`${unpaid.length}`} sub={`${rs(unpaid.reduce((a, p) => a + p.monthDue!.amount, 0))}`} />
        <Kpi label="In grace or promised" value={`${grace.length}`} sub="Cover still on; collect before it lapses" />
      </section>

      <section className="panel p-4">
        <h2 className="mb-2 text-[14px] font-semibold text-foreground">Sellers in this branch</h2>
        <table className="w-full text-[13px]">
          <thead className="text-[12px] text-muted-foreground"><tr><th className="py-1 text-left font-medium">Seller</th><th className="py-1 text-right font-medium">Policies in the 13th-month block</th><th className="py-1 text-right font-medium">Persistency</th><th className="py-1 text-right font-medium">Unpaid this month</th></tr></thead>
          <tbody>
            {sellers.map((s) => (
              <tr key={s.key} className="border-t border-border">
                <td className="py-1.5 text-foreground">{s.key}</td>
                <td className="py-1.5 text-right">{s.policies}</td>
                <td className={`py-1.5 text-right ${s.rate < bookRate - 0.05 ? "text-failed" : ""}`}>{pct(s.rate)}</td>
                <td className="py-1.5 text-right">{unpaid.filter((p) => sellerOf(p) === s.key).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel p-4">
        <h2 className="text-[14px] font-semibold text-foreground">This month's due list</h2>
        <p className="mb-2 text-[12px] text-muted-foreground">The customer already got WhatsApp reminders and calls. Sending the link from the seller you know often closes it.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="text-[12px] text-muted-foreground"><tr>{["Customer", "Policy", "Seller", "Premium", "Due", "Status", ""].map((h) => <th key={h} className="py-1 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {due.slice(0, 30).map((p) => {
                const st = p.monthDue!.status;
                return (
                  <tr key={p.policyId} className="border-t border-border">
                    <td className="py-1.5 text-foreground">{p.customerName}</td>
                    <td className="py-1.5 font-mono text-[12px]">{p.policyId}</td>
                    <td className="py-1.5 text-[12px]">{sellerOf(p)}</td>
                    <td className="py-1.5">{rs(p.monthDue!.amount)}</td>
                    <td className="py-1.5">{date(p.monthDue!.date)}</td>
                    <td className="py-1.5"><StatusChip tone={st === "paid" ? "ok" : st === "promised" ? "accent" : st === "unpaid" ? "off" : "neutral"}>{st === "paid" ? "Paid" : st === "promised" ? "Promised" : st === "unpaid" ? "Unpaid" : "Coming up"}</StatusChip></td>
                    <td className="py-1.5 text-right">
                      {st !== "paid" && (sent[p.policyId] ? <span className="text-[12px] text-muted-foreground">{sent[p.policyId]}</span> : <Button size="sm" variant="outline" onClick={() => mark(p.policyId, `Payment link sent from ${sellerOf(p)}`)}>Send payment link</Button>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="mb-2 text-[14px] font-semibold text-foreground">Field visits</h2>
        {visits.length === 0 ? <p className="text-[13px] text-muted-foreground">No visits needed this week.</p> : (
          <ul className="space-y-2 text-[13px]">
            {visits.map((p) => (
              <li key={p.policyId} className="flex flex-wrap items-center gap-2 rounded-card border border-border p-2">
                <span className="text-foreground">{p.customerName} · {p.city}</span>
                <span className="text-muted-foreground">{p.policyId} · {rs(p.annualisedPremium)} annualised · {p.state} · grace ends {date(p.graceEnd)}</span>
                <span className="ml-auto">{sent[`v-${p.policyId}`] ? <span className="text-[12px] text-muted-foreground">{sent[`v-${p.policyId}`]}</span> : <>
                  <Button size="sm" variant="outline" onClick={() => mark(`v-${p.policyId}`, "Visited: cheque collected")}>Cheque collected</Button>{" "}
                  <Button size="sm" variant="outline" onClick={() => mark(`v-${p.policyId}`, "Visited: will pay online")}>Will pay online</Button>
                </>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-semibold text-foreground">{value}</p>
      <p className="text-[12px] text-muted-foreground">{sub}</p>
    </div>
  );
}
