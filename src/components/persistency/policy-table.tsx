import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusPill } from "@/components/ds/primitives";
import type { Policy } from "@/data/persistency";
import { cohortLabel } from "@/engine/persistency";
import { useDecisions, usePersistencyStore } from "@/store/persistency";
import { date, inr, num } from "@/lib/format";
import { StateBadge } from "./state-badge";

const PAGE = 25;

export function PolicyTable({
  policies,
  onOpen,
  emptyTitle = "No policies match this filter. Pick another sub-step or clear the filter.",
  emptyAction,
}: {
  policies: Policy[];
  onOpen: (policyId: string) => void;
  emptyTitle?: string;
  emptyAction?: React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const pages = Math.max(1, Math.ceil(policies.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = useMemo(() => policies.slice(current * PAGE, current * PAGE + PAGE), [policies, current]);
  const decisions = useDecisions(rows);

  if (policies.length === 0) return <EmptyState title={emptyTitle} action={emptyAction} />;

  return (
    <div className="overflow-hidden rounded-card border border-border">
      <div className="scrollbar-prism max-h-[560px] overflow-auto">
        <table className="w-full min-w-[960px] border-collapse text-[12px]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-left">
              {["Policy", "Product", "Premium", "Mode", "State", "Cohort", "Last touch", "Next action", "Executor"].map((h) => (
                <th key={h} scope="col" className="border-b border-border px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const d = decisions.get(p.policyId)!;
              return (
                <tr
                  key={p.policyId}
                  tabIndex={0}
                  onClick={() => onOpen(p.policyId)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(p.policyId))}
                  className={
                    "cursor-pointer border-b border-border/60 transition-colors hover:bg-brand-tint focus:bg-brand-tint focus:outline-none " +
                    (i % 2 === 1 ? "bg-surface-translucent" : "")
                  }
                >
                  <td className="px-3 py-2 font-semibold text-foreground tabular">{p.policyId}</td>
                  <td className="px-3 py-2 text-subtle">{p.product}</td>
                  <td className="px-3 py-2 text-subtle tabular">{inr(p.annualisedPremium)}</td>
                  <td className="px-3 py-2 text-subtle">{p.paymentMode}</td>
                  <td className="px-3 py-2"><StateBadge state={p.state} /></td>
                  <td className="px-3 py-2 text-subtle">{cohortLabel(p, activeCohortSet[p.product])}</td>
                  <td className="px-3 py-2 text-subtle tabular">{p.lastTouch ? date(p.lastTouch) : "None"}</td>
                  <td className="px-3 py-2 text-foreground">
                    <span className="mr-1 text-[10px] font-bold text-primary">{d.ruleId}</span>
                    {d.action}
                    {d.cancelledReason && <StatusPill status="attention" className="ml-1.5">{d.cancelledReason}</StatusPill>}
                    {d.frozen && <StatusPill status="failed" className="ml-1.5">Frozen</StatusPill>}
                  </td>
                  <td className="px-3 py-2 text-subtle">{d.executor}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
        <span className="tabular">
          {current * PAGE + 1} to {Math.min(policies.length, current * PAGE + PAGE)} of {num(policies.length)} policies
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="tabular">Page {current + 1} of {pages}</span>
          <Button variant="ghost" size="icon" className="size-7" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
