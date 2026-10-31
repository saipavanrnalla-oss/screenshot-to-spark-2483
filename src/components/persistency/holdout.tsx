import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, GRID, SERIES, TOOLTIP_STYLE } from "@/components/ds/chart-theme";
import { StatusPill } from "@/components/ds/primitives";
import { isHoldout, type Policy } from "@/data/persistency";
import { num, pct } from "@/lib/format";

/** Paid rate of this month's instalments for treatment vs a fixed 15% holdout, with a 95% range. */
export function holdoutStats(policies: Policy[]) {
  const g = { treatment: { due: 0, paid: 0 }, holdout: { due: 0, paid: 0 } };
  for (const p of policies) {
    const d = p.monthDue;
    if (!d || d.status === "upcoming") continue;
    const k = isHoldout(p) ? g.holdout : g.treatment;
    k.due++;
    if (d.status === "paid") k.paid++;
  }
  const ci = (x: { due: number; paid: number }) => {
    const r = x.due ? x.paid / x.due : 0;
    const se = x.due ? Math.sqrt((r * (1 - r)) / x.due) : 0;
    return { rate: r, low: Math.max(0, r - 1.96 * se), high: Math.min(1, r + 1.96 * se), ...x };
  };
  const t = ci(g.treatment), h = ci(g.holdout);
  const diff = t.rate - h.rate;
  const seDiff = Math.sqrt((t.due ? (t.rate * (1 - t.rate)) / t.due : 0) + (h.due ? (h.rate * (1 - h.rate)) / h.due : 0));
  return { t, h, diff, diffLow: diff - 1.96 * seDiff, diffHigh: diff + 1.96 * seDiff };
}

export function HoldoutCompare({ policies, height = 200 }: { policies: Policy[]; height?: number }) {
  const s = useMemo(() => holdoutStats(policies), [policies]);
  const data = [
    { group: "Treatment (85%)", rate: +(s.t.rate * 100).toFixed(2), err: [+(100 * (s.t.rate - s.t.low)).toFixed(2), +(100 * (s.t.high - s.t.rate)).toFixed(2)] },
    { group: "Holdout (15%)", rate: +(s.h.rate * 100).toFixed(2), err: [+(100 * (s.h.rate - s.h.low)).toFixed(2), +(100 * (s.h.high - s.h.rate)).toFixed(2)] },
  ];
  const lo = Math.max(0, Math.floor(Math.min(s.t.low, s.h.low) * 100) - 3);
  return (
    <div className="space-y-2">
      <StatusPill status="simulated">Synthetic data</StatusPill>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="group" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit="%" domain={[lo, 100]} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="rate" name="Paid this month (%)" fill={SERIES[0]} radius={[4, 4, 0, 0]}>
              <ErrorBar dataKey="err" width={8} stroke={SERIES[1]} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-subtle">
        Treatment {pct(s.t.rate)} of {num(s.t.due)} due; holdout {pct(s.h.rate)} of {num(s.h.due)} due. Difference {pct(s.diff)} (95% range {pct(s.diffLow)} to {pct(s.diffHigh)}).
        {s.diffLow <= 0 && s.diffHigh >= 0 ? " The range includes zero, so no difference can be claimed." : ""}
      </p>
    </div>
  );
}
