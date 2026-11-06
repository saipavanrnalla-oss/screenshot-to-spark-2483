import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ds/primitives";
import { StatusChip, type Tone } from "@/components/r1/status-chip";
import { inputCls } from "@/components/r1/tabs";
import { cutValue, slice, total, type Cut } from "@/components/r1/cohort-model";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useUser } from "@/hooks/use-user";
import { gate } from "@/lib/gate";
import { useInitiatives, type Initiative } from "@/store/initiatives";

export const Route = createFileRoute("/persistency/initiatives")({
  beforeLoad: ({ search }) => gate("initiatives", search),
  head: () => ({ meta: [{ title: "Action plans · Persistency · desible.ai" }] }),
  component: InitiativesPage,
});

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const TONE: Record<Initiative["status"], Tone> = { Raised: "risk", Accepted: "accent", "In progress": "accent", Done: "ok" };

function InitiativesPage() {
  const user = useUser();
  const { items, setStatus } = useInitiatives();
  const { scoped: all } = useScopedPolicies();
  const [note, setNote] = useState<Record<string, string>>({});
  const isOps = user?.id === "ops";

  const current = useMemo(() => Object.fromEntries(items.map((i) => {
    const pol = all.filter((p) => i.slice.every(([c, v]) => cutValue(p, c as Cut) === v));
    return [i.id, total(slice(pol, i.period, "Channel")).rate];
  })), [items, all]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <PageHeader title="Action plans" meta="Slices the Head of Persistency raised to operations, each with a target, a date and a plan" />
      {items.length === 0 ? (
        <EmptyState title="Nothing raised yet. Raise a slice from Cohorts." action={<Link to="/persistency/cohort" className="text-[13px] font-medium text-primary hover:underline">Open Cohorts</Link>} />
      ) : (
        items.map((i) => {
          const now = current[i.id] ?? i.baseline;
          const progress = i.target > i.baseline ? Math.max(0, Math.min(1, (now - i.baseline) / (i.target - i.baseline))) : 1;
          return (
            <article key={i.id} className="panel space-y-3 p-4">
              <header className="flex flex-wrap items-start gap-2">
                <div className="flex-1">
                  <p className="text-[12px] text-muted-foreground">{i.id} · raised by {i.raisedBy} · owner {i.owner}</p>
                  <h2 className="text-[15px] font-semibold text-foreground">{i.title}</h2>
                </div>
                <StatusChip tone={TONE[i.status]}>{i.status}</StatusChip>
              </header>
              <div className="grid gap-3 text-[13px] md:grid-cols-4">
                <Stat label="When raised" value={pct(i.baseline)} />
                <Stat label="Today" value={pct(now)} />
                <Stat label="Target" value={`${pct(i.target)} by ${i.byDate}`} />
                <Stat label="Book" value={pct(i.book)} />
              </div>
              <div>
                <div className="h-2 w-full rounded-full bg-border"><div className="h-2 rounded-full bg-primary" style={{ width: `${progress * 100}%` }} /></div>
                <p className="mt-1 text-[12px] text-muted-foreground">{(progress * 100).toFixed(0)}% of the way to target · {i.policies.toLocaleString("en-IN")} policies in the slice · re-measured from each day's due list</p>
              </div>
              <div>
                <p className="text-[12px] font-medium text-muted-foreground">Plan</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[13px]">{i.plan.map((p) => <li key={p}>{p}</li>)}</ol>
              </div>
              {i.notes.length > 0 && (
                <ul className="space-y-1 border-t border-border pt-2 text-[12px]">
                  {i.notes.map((n, k) => <li key={k}><span className="font-medium text-foreground">{n.by}:</span> {n.text}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <input value={note[i.id] ?? ""} onChange={(e) => setNote({ ...note, [i.id]: e.target.value })} placeholder={isOps ? "What operations will change, e.g. early call added for this slice in 13th Month Persistency" : "Note to operations"} className={`${inputCls} min-w-[280px] flex-1`} aria-label={`Note on ${i.id}`} />
                {isOps && i.status === "Raised" && <Button size="sm" onClick={() => { setStatus(i.id, "Accepted", user?.name ?? "Operations lead", note[i.id] || "Accepted"); setNote({ ...note, [i.id]: "" }); toast.success(`${i.id} accepted`); }}>Accept</Button>}
                {isOps && i.status === "Accepted" && <Button size="sm" onClick={() => { setStatus(i.id, "In progress", user?.name ?? "Operations lead", note[i.id] || "Workflow change made"); setNote({ ...note, [i.id]: "" }); }}>Mark in progress</Button>}
                {!isOps && i.status !== "Done" && <Button size="sm" variant="outline" onClick={() => { setStatus(i.id, i.status, user?.name ?? "Head of Persistency", note[i.id] || ""); setNote({ ...note, [i.id]: "" }); }} disabled={!note[i.id]}>Add note</Button>}
                {!isOps && i.status === "In progress" && <Button size="sm" variant="outline" onClick={() => setStatus(i.id, "Done", user?.name ?? "Head of Persistency", "Closed")}>Close</Button>}
                <Link to="/persistency/workflows" className="ml-auto text-[12px] font-medium text-primary hover:underline">Workflows</Link>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
