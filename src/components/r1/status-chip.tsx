import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "ok" | "risk" | "off" | "neutral" | "accent";

const DOT: Record<Tone, string> = {
  ok: "bg-healthy",
  risk: "bg-attention",
  off: "bg-failed",
  neutral: "bg-simulated",
  accent: "bg-primary",
};

/** Status as a dot and a word. Colour never stands alone. */
export function StatusChip({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-border px-2 py-0.5 text-[12px] text-foreground", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function versionTone(status: string): Tone {
  if (status === "Active" || status === "Approved" || status === "Pass" || status === "Finished" || status === "Running") return "ok";
  if (status === "In review" || status === "Draft" || status === "Waiting" || status === "Scheduled") return "risk";
  if (status === "Paused" || status === "Returned" || status === "Fail" || status === "Overdue") return "off";
  return "neutral";
}
