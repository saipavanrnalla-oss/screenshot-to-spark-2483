import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ds/primitives";
import { StatusChip } from "@/components/r1/status-chip";
import { WF_NAME } from "@/components/r1/live-ui";
import { gate } from "@/lib/gate";
import { bandLabel, dayLabel } from "@/engine/live-run";
import { useLive } from "@/store/live";
import { useUser } from "@/hooks/use-user";

export const Route = createFileRoute("/persistency/queue")({
  beforeLoad: ({ search }) => gate("queue", search),
  head: () => ({ meta: [{ title: "Manual follow-ups · Persistency · desible.ai" }] }),
  component: QueuePage,
});

type Outcome = "Will pay" | "Paid" | "Refused" | "Documents in" | "Close the case";

function QueuePage() {
  const user = useUser();
  const { runs, resolve } = useLive();
  const [sel, setSel] = useState<string | null>(null);
  const open = useMemo(() => Object.values(runs).filter((r) => r.waitingCase), [runs]);
  const closed = useMemo(
    () => Object.values(runs).flatMap((r) => r.events.filter((e) => e.kind === "person" && e.status === "Done").map((e) => ({ run: r, e }))),
    [runs],
  );
  const current = open.find((r) => r.id === sel) ?? open[0];
  const lastCall = current?.events.filter((e) => e.kind === "call").slice(-1)[0];
  const outcomes: Outcome[] = current?.waitingCase?.team === "Revival underwriting" ? ["Documents in", "Close the case"] : ["Will pay", "Paid", "Refused", "Close the case"];

  const act = (o: Outcome) => {
    if (!current) return;
    resolve(current.id, user?.name ?? "Persistency caller", o);
    toast.success(`${current.row.policy}: ${o}. The policy is back in its workflow.`);
    setSel(null);
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <PageHeader title="Manual follow-ups" meta={`${open.length} open ${open.length === 1 ? "case" : "cases"} · cases an agent should not decide`} />
      {open.length === 0 ? (
        <EmptyState title="No open cases. Cases appear here when a workflow hands a policy to a person." action={<Link to="/persistency/launch" className="text-[13px] font-medium text-primary hover:underline">Import due list</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <ul className="space-y-2" aria-label="Open cases">
            {open.map((r) => {
              const c = r.waitingCase!;
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setSel(r.id)} className={`panel w-full p-3 text-left ${current?.id === r.id ? "border-primary" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">{r.row.name}</span>
                      <span className="ml-auto"><StatusChip tone={c.slaHours <= 8 ? "off" : "risk"}>{c.slaHours} h SLA</StatusChip></span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">{c.team} · {r.row.policy}</p>
                    <p className="mt-1 text-[12px] text-subtle">{c.why}</p>
                  </button>
                </li>
              );
            })}
          </ul>
          {current?.waitingCase && (
            <section className="panel space-y-4 p-4" aria-label="Case">
              <header className="flex flex-wrap items-start gap-2">
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-foreground">{current.row.name} · {current.row.policy}</p>
                  <p className="text-[12px] text-muted-foreground">{current.row.plan} · Rs {current.row.premium.toLocaleString("en-IN")} {current.row.mode.toLowerCase()} · due {current.row.dueDate} · {bandLabel(current.row.band)} · {current.row.language}</p>
                </div>
                <StatusChip tone="neutral">{WF_NAME[current.graphId]}</StatusChip>
              </header>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-card border border-border p-3">
                  <p className="text-[12px] text-muted-foreground">Why it is here</p>
                  <p className="text-[13px] text-foreground">{current.waitingCase.why}</p>
                  <p className="mt-2 text-[12px] text-muted-foreground">Opened {dayLabel(current.waitingCase.openedDay)} · {current.waitingCase.team}</p>
                </div>
                <div className="rounded-card border border-attention/40 bg-attention/10 p-3">
                  <p className="text-[12px] text-muted-foreground">Recommended action</p>
                  <p className="text-[13px] text-foreground">{current.waitingCase.recommended}</p>
                </div>
              </div>
              {lastCall?.transcript && (
                <div className="rounded-card border border-border p-3 text-[13px]">
                  <p className="mb-1 text-[12px] text-muted-foreground">Last call · {lastCall.title}</p>
                  {lastCall.transcript.map((t, i) => <p key={i}><span className={`font-medium ${t.who === "Agent" ? "text-primary" : "text-foreground"}`}>{t.who}:</span> {t.text}</p>)}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="text-[12px] text-muted-foreground">Record the outcome</span>
                {outcomes.map((o) => <Button key={o} size="sm" variant={o === "Close the case" ? "outline" : "default"} onClick={() => act(o)}>{o}</Button>)}
                <Link to="/persistency/runs/$policy" params={{ policy: current.id }} className="ml-auto text-[12px] font-medium text-primary hover:underline">Full trail</Link>
              </div>
            </section>
          )}
        </div>
      )}
      {closed.length > 0 && (
        <section className="panel p-4" aria-label="Closed today">
          <h2 className="mb-2 text-[14px] font-semibold text-foreground">Closed</h2>
          <ul className="space-y-1 text-[13px]">
            {closed.map(({ run, e }) => <li key={e.id}>{run.row.name} · {run.row.policy} · {e.title} · <span className="text-muted-foreground">{e.detail}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
