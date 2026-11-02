import { cn } from "@/lib/utils";

/** Underline tabs for a page. Content is rendered by the caller. */
export function PageTabs<T extends string>({ value, tabs, onChange, label }: { value: T; tabs: readonly { id: T; label: string; count?: number | undefined }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-4 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px cursor-pointer border-b-2 px-0.5 pb-2 text-[13px] font-medium transition-colors",
            t.id === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-[12px] text-muted-foreground tabular">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[12px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

export const inputCls = "h-8 w-full rounded-input border border-border bg-surface-translucent px-2 text-[13px] text-foreground focus:border-primary focus:outline-none";
export const selectCls = "h-8 rounded-input border border-border bg-surface-translucent px-2 text-[13px] text-foreground focus:border-primary focus:outline-none";
