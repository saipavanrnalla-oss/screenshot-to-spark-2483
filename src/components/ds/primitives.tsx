import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Radio, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tier } from "@/data/persistency/workflows";
import { useChrome } from "@/hooks/use-chrome";
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
  meta,
}: {
  eyebrow?: string;
  title: ReactNode;
  /** Old intro lines; shown only with CHROME.showTaglines. */
  description?: ReactNode;
  tiers?: Tier[];
  actions?: ReactNode;
  /** One plain line under the title (counts, last updated). */
  meta?: ReactNode;
}) {
  const showTaglines = useChrome("showTaglines");
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {showTaglines && eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="text-[20px] font-semibold leading-tight text-foreground">{title}</h1>
        {meta && <p className="mt-1 text-[12px] text-muted-foreground">{meta}</p>}
        {showTaglines && description && <p className="mt-1.5 text-[13px] text-subtle">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {tiers && <TierBadge tiers={tiers} />}
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
    <div className={cn("panel px-4 py-3", className)}>
      <div className="stat-label">{label}</div>
      <div className="stat-number mt-1">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-muted-foreground">{sub}</div>}
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
      {(title || eyebrow || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-foreground">{title ?? eyebrow}</h2>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {tiers && <TierBadge tiers={tiers} />}
          </div>
        </header>
      )}
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
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

/** Pill tabs (role=tablist). Content is rendered by the caller. */
export function PillTabs<T extends string>({
  value,
  tabs,
  onChange,
  label,
}: {
  value: T;
  tabs: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className={cn(
            "cursor-pointer rounded-pill border px-3.5 py-1.5 text-xs font-semibold transition-colors",
            t.id === value ? "border-brand-tint-border bg-brand-tint text-foreground" : "border-border text-subtle hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** 13px data table with sticky header and row hover. */
export function DataTable({
  head,
  children,
  minWidth = 640,
  maxHeight,
  className,
}: {
  head: ReactNode[];
  children: ReactNode;
  minWidth?: number;
  maxHeight?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-card border border-border", className)}>
      <div className="scrollbar-prism overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse text-[13px] [&_tbody_tr]:border-b [&_tbody_tr]:border-border/60 [&_tbody_tr:hover]:bg-surface-translucent [&_td]:px-3 [&_td]:py-2" style={{ minWidth }}>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-left">
              {head.map((h, i) => (
                <th key={i} scope="col" className="whitespace-nowrap border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Inline note above or below a section. */
export function NoteBanner({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "attention" | "failed"; className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-card border px-4 py-2.5 text-[13px]",
        tone === "attention" ? "border-attention/40 bg-attention/10 text-foreground" : tone === "failed" ? "border-failed/50 bg-failed/10 text-foreground" : "border-border bg-card text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
