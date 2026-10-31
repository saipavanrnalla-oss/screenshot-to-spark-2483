import { Sparkles } from "lucide-react";
import type { NodeKind } from "@/data/persistency";
import { cn } from "@/lib/utils";

const CHIP: Record<NodeKind, string> = {
  Rule: "border-subtle text-subtle",
  File: "border-file text-file",
  LLM: "border-primary text-primary",
  Human: "border-attention text-attention",
  Stub: "border-dashed border-simulated text-simulated",
};

export const NODE_KIND_HELP: Record<NodeKind, string> = {
  Rule: "Deterministic rule. Same input, same output.",
  File: "Reads or writes one of your files.",
  LLM: "Drafted by a model from approved templates. Canned text in this build.",
  Human: "A person acts or approves.",
  Stub: "Simulated in this build (payments, bank, vendor sends).",
};

export function NodeChip({ kind, className }: { kind: NodeKind; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-pill border px-1.5 py-px text-[10px] font-bold uppercase tracking-wider", CHIP[kind], className)}>
      {kind === "LLM" && <Sparkles className="size-2.5" aria-hidden />}
      {kind === "LLM" ? "LLM · AI" : kind}
    </span>
  );
}
