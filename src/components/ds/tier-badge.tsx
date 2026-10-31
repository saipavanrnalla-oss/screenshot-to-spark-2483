import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tier } from "@/data/persistency/workflows";
import { cn } from "@/lib/utils";
import { Activity, Radio, FlaskConical } from "lucide-react";

export const TIER_INFO: Record<Tier, { label: string; description: string; icon: typeof Activity; className: string }> = {
  "live-engine": {
    label: "Live engine",
    description: "Decisions run for real on the seeded policies, using the rules you see.",
    icon: Activity,
    className: "border-brand-tint-border bg-brand-tint text-foreground",
  },
  "live-channels": {
    label: "Live channels",
    description: "Real WhatsApp and voice to registered test numbers only. Simulated in this build.",
    icon: Radio,
    className: "border-brand-tint-border text-subtle",
  },
  simulated: {
    label: "Simulated",
    description: "Payments, bank mandates, bureau responses and vendor files are simulated.",
    icon: FlaskConical,
    className: "dashed-simulated text-muted-foreground",
  },
};

export function TierBadge({ tiers, className }: { tiers: Tier[]; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("inline-flex flex-wrap items-center gap-1.5 rounded-pill", className)}
          aria-label={`Tier: ${tiers.map((t) => TIER_INFO[t].label).join(", ")}. Open legend`}
        >
          {tiers.map((t) => {
            const info = TIER_INFO[t];
            const Icon = info.icon;
            return (
              <span
                key={t}
                className={cn(
                  "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold",
                  info.className,
                )}
              >
                <Icon className="size-3" aria-hidden />
                {info.label}
              </span>
            );
          })}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-card border-border bg-card p-4">
        <p className="eyebrow mb-3">What the badges mean</p>
        <ul className="space-y-3">
          {(Object.keys(TIER_INFO) as Tier[]).map((t) => {
            const info = TIER_INFO[t];
            const Icon = info.icon;
            return (
              <li key={t} className="flex gap-3">
                <span className={cn("mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-pill border px-2 text-[11px] font-semibold", info.className)}>
                  <Icon className="size-3" aria-hidden />
                  {info.label}
                </span>
                <span className="text-xs text-subtle">{info.description}</span>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
