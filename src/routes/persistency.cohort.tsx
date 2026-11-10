import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ds/primitives";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { BOOK_STEPS, CUTS, DRILL_ORDER, TARGETS, blockLabel, bookFunnel, cutValue, inBlock, slice, total, waterfall, type Cut, type SliceRow } from "@/components/r1/cohort-model";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { addMonths, NOW, toIso, type Policy } from "@/data/persistency";
import { useInitiatives } from "@/store/initiatives";

export const Route = createFileRoute("/persistency/cohort")({
  beforeLoad: ({ search }) => gate("cohort", search),
  head: () => ({ meta: [{ title: "Cohorts · Persistency · desible.ai" }] }),
  component: CohortPage,
});

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const cr = (n: number) => (n >= 1e7 ? `Rs ${(n / 1e7).toFixed(1)} Cr` : `Rs ${(n / 1e5).toFixed(1)} L`);
const pts = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)} pts`;

interface RaiseDraft {
  title: string;
  slice: [string, string][];
  row: SliceRow;
  plan: string[];
}

function CohortPage() {
  const { scoped: all } = useScopedPolicies();
  const user = useUser();
  const raise = useInitiatives((s) => s.raise);
  const [period, setPeriod] = useState<13 | 25>(13);
  const [path, setPath] = useState<[Cut, string][]>([]);
  const [cut, setCut] = useState<Cut>("Channel");
  const [draft, setDraft] = useState<RaiseDraft | null>(null);

  const scoped = useMemo(() => all.filter((p) => path.every(([c, v]) => cutValue(p, c) === v)), [all, path]);
  const book = useMemo(() => total(slice(all, period, "Channel")), [all, period]);
  const here = useMemo(() => total(slice(scoped, period, "Channel")), [scoped, period]);
  const rows = useMemo(() => slice(scoped, period, cut).sort((a, b) => b.atRisk - a.atRisk), [scoped, period, cut]);
  const wf = useMemo(() => waterfall(scoped, period), [scoped, period]);
  const due = useMemo(() => scoped.filter((p) => p.monthDue && inBlock(p, period)), [scoped, period]);
  const target = TARGETS[period];
  const needed = Math.max(0, target * here.premium - here.premiumPersisted);

  const nextCut = (c: Cut): Cut | undefined => {
    const i = DRILL_ORDER.indexOf(c as (typeof DRILL_ORDER)[number]);
    const used = new Set(path.map(([x]) => x));
    return i >= 0 ? DRILL_ORDER.slice(i + 1).find((x) => !used.has(x)) : DRILL_ORDER.find((x) => !used.has(x) && x !== c);
  };

  const drill = (r: SliceRow) => {
    const np: [Cut, string][] = [...path, [cut, r.key]];
    setPath(np);
    const n = nextCut(cut);
    if (n) setCut(n);
  };

  const recs = useMemo(() => recommendations(all, period, book.rate), [all, period, book.rate]);

  const openRaise = (r: SliceRow, extra?: [Cut, string]) => {
    const s = [...path, ...(extra ? [extra] : [])] as [string, string][];
    setDraft({
      title: `${s.map(([, v]) => v).join(" · ") || "Whole book"}: lift ${period}th-month persistency`,
      slice: s,
      row: r,
      plan: defaultPlan(r, book.rate),
    });
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <PageHeader title="Cohorts" meta={`Rolling 12-month block, premium-weighted on annualised premium · ${period}th month: policies ${blockLabel(period)}`} />

      <div className="flex flex-wrap items-center gap-2">
        {([13, 25] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPeriod(p)} className={`rounded-pill border px-3 py-1 text-[13px] ${period === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{p}th month</button>
        ))}
      </div>

      <section className="grid gap-3 md:grid-cols-5" aria-label="Headline">
        <Kpi label={`${period}M persistency${path.length ? ", this slice" : ""}`} value={pct(here.rate)} sub={`Target ${pct(target)} · book ${pct(book.rate)}`} tone={here.rate >= target ? "ok" : "off"} />
        <Kpi label="By policy count" value={pct(here.countRate)} sub="Smaller policies lapse more when count is lower" />
        <Kpi label="Policies in the block" value={here.policies.toLocaleString("en-IN")} sub={cr(here.premium) + " annualised"} />
        <Kpi label="Premium not renewed" value={cr(here.atRisk)} sub={`${(here.policies - here.persisted).toLocaleString("en-IN")} policies`} />
        <Kpi label="To reach target" value={needed ? cr(needed) : "On target"} sub={needed ? "Further premium to renew in this block" : "Above target"} />
      </section>

      {!path.length && recs.length > 0 && (
        <section className="panel p-4" aria-label="Where to act">
          <h2 className="mb-3 text-[14px] font-semibold text-foreground">Where to act</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {recs.map((r) => (
              <div key={r.title} className="flex flex-col gap-2 rounded-card border border-border p-3">
                <p className="text-[13px] font-medium text-foreground">{r.title}</p>
                <p className="text-[12px] text-subtle">{r.why}</p>
                <div className="mt-auto flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setDraft({ title: r.title, slice: r.slice, row: r.row, plan: r.plan })}><Flag /> Raise to ops</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel p-4" aria-label="Drill down">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap items-center gap-1 text-[13px]" aria-label="Slice">
            <button type="button" onClick={() => { setPath([]); setCut("Channel"); }} className={path.length ? "text-primary hover:underline" : "font-medium text-foreground"}>Whole book</button>
            {path.map(([c, v], i) => (
              <span key={c} className="flex items-center gap-1">
                <ChevronRight className="size-3 text-muted-foreground" />
                <button type="button" onClick={() => { setPath(path.slice(0, i + 1)); setCut(nextCut(c) ?? cut); }} className={i < path.length - 1 ? "text-primary hover:underline" : "font-medium text-foreground"}>{v}</button>
              </span>
            ))}
          </nav>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
            Cut by
            <select value={cut} onChange={(e) => setCut(e.target.value as Cut)} className={selectCls}>
              {CUTS.filter((c) => !path.some(([x]) => x === c)).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {path.length > 0 && <Button size="sm" variant="outline" onClick={() => openRaise(here)}><Flag /> Raise this slice</Button>}
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="text-[12px] text-muted-foreground">
              <tr>{[cut, "Policies", "Annualised premium", `${period}M persistency`, "Against the book", "Premium not renewed", ""].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((r) => {
                const gap = r.rate - book.rate;
                const can = !!nextCut(cut) && r.policies > 3;
                return (
                  <tr key={r.key} className="border-t border-border">
                    <td className="py-2 pr-3 text-foreground">{r.key}</td>
                    <td className="py-2 pr-3">{r.policies.toLocaleString("en-IN")}</td>
                    <td className="py-2 pr-3">{cr(r.premium)}</td>
                    <td className="py-2 pr-3"><Bar v={r.rate} target={target} /></td>
                    <td className={`py-2 pr-3 ${gap < -0.02 ? "text-failed" : gap > 0.02 ? "text-healthy" : "text-muted-foreground"}`}>{pts(gap)}</td>
                    <td className="py-2 pr-3">{cr(r.atRisk)}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {can && <Button size="sm" variant="ghost" onClick={() => drill(r)}>{nextCut(cut)} <ChevronRight /></Button>}
                        {gap < -0.02 && <Button size="sm" variant="outline" onClick={() => openRaise(r, [cut, r.key])}><Flag /> Raise</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 25 && <p className="mt-2 text-[12px] text-muted-foreground">Showing the 25 with the most premium not renewed, of {rows.length}.</p>}
          {cut === "Seller" && <SellerSpread rows={rows} />}
        </div>
      </section>

      <section className="panel p-4" aria-label="Collection waterfall">
        <h2 className="text-[14px] font-semibold text-foreground">{period}th-month premium collected, M1 to M12</h2>
        <p className="mb-3 text-[12px] text-muted-foreground">Each row is the month the premium fell due. M1 is the due month; each column is the share of that month's premium collected by then.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-center text-[12px]">
            <thead className="text-muted-foreground"><tr><th className="py-1 pr-2 text-left font-medium">Due month</th><th className="py-1 pr-2 text-right font-medium">Premium due</th>{Array.from({ length: 12 }, (_, i) => <th key={i} className="py-1 font-medium">M{i + 1}</th>)}</tr></thead>
            <tbody>
              {wf.map((w) => (
                <tr key={w.month} className="border-t border-border">
                  <td className="py-1 pr-2 text-left text-foreground">{w.month}</td>
                  <td className="py-1 pr-2 text-right">{w.dueCount ? cr(w.due) : "None"}</td>
                  {w.cumulative.map((c, i) => <td key={i} className="py-1"><Cell v={c} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-4" aria-label="This month's due book">
        <h2 className="text-[14px] font-semibold text-foreground">This month's {period}th-month due book</h2>
        <p className="mb-3 text-[12px] text-muted-foreground">{due.length.toLocaleString("en-IN")} policies due this month in this slice, in bulk: what was sent, what reached the customer, what came back.</p>
        <DueBook policies={due} cut={cut} />
      </section>

      <RaiseDialog draft={draft} period={period} book={book.rate} onClose={() => setDraft(null)} onRaise={(d, target, by, plan) => {
        const it = raise({ title: d.title, period, slice: d.slice, baseline: d.row.rate, book: book.rate, target, byDate: by, policies: d.row.policies, atRisk: d.row.atRisk, plan, raisedBy: user?.name ?? "Head of Persistency", owner: "Operations lead, Persistency" });
        toast.success(`${it.id} raised to the Operations lead`);
        setDraft(null);
      }} />
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "off" }) {
  return (
    <div className="panel p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-[22px] font-semibold ${tone === "off" ? "text-failed" : tone === "ok" ? "text-healthy" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Bar({ v, target }: { v: number; target: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-28 rounded-full bg-border">
        <div className={`absolute inset-y-0 left-0 rounded-full ${v >= target ? "bg-healthy" : v >= target - 0.08 ? "bg-attention" : "bg-failed"}`} style={{ width: `${Math.min(100, v * 100)}%` }} />
        <div className="absolute inset-y-[-3px] w-px bg-foreground" style={{ left: `${target * 100}%` }} aria-hidden />
      </div>
      <span className="tabular-nums">{pct(v)}</span>
    </div>
  );
}

function Cell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground"> </span>;
  const shade = v >= 0.85 ? "bg-healthy/30" : v >= 0.75 ? "bg-healthy/15" : v >= 0.6 ? "bg-attention/20" : "bg-failed/15";
  return <span className={`block rounded px-1 py-0.5 tabular-nums text-foreground ${shade}`}>{(v * 100).toFixed(0)}%</span>;
}

function SellerSpread({ rows }: { rows: SliceRow[] }) {
  const sized = rows.filter((r) => r.policies >= 3);
  if (!sized.length) return null;
  const below = sized.filter((r) => r.rate < 0.5).length;
  const best = Math.max(...sized.map((r) => r.rate));
  const worst = Math.min(...sized.map((r) => r.rate));
  return (
    <p className="mt-3 rounded-card border border-attention/40 bg-attention/10 px-3 py-2 text-[13px]">
      {sized.length} sellers with 3 or more policies range from {pct(worst)} to {pct(best)}. {below} {below === 1 ? "is" : "are"} below 50%; lifting them by 5 points moves this slice more than any other single change.
    </p>
  );
}

function DueBook({ policies, cut }: { policies: Policy[]; cut: Cut }) {
  const groups = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const p of policies) {
      const f = bookFunnel(p);
      const k = cutValue(p, cut);
      const a = m.get(k) ?? BOOK_STEPS.map(() => 0);
      BOOK_STEPS.forEach((s, i) => { if (f[s]) a[i]! += 1; });
      m.set(k, a);
    }
    const all = BOOK_STEPS.map((_, i) => [...m.values()].reduce((x, a) => x + a[i]!, 0));
    return { rows: [...m.entries()].sort((a, b) => b[1][0]! - a[1][0]!).slice(0, 12), all };
  }, [policies, cut]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-[13px]">
        <thead className="text-[12px] text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">{cut}</th>{BOOK_STEPS.map((s) => <th key={s} className="py-2 pr-3 font-medium">{s}</th>)}</tr></thead>
        <tbody>
          {[["All", groups.all] as [string, number[]], ...groups.rows].map(([k, a]) => (
            <tr key={k} className={`border-t border-border ${k === "All" ? "font-medium" : ""}`}>
              <td className="py-2 pr-3 text-foreground">{k}</td>
              {a.map((n, i) => <td key={i} className="py-2 pr-3 tabular-nums">{n.toLocaleString("en-IN")}{i > 0 && a[0] ? <span className="ml-1 text-[11px] text-muted-foreground">{((n / a[0]) * 100).toFixed(0)}%</span> : null}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-muted-foreground">Open any policy from <Link to="/persistency/policies" className="text-primary hover:underline">Policies</Link> for its full trail.</p>
    </div>
  );
}

function defaultPlan(r: SliceRow, book: number): string[] {
  return [
    `Early service call at T-90 for every Low propensity policy in this slice (${r.policies.toLocaleString("en-IN")} policies today)`,
    "Autopay nudge on WhatsApp at T-60 for policies not on autopay",
    "Send each seller their own due list and payment links in the Grace Period",
    `Weekly review against the book (${pct(book)}) until the target date`,
  ];
}

interface Rec { title: string; why: string; slice: [string, string][]; row: SliceRow; plan: string[] }

function recommendations(all: Policy[], period: 13 | 25, book: number): Rec[] {
  const out: Rec[] = [];
  // 1. The two-level slice with the most premium not renewed and a rate well below the book.
  let best: { a: string; b: string; row: SliceRow } | null = null;
  for (const ch of slice(all, period, "Channel")) {
    const sub = slice(all.filter((p) => p.channel === ch.key), period, "Product");
    for (const r of sub) if (r.rate < book - 0.03 && (!best || r.atRisk > best.row.atRisk)) best = { a: ch.key, b: r.key, row: r };
  }
  if (best) out.push({ title: `${best.a} ${best.b}: ${pct(best.row.rate)} against ${pct(book)}`, why: `${cr(best.row.atRisk)} of annualised premium not renewed across ${best.row.policies.toLocaleString("en-IN")} policies. Largest gap in the book.`, slice: [["Channel", best.a], ["Product", best.b]], row: best.row, plan: defaultPlan(best.row, book) });
  // 2. Autopay gap.
  const ap = slice(all, period, "Autopay");
  const on = ap.find((r) => r.key === "On autopay");
  const off = ap.find((r) => r.key === "Not on autopay");
  if (on && off) {
    const moved = off.policies * 0.05;
    const lift = (moved * (on.countRate - off.countRate)) / (on.policies + off.policies);
    out.push({ title: `Autopay: ${pct(on.rate)} on autopay, ${pct(off.rate)} without`, why: `Moving 5% of the ${off.policies.toLocaleString("en-IN")} policies without autopay onto it would add about ${(lift * 100).toFixed(1)} points to the book.`, slice: [["Autopay", "Not on autopay"]], row: off, plan: ["Autopay nudge at T-60 and T-15 with an e-NACH link", "Ask for autopay on every early service call", "Report mandates registered each week"] });
  }
  // 3. Region below the book.
  const reg = slice(all, period, "Region").sort((a, b) => a.rate - b.rate)[0];
  if (reg && reg.rate < book) out.push({ title: `${reg.key} zone: ${pct(reg.rate)}`, why: `Lowest zone, ${cr(reg.atRisk)} not renewed. Drill to branch and seller to find the few that pull it down.`, slice: [["Region", reg.key]], row: reg, plan: ["Branch-level due lists to each branch manager on day 1", "Field visit for the bottom 10 sellers' unpaid policies", "Daily collection huddle after the 25th"] });
  return out;
}

function RaiseDialog({ draft, period, book, onClose, onRaise }: { draft: RaiseDraft | null; period: number; book: number; onClose: () => void; onRaise: (d: RaiseDraft, target: number, by: string, plan: string[]) => void }) {
  const [lift, setLift] = useState(3);
  const [by, setBy] = useState(toIso(addMonths(NOW, 4)));
  const [plan, setPlan] = useState("");
  const d = draft;
  return (
    <Dialog open={!!d} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader><DialogTitle>Raise to the Operations lead</DialogTitle></DialogHeader>
        {d && (
          <div className="space-y-3 text-[13px]">
            <p className="font-medium text-foreground">{d.title}</p>
            <p className="text-muted-foreground">{period}th month today: {pct(d.row.rate)} on {d.row.policies.toLocaleString("en-IN")} policies (book {pct(book)}), {cr(d.row.atRisk)} not renewed.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] text-muted-foreground">Lift by (points)
                <input type="number" min={1} max={20} value={lift} onChange={(e) => setLift(Number(e.target.value))} className={`${inputCls} mt-1`} />
              </label>
              <label className="block text-[12px] text-muted-foreground">By
                <input type="date" value={by} onChange={(e) => setBy(e.target.value)} className={`${inputCls} mt-1`} />
              </label>
            </div>
            <p className="text-[12px] text-muted-foreground">Target {pct(Math.min(1, d.row.rate + lift / 100))}</p>
            <label className="block text-[12px] text-muted-foreground">Plan, one step per line
              <textarea rows={5} value={plan || d.plan.join("\n")} onChange={(e) => setPlan(e.target.value)} className={`${inputCls} mt-1 h-auto py-2`} />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => { onRaise(d, Math.min(1, d.row.rate + lift / 100), by, (plan || d.plan.join("\n")).split("\n").map((s) => s.trim()).filter(Boolean)); setPlan(""); }}><Flag /> Raise</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

