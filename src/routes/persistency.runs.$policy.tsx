import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, FileText, MessageCircle, Phone, IndianRupee, UserRound, Workflow, Clock, Send, Flag, Wrench, Gauge } from "lucide-react";
import { CanvasBox } from "@/components/r1/canvas-box";
import { EmptyState, PageHeader } from "@/components/ds/primitives";
import { StatusChip } from "@/components/r1/status-chip";
import { gate } from "@/lib/gate";
import { bandLabel, dayLabel, type EventKind, type LiveEvent } from "@/engine/live-run";
import { liveGraph, useLive } from "@/store/live";
import { runStatus, stageTone } from "@/components/r1/live-ui";
import { WorthCard } from "@/components/r1/worth-card";

export const Route = createFileRoute("/persistency/runs/$policy")({
  beforeLoad: ({ search }) => gate("policies", search),
  head: () => ({ meta: [{ title: "Policy trail · Persistency · desible.ai" }] }),
  component: TrailPage,
});

const ICON: Record<EventKind, typeof FileText> = {
  file: FileText, stage: Flag, system: Workflow, whatsapp: MessageCircle, call: Phone, payment: IndianRupee,
  brief: Send, person: UserRound, vendor: Send, wait: Clock, decision: Workflow, outcome: Flag, score: Gauge,
};

const KIND_WORD: Record<EventKind, string> = {
  file: "File", stage: "Stage", system: "Step", whatsapp: "WhatsApp", call: "Call", payment: "Payment",
  brief: "Brief", person: "Person", vendor: "Vendor", wait: "Wait", decision: "Decision", outcome: "Result", score: "Score",
};

function TrailPage() {
  const { policy } = Route.useParams();
  const run = useLive((s) => s.runs[policy]);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | "Contacts" | "Decisions">("All");
  const graph = run ? liveGraph(run.graphId) : undefined;
  const path = useMemo(() => (run ? Array.from(new Set(run.events.map((e) => e.nodeId).filter((x): x is string => !!x))) : []), [run]);

  if (!run || !graph) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-4">
        <PageHeader title="Policy trail" meta={policy} />
        <EmptyState title="This policy is not in a run. Load a due list first." action={<Link to="/persistency/launch" className="text-[13px] font-medium text-primary hover:underline">Load the due list</Link>} />
      </div>
    );
  }
  const st = runStatus(run);
  const shown = run.events.filter((e) => filter === "All" || (filter === "Contacts" ? ["whatsapp", "call", "payment", "person", "brief"].includes(e.kind) : ["stage", "decision", "outcome", "score"].includes(e.kind)));
  const contacts = run.events.filter((e) => e.kind === "call" || e.kind === "whatsapp");
  const delivered = run.events.filter((e) => e.kind === "whatsapp").length;
  const calls = run.events.filter((e) => e.kind === "call");

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <Link to="/persistency/launch" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Due list run</Link>
      <PageHeader title={`${run.row.name} · ${run.row.policy}`} meta={`${run.row.plan} · ${run.row.product} · Rs ${run.row.premium.toLocaleString("en-IN")} ${run.row.mode.toLowerCase()} · due ${run.row.dueDate}`} />

      <section className="grid gap-3 md:grid-cols-4" aria-label="Summary">
        <Fact label="Status"><StatusChip tone={st.tone}>{st.word}</StatusChip></Fact>
        <Fact label="Stage when loaded"><StatusChip tone={stageTone(run.staged.stage)}>{run.staged.stage}</StatusChip><span className="ml-2 text-[12px] text-muted-foreground">{run.staged.timing}</span></Fact>
        <Fact label="Workflow">{run.graphId === "R1" ? "13th Month Persistency" : "25th Month Persistency"}</Fact>
        <Fact label="Contacts">{contacts.length} ({calls.length} {calls.length === 1 ? "call" : "calls"}, {delivered} WhatsApp)</Fact>
        <Fact label="Band and autopay">{bandLabel(run.row.band)} · {run.row.autopay}</Fact>
        <Fact label="Best disposition">{bestDisposition(run.events)}</Fact>
        <Fact label="Segment">{run.staged.segment.length ? run.staged.segment.join(", ") : "None"}</Fact>
        <Fact label="Channel and branch">{run.row.channel} · {run.row.branch}</Fact>
      </section>

      <section className="panel p-3" aria-label="Where the policy is">
        <p className="mb-2 px-1 text-[12px] text-muted-foreground">Steps this policy has been through are highlighted; the current step is centred.</p>
        <CanvasBox graph={graph} height={520} marks={Object.fromEntries(path.map((i) => [i, "path" as const]))} activeId={run.done ? null : run.nodeId} />
      </section>

      <section className="panel p-4" aria-label="Trail">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-foreground">Everything that happened, in order</h2>
          <div className="flex gap-1">
            {(["All", "Contacts", "Decisions"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-pill border px-2.5 py-1 text-[12px] ${filter === f ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{f}</button>
            ))}
          </div>
        </header>
        <ol className="relative space-y-3 border-l border-border pl-5">
          {shown.map((e) => <TrailItem key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />)}
        </ol>
      </section>

      {run.handoffs.length > 0 && (
        <details className="panel p-4 text-[13px]">
          <summary className="flex cursor-pointer items-center gap-2 font-medium text-foreground"><Wrench className="size-4" /> What the platform must do for this policy ({run.handoffs.length})</summary>
          <p className="mt-2 text-[12px] text-muted-foreground">In the prototype these results are simulated. Engineering connects each one to the voice and WhatsApp platform.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px]">
            {run.handoffs.map((h, i) => <li key={i}><span className="font-mono text-muted-foreground">{h.at}</span>{h.channel ? ` · ${h.channel}` : ""} · {h.action}</li>)}
          </ol>
        </details>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <div className="mt-1 text-[13px] text-foreground">{children}</div>
    </div>
  );
}

