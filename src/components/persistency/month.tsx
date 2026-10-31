import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { AXIS_TICK, GRID, SERIES, TOOLTIP_STYLE } from "@/components/ds/chart-theme";
import { collection, dailyCollection, NOW_ISO } from "@/data/persistency";
import { useScopedPolicies } from "@/hooks/use-shell";

export const DAYS_IN_MONTH = 31;
export const TODAY = Number(NOW_ISO.slice(8, 10));

/** Month-end numbers shared by the war room, CXO and regional screens. */
export function useMonth() {
  const { all, scoped, product } = useScopedPolicies();
  return useMemo(() => {
    const col = collection(all, product);
    const daily = dailyCollection(scoped, col.scale, col.planCr);
    const collected = daily[TODAY - 1]?.cumulative ?? col.collectedCr;
    const gap = Math.max(0, col.planCr - col.collectedCr);
    const daysLeft = DAYS_IN_MONTH - TODAY;
    const runRate = col.collectedCr / TODAY;
    const required = daysLeft > 0 ? gap / daysLeft : gap;
    const projected = col.collectedCr + runRate * daysLeft;
    const chart = daily.map((d) => ({
      label: d.label,
      day: d.day,
      actual: d.day <= TODAY ? +d.cumulative.toFixed(2) : null,
      plan: +d.planCumulative.toFixed(2),
      projected: d.day >= TODAY ? +(collected + runRate * (d.day - TODAY)).toFixed(2) : null,
      required: d.day >= TODAY ? +(collected + required * (d.day - TODAY)).toFixed(2) : null,
      daily: d.day <= TODAY ? +d.collected.toFixed(2) : null,
    }));
    return { col, daily, chart, gap, daysLeft, runRate, required, projected, scoped, all, product };
  }, [all, scoped, product]);
}

export function RunRateChart({ height = 260 }: { height?: number }) {
  const m = useMonth();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={m.chart} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} interval={4} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" Cr" width={64} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => `₹${v.toFixed(1)} Cr`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine x={m.chart[TODAY - 1]?.label ?? ""} stroke={GRID} strokeDasharray="3 3" label={{ value: "Today", fill: "var(--muted-foreground)", fontSize: 10, position: "top" }} />
          <Line type="monotone" dataKey="actual" name="Collected" stroke={SERIES[0]} strokeWidth={2.25} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="plan" name="Plan (straight line)" stroke={SERIES[2]} strokeDasharray="4 4" dot={false} />
          <Line type="monotone" dataKey="projected" name="At current run-rate" stroke={SERIES[1]} dot={false} />
          <Line type="monotone" dataKey="required" name="Rate needed for plan" stroke={SERIES[3]} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
