/** Chart colours from the PRISM tokens: accent first, then the brief's order. */
export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;
export const GRID = "var(--border)";
export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;
export const TOOLTIP_STYLE = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" },
  labelStyle: { color: "var(--muted-foreground)" },
  itemStyle: { color: "var(--foreground)" },
  cursor: { fill: "var(--brand-tint)" },
} as const;

/** Tint cell backgrounds by share, using the accent token only. */
export function heat(share: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, share)) * 70);
  return `color-mix(in srgb, var(--primary) ${pct}%, transparent)`;
}