/** Across several calls the strongest answer stands: a promise holds unless the customer later refuses. */
export function bestDisposition(events: LiveEvent[]): string {
  const ds = events.filter((e) => e.disposition).map((e) => e.disposition!);
  if (events.some((e) => e.kind === "payment")) return "Paid";
  const rank = ["Paid on the call", "Explained, will pay", "Promise to pay", "Asked for a person", "No intention to pay", "Not reached"];
  const lastRefusal = ds.lastIndexOf("No intention to pay");
  const lastPromise = Math.max(ds.lastIndexOf("Promise to pay"), ds.lastIndexOf("Explained, will pay"));
  if (lastRefusal > lastPromise) return "No intention to pay";
  return rank.find((r) => ds.includes(r)) ?? "No contact yet";
}

function TrailItem({ e, open, onToggle }: { e: LiveEvent; open: boolean; onToggle: () => void }) {
  const Icon = ICON[e.kind];
  const more = !!(e.transcript?.length || e.detail || e.text || e.worth);
  return (
    <li className="relative">
      <span className="absolute -left-[29px] top-0.5 flex size-5 items-center justify-center rounded-full border border-border bg-card"><Icon className="size-3 text-muted-foreground" /></span>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[12px] text-muted-foreground">{dayLabel(e.day)}</span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{KIND_WORD[e.kind]}</span>
        <span className="text-[13px] font-medium text-foreground">{e.title}</span>
        {e.status && <StatusChip tone={e.status === "Paid" || e.status === "Read" || e.status === "Done" ? "ok" : e.status === "Waiting" ? "risk" : "neutral"}>{e.status}</StatusChip>}
      </div>
      <p className="text-[12px] text-muted-foreground">{e.by}{e.script ? ` · ${e.script.name}, version ${e.script.version}` : ""}{e.script?.rule ? ` · chosen for ${e.script.rule}` : ""}</p>
      {more && (
        <button type="button" onClick={onToggle} className="mt-0.5 text-[12px] font-medium text-primary hover:underline">{open ? "Hide" : e.transcript ? "Show transcript" : e.worth ? "Show the score" : e.text ? "Show the message" : "Show details"}</button>
      )}
      {open && (
        <div className="mt-2 space-y-1.5 rounded-card border border-border bg-surface-translucent p-3 text-[13px]">
          {e.worth ? <WorthCard w={e.worth} /> : e.detail && <p className="text-subtle">{e.detail}</p>}
          {e.transcript?.map((t, i) => (
            <p key={i}><span className={`font-medium ${t.who === "Agent" ? "text-primary" : "text-foreground"}`}>{t.who}:</span> {t.text}</p>
          ))}
        </div>
      )}
    </li>
  );
}
