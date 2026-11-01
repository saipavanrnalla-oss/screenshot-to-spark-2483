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

const KIND_LABEL: Record<NodeKind, string> = { Rule: "Rule", File: "File", LLM: "Agent", Human: "Person", Stub: "Vendor or file" };

export const NODE_KIND_HELP: Record<NodeKind, string> = {
  Rule: "Deterministic rule. Same input, same output.",
  File: "Reads or writes one of your files.",
  LLM: "Drafted by an agent from approved templates.",
  Human: "A person acts or approves.",
  Stub: "Sent through a vendor, bank or payment file.",
};

export function NodeChip({ kind, className }: { kind: NodeKind; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-pill border px-1.5 py-px text-[10px] font-bold uppercase tracking-wider", CHIP[kind], className)}>
      {kind === "LLM" && <Sparkles className="size-2.5" aria-hidden />}
      {KIND_LABEL[kind]}
    </span>
  );
}
