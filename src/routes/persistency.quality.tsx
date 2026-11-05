import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ds/primitives";
import { StatusChip } from "@/components/r1/status-chip";
import { selectCls } from "@/components/r1/tabs";
import { SCORECARD, SCORED_CALLS, scoreOf, type CallerKind } from "@/data/persistency/r1/call-quality";
import { gate } from "@/lib/gate";
import { useUser } from "@/hooks/use-user";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/persistency/quality")({
  beforeLoad: ({ search }) => gate("quality", search),
  head: () => ({ meta: [{ title: "Call quality · Persistency · desible.ai" }] }),
  component: QualityPage,
});

interface Review { pass: Record<number, boolean>; by: string; verdict: "Agreed" | "Changed" }
const useReviews = create<{ r: Record<string, Review>; save: (id: string, v: Review) => void }>()(
  persist((set, get) => ({ r: {}, save: (id, v) => set({ r: { ...get().r, [id]: v } }) }), { name: "pct-qa-reviews-v1", storage: createJSONStorage(() => localStorage) }),
);

function QualityPage() {
  const user = useUser();
  const { r: reviews, save } = useReviews();
  const [kind, setKind] = useState<"All" | CallerKind>("All");
  const [show, setShow] = useState<"All" | "Fatal" | "Low confidence" | "Not reviewed">("All");
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<number, boolean> | null>(null);

  const calls = useMemo(() => SCORED_CALLS.map((c) => {
    const pass = reviews[c.id]?.pass ?? c.ai;
    return { c, s: scoreOf(pass), ai: scoreOf(c.ai), reviewed: reviews[c.id] };
  }), [reviews]);
  const shown = calls.filter(({ c, s, reviewed }) => (kind === "All" || c.callerKind === kind) && (show === "All" || (show === "Fatal" ? s.fatal : show === "Low confidence" ? c.aiConfidence < 0.8 : !reviewed)));
  const byCaller = useMemo(() => {
    const m = new Map<string, { kind: CallerKind; n: number; sum: number; fatal: number }>();
    for (const { c, s } of calls) {
      const x = m.get(c.caller) ?? { kind: c.callerKind, n: 0, sum: 0, fatal: 0 };
      x.n++; x.sum += s.score; if (s.fatal) x.fatal++;
      m.set(c.caller, x);
    }
    return [...m.entries()].sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n);
  }, [calls]);
  const paramFail = useMemo(() => SCORECARD.filter((q) => q.no !== 24).map((q) => ({ q, rate: calls.filter(({ c }) => !(reviews[c.id]?.pass ?? c.ai)[q.no]).length / calls.length })).sort((a, b) => b.rate - a.rate).slice(0, 6), [calls, reviews]);
  const avg = calls.reduce((a, x) => a + x.s.score, 0) / calls.length;
  const fatalRate = calls.filter((x) => x.s.fatal).length / calls.length;
  const current = calls.find((x) => x.c.id === sel);
  const pass = draft ?? current?.reviewed?.pass ?? current?.c.ai;

  return (
    <div className="mx-auto max-w-[1360px] space-y-4">
      <PageHeader title="Call quality" meta={`Every renewal call scored on the 24-point scorecard, last 7 days · ${calls.length} calls, not a sample`} />
      <section className="grid gap-3 md:grid-cols-4">
        <Kpi label="Average score" value={avg.toFixed(1)} sub="Out of 100; a fatal miss scores 0" />
        <Kpi label="Calls with a fatal miss" value={`${(fatalRate * 100).toFixed(1)}%`} sub={`${calls.filter((x) => x.s.fatal).length} calls`} />
        <Kpi label="Reviewed by a person" value={`${Object.keys(reviews).length}`} sub={`${calls.filter((x) => x.c.aiConfidence < 0.8).length} flagged as low confidence`} />
        <Kpi label="Model agreed with reviewer" value={reviewAgreement(reviews)} sub="Share of reviewed calls left unchanged" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-2 text-[14px] font-semibold text-foreground">By caller</h2>
          <table className="w-full text-[13px]">
            <thead className="text-[12px] text-muted-foreground"><tr><th className="py-1 text-left font-medium">Caller</th><th className="py-1 text-left font-medium">Type</th><th className="py-1 text-right font-medium">Calls</th><th className="py-1 text-right font-medium">Average</th><th className="py-1 text-right font-medium">Fatal</th></tr></thead>
            <tbody>{byCaller.map(([name, x]) => <tr key={name} className="border-t border-border"><td className="py-1.5 text-foreground">{name}</td><td className="py-1.5">{x.kind}</td><td className="py-1.5 text-right">{x.n}</td><td className="py-1.5 text-right">{(x.sum / x.n).toFixed(1)}</td><td className="py-1.5 text-right">{x.fatal}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="panel p-4">
          <h2 className="mb-2 text-[14px] font-semibold text-foreground">Most missed</h2>
          <ul className="space-y-2 text-[13px]">
            {paramFail.map(({ q, rate }) => (
              <li key={q.no}>
                <div className="flex items-center gap-2"><span className="text-foreground">{q.no}. {q.name}</span>{q.fatal && <StatusChip tone="off">Fatal</StatusChip>}<span className="ml-auto tabular-nums">{(rate * 100).toFixed(1)}%</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-border"><div className="h-1.5 rounded-full bg-attention" style={{ width: `${Math.min(100, rate * 300)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel p-4">
        <header className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[14px] font-semibold text-foreground">Calls</h2>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={`${selectCls} ml-auto`} aria-label="Caller type">{["All", "AI agent", "In-house caller", "Vendor caller"].map((x) => <option key={x}>{x}</option>)}</select>
          <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className={selectCls} aria-label="Show">{["All", "Fatal", "Low confidence", "Not reviewed"].map((x) => <option key={x}>{x}</option>)}</select>
        </header>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="max-h-[640px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-card text-[12px] text-muted-foreground"><tr><th className="py-1 text-left font-medium">Call</th><th className="py-1 text-left font-medium">Caller</th><th className="py-1 text-left font-medium">Disposition</th><th className="py-1 text-right font-medium">Score</th></tr></thead>
              <tbody>
                {shown.map(({ c, s, reviewed }) => (
                  <tr key={c.id} onClick={() => { setSel(c.id); setDraft(null); }} className={`cursor-pointer border-t border-border hover:bg-surface-translucent ${sel === c.id ? "bg-primary/10" : ""}`}>
                    <td className="py-1.5"><p className="text-foreground">{c.policy.customerName}</p><p className="text-[11px] text-muted-foreground">{c.id} · {dateTime(c.at)}</p></td>
                    <td className="py-1.5 text-[12px]">{c.caller}</td>
                    <td className="py-1.5 text-[12px]">{c.disposition}</td>
                    <td className="py-1.5 text-right"><StatusChip tone={s.fatal ? "off" : s.score >= 85 ? "ok" : "risk"}>{s.fatal ? "Fatal" : s.score}</StatusChip>{reviewed && <span className="ml-1 text-[11px] text-muted-foreground">reviewed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {current && pass ? (
            <div className="space-y-3">
              <div className="rounded-card border border-border p-3 text-[13px]">
                <p className="text-[12px] text-muted-foreground">{current.c.caller} · {Math.round(current.c.durationSec / 60)} min · model {Math.round(current.c.aiConfidence * 100)}% sure</p>
                {current.c.transcript.map((t, i) => <p key={i}><span className={`font-medium ${t.who === "Agent" ? "text-primary" : "text-foreground"}`}>{t.who}:</span> {t.text}</p>)}
              </div>
              <div className="max-h-[360px] overflow-y-auto rounded-card border border-border">
                <table className="w-full text-[12px]">
                  <tbody>
                    {SCORECARD.map((q) => (
                      <tr key={q.no} className="border-t border-border first:border-t-0">
                        <td className="px-2 py-1 text-foreground">{q.no}. {q.name}{q.fatal && <span className="ml-1 text-failed">fatal</span>}</td>
                        <td className="px-2 py-1 text-muted-foreground">{q.weight || "Bonus"}</td>
                        <td className="px-2 py-1 text-right">
                          <button type="button" onClick={() => setDraft({ ...pass, [q.no]: !pass[q.no] })} className={`rounded-pill border px-2 py-0.5 ${pass[q.no] ? "border-healthy/50 text-healthy" : "border-failed/50 text-failed"}`} aria-label={`Toggle ${q.name}`}>{pass[q.no] ? "Met" : "Missed"}</button>
                          {current.c.ai[q.no] !== pass[q.no] && <span className="ml-1 text-attention">changed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-foreground">Score {scoreOf(pass).fatal ? "0 (fatal)" : scoreOf(pass).score}</span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => { save(current.c.id, { pass: current.c.ai, by: user?.name ?? "Quality auditor", verdict: "Agreed" }); setDraft(null); toast.success("Model score confirmed"); }}>Agree with the model</Button>
                <Button size="sm" disabled={!draft} onClick={() => { save(current.c.id, { pass: draft!, by: user?.name ?? "Quality auditor", verdict: "Changed" }); setDraft(null); toast.success("Your score is saved; the model learns from it"); }}>Save my score</Button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Pick a call to hear the transcript and see each of the 24 checks.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function reviewAgreement(r: Record<string, Review>): string {
  const v = Object.values(r);
  if (!v.length) return "None reviewed";
  return `${Math.round((v.filter((x) => x.verdict === "Agreed").length / v.length) * 100)}%`;
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
