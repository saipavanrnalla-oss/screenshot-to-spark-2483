import { Link } from "@tanstack/react-router";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/ds/primitives";
import type { Tier } from "@/data/persistency/workflows";

/** Honest placeholder for pages that arrive in a later build step. */
export function BuildStepPlaceholder({
  eyebrow,
  title,
  step,
  tiers,
  willShow,
}: {
  eyebrow: string;
  title: string;
  step: number;
  tiers: Tier[];
  willShow: string[];
}) {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} tiers={tiers} />
      <div className="panel-translucent flex flex-col gap-5 border-dashed p-8 md:flex-row">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-brand-tint-border bg-brand-tint text-primary">
          <Hammer className="size-5" aria-hidden />
        </div>
        <div className="space-y-3">
          <p className="text-[15px] font-bold text-foreground">Arrives in build step {step}</p>
          <p className="text-sm text-subtle">This page uses the same seeded policies and live engine as the Control Tower. It will show:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-subtle">
            {willShow.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <Link to="/persistency" className="inline-block text-xs font-semibold text-primary hover:underline">
            Back to the Control Tower
          </Link>
        </div>
      </div>
    </div>
  );
}
