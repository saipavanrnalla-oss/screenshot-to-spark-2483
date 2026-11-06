import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ds/primitives";
import { PageTabs, selectCls } from "@/components/r1/tabs";
import { blockLabel, persisted } from "@/components/r1/cohort-model";
import {
  OUTCOMES, TICKETS, agg, bandOf, blockOf, crore, flags, outcomeOf, pct, reportingBlocks, reviewRows, ticketOf,
  type ProductView, type ReviewRowKey,
} from "@/components/r1/review-model";
import { BASE_POLICIES, type Policy, type PersistencyPeriod } from "@/data/persistency";
import { yearChange } from "@/components/r1/review-model";
import { gate } from "@/lib/gate";

export const Route = createFileRoute("/persistency/review")({
  beforeLoad: ({ search }) => gate("review", search),
  head: () => ({ meta: [{ title: "Monthly review · Persistency · desible.ai" }] }),
  component: ReviewPage,
});

type SectionId = "channel" | "band" | "ticket" | "calling" | "autopay" | "complaints" | "replacement" | "digital" | "blocks";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "channel", label: "By channel" },
  { id: "band", label: "Propensity bands" },
  { id: "ticket", label: "Ticket size" },
  { id: "calling", label: "Calling outcomes" },
  { id: "autopay", label: "Autopay cancellations" },
  { id: "complaints", label: "Complaints" },
  { id: "replacement", label: "Replacement sales" },
  { id: "digital", label: "WhatsApp and app" },
  { id: "blocks", label: "Reporting blocks" },
];

/** A cell: plain text, or a persistency rate coloured against the grand total. */
type Cell = string | { rate: number; vs: number } | null;

interface Table {
  groups?: { label: string; span: number }[] | undefined;
  columns: string[];
  rows: { label: string; level: 0 | 1; total?: boolean | undefined; cells: Cell[] }[];
  highlights: string[];
}

const share = (a: number, b: number) => (b ? a / b : 0);
const n = (x: number) => Math.round(x).toLocaleString("en-IN");
const rateCell = (rate: number, vs: number): Cell => ({ rate, vs });

