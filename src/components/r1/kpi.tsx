import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI tile: label, value, and one line of change against the previous period or plan. */
export function Kpi({
  label,
  value,
  change,
  good,
  onClick,
  className,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  change?: ReactNode;
  /** true: the change is good (green up arrow); false: bad (red down arrow). */
  good?: boolean | undefined;
  onClick?: () => void;
  className?: string;
  icon?: ReactNode;
  /** Colour of the top edge. */
  accent?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{ borderTop: `3px solid ${accent ?? "var(--primary)"}` }}
      className={cn("panel relative flex flex-col items-start px-4 py-3 text-left", onClick && "cursor-pointer hover:border-primary", className)}
    >
      <span className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{label}</span>
      {icon && <span className="absolute right-4 top-3 text-muted-foreground">{icon}</span>}
      <span className="mt-1 text-[24px] font-semibold leading-tight text-foreground tabular">{value}</span>
      {change !== undefined && (
        <span className={cn("mt-1 inline-flex items-center gap-1 text-[12px]", good === undefined ? "text-muted-foreground" : good ? "text-healthy" : "text-failed")}>
          {good !== undefined && (good ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />)}
          {change}
        </span>
      )}
    </Comp>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{children}</div>;
}

export function LastUpdated() {
  return <span className="text-[12px] text-muted-foreground">Last updated 10:30</span>;
}
