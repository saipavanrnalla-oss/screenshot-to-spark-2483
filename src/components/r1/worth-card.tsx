import { StatusChip } from "@/components/r1/status-chip";
import { HAND_OVER_BELOW, type WorthResult } from "@/engine/worth-score";

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-IN")}`;

/** The score, each factor that moved it, and the decision against the hand-over line. */
export function WorthCard({ w, compact = false }: { w: WorthResult; compact?: boolean }) {
  const pctV = Math.round(w.chance * 100);
  const line = Math.round(HAND_OVER_BELOW * 100);
  return (
    <div className="space-y-2 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[22px] font-semibold tabular-nums text-foreground">{pctV}%</span>
        <span className="text-[12px] text-muted-foreground">chance to collect</span>
        <StatusChip tone={w.handOver ? "risk" : "ok"}>{w.handOver ? "Hand over" : "Keep calling"}</StatusChip>
      </div>
      <div className="relative h-2 rounded-full bg-border" aria-label={`${pctV}% against a ${line}% hand-over line`}>
        <div className={`h-2 rounded-full ${w.handOver ? "bg-attention" : "bg-healthy"}`} style={{ width: `${pctV}%` }} />
        <div className="absolute -top-1 h-4 w-px bg-foreground" style={{ left: `${line}%` }} title={`Hand-over line ${line}%`} />
      </div>
      <p className="text-[11px] text-muted-foreground">Line at {line}%: below it, or after 3 refusals, in-house calls stop.</p>
      {!compact && (
        <table className="w-full text-[12px]">
          <tbody>
            {w.factors.map((f) => (
              <tr key={f.label} className="border-t border-border first:border-t-0">
                <td className="py-1 text-foreground">{f.label}</td>
                <td className={`py-1 text-right tabular-nums ${f.effect < 0 ? "text-failed" : "text-foreground"}`}>{f.effect > 0 && f.label.startsWith("Propensity") ? `${Math.round(f.effect * 100)}%` : f.label.startsWith("Not scored") ? `${Math.round(f.effect * 100)}%` : `${f.effect > 0 ? "+" : ""}${(f.effect * 100).toFixed(1)} pts`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-foreground"><span className="font-medium">{w.recommendation}.</span> {w.why}.</p>
      {!compact && (
        <p className="text-[12px] text-muted-foreground">Expected premium if the in-house team keeps going: {rs(w.expectedInHouse)}, at {rs(w.costInHouse)} a round. Through the vendor: {rs(w.expectedVendorNet)} after its fee, paid only on recovery.</p>
      )}
    </div>
  );
}
