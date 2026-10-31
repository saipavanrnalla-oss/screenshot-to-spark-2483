import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTable, EmptyState, SegmentedControl } from "@/components/ds/primitives";
import { usePersistencyStore, type AuditEntry } from "@/store/persistency";
import { dateTime } from "@/lib/format";

const KINDS = ["All", "Decisions", "Changes", "Events", "Kill switch"] as const;
type KindFilter = (typeof KINDS)[number];

function kindMatch(e: AuditEntry, k: KindFilter): boolean {
  if (k === "All") return true;
  if (k === "Decisions") return e.kind === "decision" || e.kind === "cancel";
  if (k === "Changes") return e.kind === "rule-change" || e.kind === "approval" || e.kind === "setting";
  if (k === "Events") return e.kind === "event" || e.kind === "outcome";
  return e.kind === "kill-switch";
}

export function AuditLogTable({ maxHeight = 420, limit }: { maxHeight?: number; limit?: number }) {
  const audit = usePersistencyStore((s) => s.audit);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("All");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = audit.filter((e) => kindMatch(e, kind) && (!needle || `${e.actor} ${e.policyId ?? ""} ${e.ruleId ?? ""} ${e.detail}`.toLowerCase().includes(needle)));
    return limit ? out.slice(0, limit) : out;
  }, [audit, q, kind, limit]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search policy, rule, person or text" aria-label="Search audit log" className="h-8 w-72 rounded-input border-border bg-surface-translucent pl-8 text-xs" />
        </div>
        <SegmentedControl size="sm" label="Entry type" value={kind} options={KINDS} onChange={setKind} />
        <span className="text-[11px] text-muted-foreground">{rows.length} entries</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No entries match. Clear the search or pick another type." />
      ) : (
        <DataTable head={["When (IST)", "Who", "Policy", "Rule", "What happened"]} minWidth={720} maxHeight={maxHeight}>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap text-muted-foreground tabular">{dateTime(e.at)}</td>
              <td className="whitespace-nowrap text-subtle">{e.actor}</td>
              <td className="whitespace-nowrap font-semibold text-foreground tabular">{e.policyId ?? ""}</td>
              <td className="whitespace-nowrap text-[11px] font-bold text-primary">{e.ruleId ?? ""}</td>
              <td className="text-foreground">{e.detail}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
