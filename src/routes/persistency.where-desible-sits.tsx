import { createFileRoute } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { ArrowRight } from "lucide-react";
import { Eyebrow, NoteBanner, PageHeader, Panel } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { VendorCoexistenceTable } from "@/components/persistency/vendor-modes";
import { useScopedPolicies } from "@/hooks/use-shell";

export const Route = createFileRoute("/persistency/where-desible-sits")({
  beforeLoad: ({ search }) => gate("positioning", search),
  head: () => ({
    meta: [
      { title: "Where Desible sits · Persistency · desible.ai" },
      { name: "description", content: "How the control tower sits on top of your existing systems and vendors, file-first." },
      { property: "og:title", content: "Where Desible sits · Persistency · desible.ai" },
      { property: "og:description", content: "How the control tower sits on top of your existing systems and vendors, file-first." },
    ],
  }),
  component: WhereWeSitPage,
});

const SYSTEMS: [string, string][] = [
  ["Policy admin", "due_list daily 06:00"],
  ["Billing and receipts", "receipts daily 07:00"],
  ["Mandate / NACH", "mandate_status daily 05:30 · bounce_returns daily 07:00"],
  ["CRM", "complaints and DND daily 06:30"],
  ["Dialer and telecalling vendors", "vendor_dispositions daily 08:00"],
  ["WhatsApp vendor", "delivery read-back daily 08:00"],
  ["Voice bot vendor", "call outcomes daily 08:00"],
  ["Bank partner feeds", "bank branch list weekly Mon 04:00"],
  ["MIS", "risk_cohorts monthly · advisor_master weekly Mon 04:00"],
];

const EXECUTORS: [string, string][] = [
  ["call list daily 09:00", "Call-centre vendors (fixed and variable payout)"],
  ["message batch hourly", "WhatsApp vendor"],
  ["call list hourly", "Voice bot vendor and Premium Renewal Voice Agent"],
  ["visit list daily 08:30", "Field (sales officers)"],
  ["RM nudge list daily 10:00", "Bank relationship manager"],
  ["handoff screen, live", "Agents and desks"],
];

const SPINE = ["Ingest", "Cohort", "Decide", "Act", "Verify", "Learn"];

function Arrow({ label }: { label: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center px-1">
      <code className="w-full truncate text-center text-[10px] text-file" title={label}>{label}</code>
      <span className="flex w-full items-center">
        <span className="h-px flex-1 bg-border" />
        <ArrowRight className="-ml-1 size-3 shrink-0 text-muted-foreground" aria-hidden />
      </span>
    </span>
  );
}

function WhereWeSitPage() {
  const { scoped } = useScopedPolicies();
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <PageHeader eyebrow="Where Desible sits" title="On top of what you already run" description="Your systems keep their jobs. Desible reads their files, decides, and hands work to the same vendors and teams." tiers={["simulated"]} />

      <Panel eyebrow="Diagram" title="Your systems, the control tower, the executors" tiers={["simulated"]}>
        <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_260px_1fr]">
          <div>
            <Eyebrow className="mb-2">Your systems</Eyebrow>
            <ul className="space-y-2">
              {SYSTEMS.map(([s, f]) => (
                <li key={s} className="flex items-center gap-1">
                  <span className="w-[44%] shrink-0 rounded-input border border-border bg-surface-translucent px-3 py-2 text-xs font-semibold text-foreground">{s}</span>
                  <Arrow label={f} />
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-center rounded-card border border-brand-tint-border bg-brand-tint p-4">
            <p className="text-center text-sm font-extrabold text-foreground">Desible control tower</p>
            <p className="text-center text-[11px] text-subtle">Rules, cohorts, audit</p>
            <ol className="mt-3 space-y-1.5">
              {SPINE.map((s, i) => (
                <li key={s} className="flex items-center gap-2 rounded-input border border-brand-tint-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full border border-brand-tint-border text-[10px] font-bold text-primary">{i + 1}</span>{s}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex justify-center"><TierBadge tiers={["live-engine"]} /></div>
          </div>
          <div>
            <Eyebrow className="mb-2">Executors</Eyebrow>
            <ul className="space-y-2">
              {EXECUTORS.map(([f, e]) => (
                <li key={e} className="flex items-center gap-1">
                  <Arrow label={f} />
                  <span className="w-[50%] shrink-0 rounded-input border border-border bg-surface-translucent px-3 py-2 text-xs font-semibold text-foreground">{e}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Vendor coexistence" title="Flip a vendor's mode and see what changes" tiers={["simulated"]}>
        <VendorCoexistenceTable policies={scoped} />
        <p className="mt-3 text-[11px] text-muted-foreground">Observe: Desible suggests, the vendor acts. Direct: Desible sends the list and order, the vendor still does the work. Replace-in-slice: Desible acts on one agreed slice only.</p>
      </Panel>

      <NoteBanner>File-first. We read your extracts over SFTP or a database view. No APIs needed to start.</NoteBanner>
    </div>
  );
}
