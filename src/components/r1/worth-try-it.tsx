import { useState } from "react";
import { WorthCard } from "@/components/r1/worth-card";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { worthScore, type WorthInput } from "@/engine/worth-score";

const START: WorthInput = { band: "Low", calls: 2, unanswered: 0, refusals: 1, promise: false, brokenPromises: 0, daysPastDue: 6, unpaidLinks: 1, reason: "Financial", annualPremium: 36000 };

const PRESETS: { label: string; x: WorthInput }[] = [
  { label: "Low, one refusal in grace", x: START },
  { label: "Low, second refusal", x: { ...START, calls: 3, refusals: 2, daysPastDue: 9 } },
  { label: "High, not answering", x: { ...START, band: "High", refusals: 0, unanswered: 3, calls: 3, reason: undefined, unpaidLinks: 2 } },
  { label: "Medium, promised, then broke it", x: { ...START, band: "Medium", refusals: 0, promise: false, brokenPromises: 1, reason: undefined } },
];

/** Change the customer's history and watch the chance to collect and the decision move. */
export function WorthTryIt() {
  const [x, setX] = useState<WorthInput>(START);
  const set = <K extends keyof WorthInput>(k: K, v: WorthInput[K]) => setX({ ...x, [k]: v });
  const num = (k: "calls" | "unanswered" | "refusals" | "brokenPromises" | "daysPastDue" | "unpaidLinks" | "annualPremium", label: string, max: number) => (
    <label className="text-[12px] text-muted-foreground">{label}
      <input type="number" min={0} max={max} value={x[k]} onChange={(e) => set(k, Math.max(0, Math.min(max, Number(e.target.value) || 0)))} className={`${inputCls} mt-1`} aria-label={label} />
    </label>
  );
  return (
    <section className="panel space-y-3 p-4" aria-label="Try the model">
      <header>
        <h2 className="text-[14px] font-semibold text-foreground">Try it with any history</h2>
        <p className="text-[12px] text-muted-foreground">Your propensity band is the starting point. Every contact since then moves the chance to collect. Below 25%, or after three refusals, in-house calls stop and the case goes to the variable-payout vendor, who is paid only on recovery.</p>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => <button key={p.label} type="button" onClick={() => setX(p.x)} className="rounded-pill border border-border px-2 py-0.5 text-[12px] text-muted-foreground hover:border-primary hover:text-primary">{p.label}</button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[12px] text-muted-foreground">Propensity
            <select value={x.band ?? ""} onChange={(e) => set("band", (e.target.value || null) as WorthInput["band"])} className={`${selectCls} mt-1 block w-full`} aria-label="Propensity">
              <option value="">Not scored</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>
          <label className="text-[12px] text-muted-foreground">Reason given
            <select value={x.reason ?? ""} onChange={(e) => set("reason", e.target.value || undefined)} className={`${selectCls} mt-1 block w-full`} aria-label="Reason given">
              <option value="">None yet</option><option>Financial</option><option>Mis-selling</option><option>Service or product</option>
            </select>
          </label>
          {num("calls", "Calls made", 20)}
          {num("refusals", "Refusals", 5)}
          {num("unanswered", "Calls not answered", 10)}
          {num("unpaidLinks", "Links sent, not paid", 10)}
          {num("brokenPromises", "Broken promises", 5)}
          {num("daysPastDue", "Days past the due date", 365)}
          {num("annualPremium", "Annualised premium (Rs)", 10_000_000)}
          <label className="flex items-center gap-2 self-end text-[12px] text-muted-foreground">
            <input type="checkbox" checked={x.promise} onChange={(e) => set("promise", e.target.checked)} /> Promise to pay on record
          </label>
        </div>
        <div className="rounded-card border border-border bg-surface-translucent p-3"><WorthCard w={worthScore(x)} /></div>
      </div>
    </section>
  );
}
