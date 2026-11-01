import { Link } from "@tanstack/react-router";
import { ArrowRight, Landmark, Radio, Signal, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ds/primitives";
import { Wordmark } from "@/components/shell/wordmark";
import { BASE_POLICIES, collection, headline, persistency, revivalRateMtd } from "@/data/persistency";
import { croreValue, num, pct } from "@/lib/format";



const SYSTEMS = [
  "Policy admin",
  "Billing and receipts",
  "NACH mandates",
  "CRM",
  "Telecalling vendors",
  "WhatsApp",
  "Voice bot",
  "Bank partner feeds",
  "MIS",
];

const ROADMAP = [
  { name: "Banking", icon: Landmark },
  { name: "Telecom", icon: Signal },
  { name: "Healthcare", icon: Stethoscope },
];

/** First-brief entry page. Hidden in release 1 (positioning); kept for a later version. */
export function EntryPage() {
  const p13 = persistency(BASE_POLICIES)[0]!;
  const stats = headline(BASE_POLICIES);
  const revival = revivalRateMtd(BASE_POLICIES);
  const col = collection(BASE_POLICIES, "All");

  const numbers = [
    { label: "13M persistency, premium-weighted", value: pct(p13.premiumWeighted) },
    { label: "Policies in grace", value: num(stats.inGrace) },
    { label: "Revival rate, month to date", value: pct(revival.rate) },
    { label: `Collected vs ${croreValue(col.planCr, 0)} plan`, value: croreValue(col.collectedCr, 0) },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-8 py-5">
        <Wordmark />
        <span className="text-xs text-muted-foreground">Demo data · 28 Oct 2026</span>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pb-16 pt-10">
        <p className="eyebrow">desible.ai · Insurance</p>
        <h1 className="mt-3 max-w-3xl text-center text-[36px] font-extrabold leading-[1.1] tracking-tight text-foreground md:text-[44px]">
          Persistency <span className="text-primary">control tower</span>
        </h1>
        <p className="mt-4 max-w-2xl text-center text-base text-subtle">
          One system for every policy, from sourcing to revival, built to sit on top of your existing systems and vendors.
        </p>

        <section className="mt-12 w-full max-w-4xl rounded-card border border-brand-tint-border bg-card p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Insurance</p>
              <h2 className="mt-1 text-2xl font-extrabold text-foreground">Persistency</h2>
              <p className="mt-1 text-sm text-subtle">Sample Life Insurance · 12,000 synthetic policies · ULIP, Traditional, Term</p>
            </div>
            <StatusPill status="live">Live</StatusPill>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {numbers.map((n) => (
              <div key={n.label} className="panel-translucent accent-left px-4 py-3">
                <dd className="stat-number">{n.value}</dd>
                <dt className="stat-label mt-1">{n.label}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-dim">All figures computed from the seeded demo data. Plan of ₹182 Cr is the insurer's monthly plan.</p>
            <Button asChild size="lg">
              <Link to="/persistency">
                Open Persistency <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        <div className="mt-6 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
          {ROADMAP.map((r) => (
            <div key={r.name} aria-disabled className="flex items-center justify-between rounded-card border border-border bg-surface-translucent px-5 py-4 opacity-60">
              <span className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
                <r.icon className="size-4" aria-hidden /> {r.name}
              </span>
              <span className="rounded-pill border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-dim">Roadmap</span>
            </div>
          ))}
        </div>
      </main>

      <section className="bg-strip px-8 py-6 text-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em]">
            <Radio className="size-3.5 text-primary" aria-hidden /> Sits on top of what you already run
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
            {SYSTEMS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="text-[12px] font-semibold">File-first. No APIs needed to start.</p>
        </div>
      </section>
    </div>
  );
}
