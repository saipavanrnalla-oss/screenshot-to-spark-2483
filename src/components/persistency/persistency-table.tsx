import { useMemo } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataTable } from "@/components/ds/primitives";
import { persistency, type Policy } from "@/data/persistency";
import { money, num, pct } from "@/lib/format";

export function ModeRuleFootnote() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
        <Info className="size-3" aria-hidden /> Mode rule applied
      </PopoverTrigger>
      <PopoverContent className="w-80 border-border bg-card p-4 text-xs text-subtle">
        <p className="eyebrow mb-2">Mode rule</p>
        <p>A policy counts in a period only if that period's premium fell due in the last 12 months. It counts as persisting if the right premium was paid for its payment mode:</p>
        <ul className="mt-2 list-disc space-y-0.5 pl-4">
          <li>Monthly: the 13th premium (for 13M)</li>
          <li>Quarterly: the 5th premium</li>
          <li>Half-yearly: the 3rd premium</li>
          <li>Annual: the 2nd premium</li>
        </ul>
        <p className="mt-2">Later periods scale the same way. Each policy is weighted by its annualised premium.</p>
      </PopoverContent>
    </Popover>
  );
}

export function PersistencyTable({ policies, compact }: { policies: Policy[]; compact?: boolean }) {
  const rows = useMemo(() => persistency(policies), [policies]);
  return (
    <div>
      <DataTable head={compact ? ["Period", "Premium-weighted", "Policies counted"] : ["Period", "Premium-weighted", "Count-based", "Policies counted", "Premium counted"]} minWidth={compact ? 320 : 560}>
        {rows.map((r) => (
          <tr key={r.period}>
            <td className="font-semibold text-foreground">{r.period}M</td>
            <td className="font-bold text-primary tabular">{r.eligible ? pct(r.premiumWeighted) : "No policies due"}</td>
            {!compact && <td className="text-subtle tabular">{r.eligible ? pct(r.countBased) : "None"}</td>}
            <td className="text-subtle tabular">{num(r.eligible)}</td>
            {!compact && <td className="text-subtle tabular">{money(r.premiumEligible)}</td>}
          </tr>
        ))}
      </DataTable>
      <div className="mt-2 flex items-center justify-between">
        <ModeRuleFootnote />
        <span className="text-[11px] text-dim">Book of {num(policies.length)} policies</span>
      </div>
    </div>
  );
}
