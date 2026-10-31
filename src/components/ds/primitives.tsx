import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Radio, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tier } from "@/data/persistency/workflows";
import { TierBadge } from "./tier-badge";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  tiers,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  tiers: Tier[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-subtle">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <TierBadge tiers={tiers} />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel accent-left px-4 py-3.5", className)}>
      <div className="stat-number">{value}</div>
      <div className="stat-label mt-1">{label}</div>
      {sub && <div className="mt-1.5 text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  tiers,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  eyebrow?: string;
  tiers?: Tier[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      {(title || eyebrow || tiers || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            {title && <h2 className="mt-0.5 text-[15px] font-bold text-foreground">{title}</h2>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {tiers && <TierBadge tiers={tiers} />}
          </div>
        </header>
      )}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Status = "healthy" | "attention" | "failed" | "simulated" | "live";

const STATUS: Record<Status, { icon: typeof CheckCircle2; className: string }> = {
  healthy: { icon: CheckCircle2, className: "text-healthy border-healthy/40" },
  attention: { icon: AlertTriangle, className: "text-attention border-attention/40" },
  failed: { icon: XCircle, className: "text-failed border-failed/40" },
  simulated: { icon: CircleDashed, className: "text-simulated border-simulated border-dashed" },
  live: { icon: Radio, className: "text-live border-brand-tint-border bg-brand-tint" },
};

/** Always icon + label + colour, never colour alone. */
export function StatusPill({ status, children, className }: { status: Status; children: ReactNode; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-pill border px-2 py-0.5 text-[11px] font-semibold", s.className, className)}>
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}

/** Marker for anything produced by a model. Rules and arithmetic never carry it. */
export function AiMarker({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-primary", className)}>
      <Sparkles className="size-3" aria-hidden />
      AI
    </span>
  );
}

export function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
        active ? "border-brand-tint-border bg-brand-tint text-foreground" : "border-border text-subtle",
        onClick && "cursor-pointer hover:border-brand-tint-border hover:text-foreground",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-pill border border-border bg-surface-translucent p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cn(
            "cursor-pointer rounded-pill font-semibold transition-colors",
            size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
            o === value ? "bg-primary text-primary-foreground" : "text-subtle hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm text-subtle">{title}</p>
      {action}
    </div>
  );
}