function ReviewPage() {
  const [section, setSection] = useState<SectionId>("channel");
  const [period, setPeriod] = useState<PersistencyPeriod>(13);
  const [view, setView] = useState<ProductView>("All");
  const rows = useMemo(() => reviewRows(BASE_POLICIES), []);
  const block = useMemo(() => blockOf(BASE_POLICIES, period, view), [period, view]);
  const table = useMemo(() => build(section, rows, block, period, view), [section, rows, block, period, view]);
  const productMatters = section !== "digital" && section !== "blocks" && section !== "complaints" && section !== "replacement" && section !== "autopay";

  return (
    <div className="mx-auto max-w-[1360px] space-y-4">
      <PageHeader title="Monthly review" meta={`The persistency pack for the leadership review · ${period}th month block, ${blockLabel(period)} · figures in Rs crore of annualised premium`} />
      <PageTabs value={section} tabs={SECTIONS} onChange={setSection} label="Review section" />
      <div className="flex flex-wrap items-center gap-2">
        {section !== "blocks" && (
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value) as PersistencyPeriod)} className={selectCls} aria-label="Persistency month">
            <option value={13}>13th month</option>
            <option value={25}>25th month</option>
          </select>
        )}
        {productMatters && (
          <select value={view} onChange={(e) => setView(e.target.value as ProductView)} className={selectCls} aria-label="Product">
            <option value="All">All products</option>
            <option value="ULIP">ULIP</option>
            <option value="Traditional">Traditional</option>
          </select>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => downloadCsv(`${section}-${period}m-${view}.csv`, table)}><Download /> Download CSV</Button>
      </div>

      {table.highlights.length > 0 && (
        <section className="panel p-4" aria-label="Key highlights">
          <h2 className="mb-1 text-[13px] font-semibold text-foreground">Key highlights</h2>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-foreground">{table.highlights.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
      )}

      <section className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead className="text-[12px] text-muted-foreground">
            {table.groups && (
              <tr className="border-b border-border">
                <th />
                {table.groups.map((g, i) => <th key={i} colSpan={g.span} className="px-3 pt-2 text-center font-medium text-foreground">{g.label}</th>)}
              </tr>
            )}
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">{section === "blocks" ? "Report month" : "Channel"}</th>
              {table.columns.map((c) => <th key={c} className="px-3 py-2 text-right font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className={`border-t border-border ${r.total ? "bg-surface-translucent font-semibold" : ""}`}>
                <td className={`px-3 py-1.5 text-foreground ${r.level === 1 ? "pl-8 text-[12px] text-subtle" : ""}`}>{r.label}</td>
                {r.cells.map((c, j) => <td key={j} className="px-3 py-1.5 text-right tabular-nums">{render(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-[12px] text-muted-foreground">Persistency is premium-weighted on annualised premium. Colours compare each figure with the grand total of the same column: green 3 points or more above, red 3 points or more below.</p>
    </div>
  );
}

function render(c: Cell) {
  if (c == null) return <span className="text-muted-foreground">·</span>;
  if (typeof c === "string") return c;
  const d = c.rate - c.vs;
  const cls = d >= 0.03 ? "bg-healthy/15 text-healthy" : d <= -0.03 ? "bg-failed/15 text-failed" : "bg-attention/15 text-attention";
  return <span className={`inline-block min-w-[56px] rounded px-1.5 py-0.5 text-center font-medium ${cls}`}>{pct(c.rate)}</span>;
}

function text(c: Cell): string {
  return c == null ? "" : typeof c === "string" ? c : pct(c.rate);
}

function downloadCsv(name: string, t: Table) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [["Channel", ...t.columns].map(esc).join(","), ...t.rows.map((r) => [r.label, ...r.cells.map(text)].map(esc).join(","))];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function build(section: SectionId, rows: ReviewRowKey[], block: Policy[], period: PersistencyPeriod, view: ProductView): Table {
  const per = (r: ReviewRowKey) => block.filter(r.match);
  const all = agg(block, period);
  const named = rows.filter((r) => !r.total || r.key === "Bancassurance total");
  const worst = (fn: (ps: Policy[]) => number, min = 20) =>
    named.map((r) => ({ r, ps: per(r) })).filter((x) => x.ps.length >= min).map((x) => ({ key: x.r.key, v: fn(x.ps) })).sort((a, b) => a.v - b.v);

  switch (section) {
    case "channel": {
      const chAll = yearChange({}, period, view);
      const lyAll = { rate: all.rate - chAll };
      const prod = (ps: Policy[], p: "ULIP" | "Traditional") => agg(ps.filter((x) => x.product === p), period);
      const cols = ["Block", ...(view === "All" ? ["ULIP share"] : []), "ULIP", "Traditional", "Overall", "A year ago", "Change", "Unpaid", "Unpaid policies"];
      const out = rows.map((r) => {
        const ps = per(r);
        const a = agg(ps, period);
        const ch = yearChange(r.filter, period, view);
        const u = prod(ps, "ULIP");
        const t = prod(ps, "Traditional");
        const vsU = prod(block, "ULIP").rate;
        const vsT = prod(block, "Traditional").rate;
        return {
          label: r.key, level: r.level, total: r.total,
          cells: [crore(a.premium), ...(view === "All" ? [pct(share(u.premium, a.premium), 0)] : []), u.premium ? rateCell(u.rate, vsU) : null, t.premium ? rateCell(t.rate, vsT) : null, rateCell(a.rate, all.rate), pct(a.rate - ch), `${ch >= 0 ? "+" : ""}${(ch * 100).toFixed(1)} pts`, crore(a.unpaid), n(a.unpaidCount)] as Cell[],
        };
      });
      const w = worst((ps) => agg(ps, period).rate);
      return {
        columns: cols, rows: out,
        highlights: [
          `${period}th month persistency is ${pct(all.rate)}, ${all.rate >= lyAll.rate ? "up" : "down"} ${Math.abs((all.rate - lyAll.rate) * 100).toFixed(1)} points on the same month last year (${pct(lyAll.rate)}).`,
          `Rs ${crore(all.unpaid)} crore across ${n(all.unpaidCount)} policies is still unpaid in this block.`,
          ...(w[0] ? [`Lowest: ${w[0].key} at ${pct(w[0].v)}.`] : []),
        ],
      };
    }
    case "band": {
      const lowOf = (ps: Policy[]) => ps.filter((p) => { const b = bandOf(p); return b != null && b <= 5; });
      const highOf = (ps: Policy[]) => ps.filter((p) => { const b = bandOf(p); return b != null && b > 5; });
      const allLow = agg(lowOf(block), period);
      const allHigh = agg(highOf(block), period);
      const out = rows.map((r) => {
        const ps = per(r);
        const a = agg(ps, period);
        const lo = agg(lowOf(ps), period);
        const hi = agg(highOf(ps), period);
        return { label: r.key, level: r.level, total: r.total, cells: [crore(a.premium), pct(share(lo.premium, a.premium), 0), lo.premium ? rateCell(lo.rate, allLow.rate) : null, hi.premium ? rateCell(hi.rate, allHigh.rate) : null, rateCell(a.rate, all.rate)] as Cell[] };
      });
      const lowRows = worst((ps) => agg(lowOf(ps), period).rate).filter((x) => x.v > 0 && x.v < allLow.rate - 0.03).map((x) => x.key);
      return {
        groups: [{ label: "", span: 1 }, { label: "Contribution", span: 1 }, { label: "Persistency", span: 3 }],
        columns: ["Block", "P1 to P5 share", "P1 to P5", "P6 to P10", "Total"], rows: out,
        highlights: [
          `P6 to P10 persist at ${pct(allHigh.rate, 0)} and make up ${pct(share(allHigh.premium, all.premium), 0)} of the block; P1 to P5 persist at ${pct(allLow.rate, 0)}.`,
          ...(lowRows.length ? [`P1 to P5 persistency is lowest in ${lowRows.slice(0, 3).join(", ")}.`] : []),
        ],
      };
    }
    case "ticket": {
      const tot = Object.fromEntries(TICKETS.map((t) => [t, agg(block.filter((p) => ticketOf(p) === t), period)]));
      const out = rows.map((r) => {
        const ps = per(r);
        const a = agg(ps, period);
        const by = TICKETS.map((t) => agg(ps.filter((p) => ticketOf(p) === t), period));
        return { label: r.key, level: r.level, total: r.total, cells: [...by.map((x, i) => (x.premium ? rateCell(x.rate, tot[TICKETS[i]!]!.rate) : null)), rateCell(a.rate, all.rate), ...by.map((x) => pct(share(x.premium, a.premium)))] as Cell[] };
      });
      const sorted = TICKETS.map((t) => ({ t, ...tot[t]! })).filter((x) => x.premium);
      const lo = [...sorted].sort((a, b) => a.rate - b.rate)[0];
      const top = sorted[sorted.length - 1];
      return {
        groups: [{ label: "Persistency", span: TICKETS.length + 1 }, { label: "Share of block", span: TICKETS.length }],
        columns: [...TICKETS, "Total", ...TICKETS.map((t) => `${t} `)], rows: out,
        highlights: [
          ...(lo ? [`Lowest persistency is in the ${lo.t} AFYP band at ${pct(lo.rate)}, ${pct(share(lo.premium, all.premium), 0)} of the block.`] : []),
          ...(top ? [`${top.t} AFYP persists at ${pct(top.rate)} with ${pct(share(top.premium, all.premium), 0)} of the block.`] : []),
        ],
      };
    }
    case "calling": {
      const out = rows.map((r) => {
        const ps = per(r);
        const a = agg(ps, period);
        const unpaid = ps.filter((p) => !persisted(p, period));
        const by = OUTCOMES.map((o) => unpaid.filter((p) => outcomeOf(p) === o).reduce((s, p) => s + p.annualisedPremium, 0));
        return { label: r.key, level: r.level, total: r.total, cells: [crore(a.premium), rateCell(a.rate, all.rate), crore(a.unpaid), ...by.map(crore), ...by.map((x) => pct(share(x, a.premium), 0))] as Cell[] };
      });
      const unpaid = block.filter((p) => !persisted(p, period));
      const s = (o: (typeof OUTCOMES)[number]) => share(unpaid.filter((p) => outcomeOf(p) === o).reduce((x, p) => x + p.annualisedPremium, 0), all.premium);
      return {
        groups: [{ label: "", span: 3 }, { label: "Unpaid, by what the customer said (Rs Cr)", span: 4 }, { label: "Share of block", span: 4 }],
        columns: ["Block", "Persistency", "Unpaid", ...OUTCOMES, ...OUTCOMES.map((o) => `${o} `)], rows: out,
        highlights: [
          `${pct(s("Not interested to pay"), 0)} of the block refused to pay the renewal premium; ${pct(s("Promise to pay"), 0)} promised to pay.`,
          `${pct(s("Not contactable"), 0)} could not be reached. These go to the vendor or a field visit.`,
        ],
      };
    }
    case "autopay": {
      const out = rows.map((r) => {
        const ps = per(r);
        const a = agg(ps, period);
        const unpaid = ps.filter((p) => !persisted(p, period));
        const cancU = unpaid.filter((p) => flags(p, period).mandateCancelled);
        const cancAll = ps.filter((p) => flags(p, period).mandateCancelled);
        const prem = (x: Policy[]) => x.reduce((s, p) => s + p.annualisedPremium, 0);
        return { label: r.key, level: r.level, total: r.total, cells: [n(a.policies), crore(a.premium), rateCell(a.rate, all.rate), n(unpaid.length), crore(a.unpaid), n(cancU.length), crore(prem(cancU)), pct(share(cancU.length, unpaid.length), 0), pct(share(prem(cancU), a.unpaid), 0), pct(share(cancAll.length, a.policies)), pct(share(prem(cancAll), a.premium))] as Cell[] };
      });
      const w = worst((ps) => -share(ps.filter((p) => !persisted(p, period) && flags(p, period).mandateCancelled).length, ps.filter((p) => !persisted(p, period)).length));
      return {
        groups: [{ label: "", span: 3 }, { label: "Unpaid", span: 2 }, { label: "Mandate cancelled", span: 2 }, { label: "% of unpaid", span: 2 }, { label: "% of all", span: 2 }],
        columns: ["Policies", "Block", "Persistency", "Policies ", "Rs Cr", "Policies  ", "Rs Cr ", "Policies %", "Premium %", "Policies % ", "Premium % "], rows: out,
        highlights: [
          ...(w[0] ? [`Most mandates cancelled before the 13th-month debit: ${w.slice(0, 3).map((x) => x.key).join(", ")}.`] : []),
          "A cancelled mandate also hits the 25th and 37th month. Channel-head approval before a cancellation, and no cancellation on monthly mode, stop most of it.",
        ],
      };
    }
    case "complaints": {
      const out = rows.map((r) => {
        const ps = per(r);
        const a = agg(ps, period);
        const c = ps.filter((p) => flags(p, period).rejectedComplaint);
        const ca = agg(c, period);
        return { label: r.key, level: r.level, total: r.total, cells: [crore(a.premium), crore(ca.premium), pct(share(ca.premium, a.premium)), ca.premium ? rateCell(ca.rate, agg(block.filter((p) => flags(p, period).rejectedComplaint), period).rate) : null] as Cell[] };
      });
      const c = agg(block.filter((p) => flags(p, period).rejectedComplaint), period);
      return {
        columns: ["Block", "Rejected complaint block", "Rejected complaint %", "Persistency of rejected complaints"], rows: out,
        highlights: [`${pct(share(c.premium, all.premium))} of the block raised a complaint that was rejected; those policies persist at ${pct(c.rate, 0)}, against ${pct(all.rate, 0)} overall.`],
      };
    }
    case "replacement": {
      const prem = (x: Policy[]) => x.reduce((s, p) => s + p.annualisedPremium, 0);
      const out = rows.map((r) => {
        const ps = per(r);
        const a = agg(ps, period);
        const rep = ps.filter((p) => flags(p, period).replaced);
        return { label: r.key, level: r.level, total: r.total, cells: [n(a.policies), crore(a.premium), rateCell(a.rate, all.rate), n(a.unpaidCount), crore(a.unpaid), n(rep.length), crore(prem(rep)), pct(share(rep.length, a.unpaidCount)), pct(share(prem(rep), a.unpaid)), pct(share(rep.length, a.policies)), pct(share(prem(rep), a.premium))] as Cell[] };
      });
      const w = worst((ps) => -share(ps.filter((p) => flags(p, period).replaced).length, ps.filter((p) => !persisted(p, period)).length));
      return {
        groups: [{ label: "", span: 3 }, { label: "Unpaid", span: 2 }, { label: "Replaced by a new policy", span: 2 }, { label: "% of unpaid", span: 2 }, { label: "% of all", span: 2 }],
        columns: ["Policies", "Block", "Persistency", "Policies ", "Rs Cr", "Policies  ", "Rs Cr ", "Policies %", "Premium %", "Policies % ", "Premium % "], rows: out,
        highlights: [...(w[0] ? [`Most replacement sales: ${w.slice(0, 3).map((x) => x.key).join(", ")}. An anti-churning check at sourcing flags a new policy sold to a customer with an unpaid one.`] : [])],
      };
    }
    case "digital": {
      const out = rows.map((r) => {
        const ps = per(r);
        const a = agg(ps, period);
        const wa = agg(ps.filter((p) => flags(p, period).whatsapp), period);
        const nwa = agg(ps.filter((p) => !flags(p, period).whatsapp), period);
        const ap = agg(ps.filter((p) => flags(p, period).app), period);
        const nap = agg(ps.filter((p) => !flags(p, period).app), period);
        return { label: r.key, level: r.level, total: r.total, cells: [crore(a.premium), pct(share(wa.premium, a.premium), 0), nwa.premium ? pct(nwa.rate) : null, wa.premium ? pct(wa.rate) : null, pct(share(ap.premium, a.premium), 0), nap.premium ? pct(nap.rate) : null, ap.premium ? pct(ap.rate) : null, rateCell(a.rate, all.rate)] as Cell[] };
      });
      const wa = agg(block.filter((p) => flags(p, period).whatsapp), period);
      const nwa = agg(block.filter((p) => !flags(p, period).whatsapp), period);
      const ap = agg(block.filter((p) => flags(p, period).app), period);
      const nap = agg(block.filter((p) => !flags(p, period).app), period);
      return {
        groups: [{ label: "", span: 1 }, { label: "WhatsApp", span: 3 }, { label: "Customer app", span: 3 }, { label: "", span: 1 }],
        columns: ["Block", "Opted in", "Not opted", "Opted", "Using the app", "Not using", "Using", "Overall"], rows: out,
        highlights: [
          `Customers on WhatsApp persist at ${pct(wa.rate)} against ${pct(nwa.rate)} for the rest, a ${((wa.rate - nwa.rate) * 100).toFixed(1)} point gap. Only ${pct(share(wa.premium, all.premium), 0)} of the block has opted in.`,
          `App users persist at ${pct(ap.rate)} against ${pct(nap.rate)}.`,
        ],
      };
    }
    case "blocks": {
      const rb = reportingBlocks(3);
      return {
        columns: ["Persistency", "Block from", "Block up to"],
        rows: rb.map((b) => ({ label: b.report, level: 0 as const, cells: [`${b.period}th month`, b.from, b.to] })),
        highlights: ["Each report month measures a rolling 12-month block of policies issued. The 13th month covers policies issued 13 to 24 months before the report month; each later measure moves back a year."],
      };
    }
  }
}
