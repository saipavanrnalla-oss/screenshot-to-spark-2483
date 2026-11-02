import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";
import { PageHeader } from "@/components/ds/primitives";
import { FilterBar, type Filters } from "@/components/r1/filter-bar";
import { PageTabs } from "@/components/r1/tabs";
import { LastUpdated } from "@/components/r1/kpi";
import { BOARD_COLUMNS, COHORTS, matchesFilters, useStagedPolicies, useStageSettingsInForce, type BoardColumn } from "@/components/r1/policy-model";
import { StageSettingsEditor } from "@/components/r1/stage-settings-editor";
import { CHANNELS, PRODUCTS, REGIONS } from "@/data/persistency";
import { gate } from "@/lib/gate";
import { date, money, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NoteBanner } from "@/components/ds/primitives";

const search = z.object({
  tab: fallback(z.enum(["board", "settings"]).optional(), undefined),
  product: fallback(z.string().optional(), undefined),
  channel: fallback(z.string().optional(), undefined),
  region: fallback(z.string().optional(), undefined),
  cohort: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/stages")({
  beforeLoad: ({ search }) => gate("stages", search),
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "Policy stages · Persistency · desible.ai" },
      { name: "description", content: "Policies and premium due in each stage, on hold and surrender in progress, split by cohort." },
      { property: "og:title", content: "Policy stages · Persistency · desible.ai" },
      { property: "og:description", content: "Policies and premium due in each stage, on hold and surrender in progress, split by cohort." },
    ],
  }),
  component: StagesPage,
});

const NOTES: Record<BoardColumn, string> = {
  Sourcing: "Issue to end of free-look",
  Warming: "Warming start to window",
  "Renewal window": "Window opens to end of grace",
  "Early lapse": "Up to the lapse boundary",
  "Late lapse": "After the lapse boundary",
  "On hold": "Complaint, bereavement, stop-calling",
  "Surrender in progress": "Asked to surrender",
};

function StagesPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab = s.tab ?? "board";
  const filters: Filters = { product: s.product, channel: s.channel, region: s.region, cohort: s.cohort };
  const staged = useStagedPolicies();
  const { settings, pending } = useStageSettingsInForce();

  const columns = useMemo(() => {
    const out = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, { count: 0, premium: 0, cohorts: {} as Record<string, number> }])) as Record<BoardColumn, { count: number; premium: number; cohorts: Record<string, number> }>;
    for (const bp of staged) {
      if (!matchesFilters(bp, filters)) continue;
      const c = out[bp.column];
      c.count++;
      c.premium += bp.p.instalmentAmount;
      c.cohorts[bp.p.insurerCohort] = (c.cohorts[bp.p.insurerCohort] ?? 0) + 1;
    }
    return out;
  }, [staged, s.product, s.channel, s.region, s.cohort]);

  const open = (stage: string, cohort?: string) =>
    navigate({ to: "/persistency/policies", search: { stage, product: s.product, channel: s.channel, region: s.region, cohort: cohort ?? s.cohort } as never });

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader title="Policy stages" meta={<LastUpdated />} />
      <PageTabs
        label="Policy stages"
        value={tab}
        onChange={(t) => navigate({ search: (p) => ({ ...p, tab: t === "board" ? undefined : t }) })}
        tabs={[
          { id: "board", label: "Stage board" },
          { id: "settings", label: "Stage settings" },
        ]}
      />
      {tab === "board" ? (
        <>
          <FilterBar
            page="stages"
            fields={[
              { id: "product", label: "Product", options: PRODUCTS },
              { id: "channel", label: "Channel", options: CHANNELS },
              { id: "region", label: "Region", options: REGIONS },
              { id: "cohort", label: "Cohort", options: COHORTS },
            ]}
            values={filters}
            onChange={(v) => navigate({ search: (p) => ({ ...p, product: v.product, channel: v.channel, region: v.region, cohort: v.cohort }) })}
          />
          {pending && <NoteBanner tone="attention">Stage settings version {pending.no} applies from {date(pending.from)}. Counts below use the settings in force today.</NoteBanner>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
            {BOARD_COLUMNS.map((c) => {
              const col = columns[c];
              const interrupt = c === "On hold" || c === "Surrender in progress";
              return (
                <section key={c} className={cn("panel flex flex-col", interrupt && "border-dashed")}>
                  <button type="button" onClick={() => open(c)} className="cursor-pointer border-b border-border px-4 py-3 text-left hover:bg-surface-translucent" aria-label={`Open ${c} policies`}>
                    <h2 className="text-[14px] font-semibold text-foreground">{c}</h2>
                    <p className="text-[12px] text-muted-foreground">{NOTES[c]}</p>
                    <p className="mt-2 text-[24px] font-semibold leading-tight text-foreground tabular">{num(col.count)}</p>
                    <p className="text-[12px] text-muted-foreground">policies</p>
                    <p className="mt-1 text-[13px] text-foreground tabular">{money(col.premium)}</p>
                    <p className="text-[12px] text-muted-foreground">premium due</p>
                  </button>
                  <div className="flex flex-wrap gap-1.5 p-3">
                    {COHORTS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => open(c, k)}
                        className={cn("cursor-pointer rounded-pill border px-2 py-0.5 text-[12px] tabular hover:border-primary hover:text-foreground", s.cohort === k ? "border-primary text-foreground" : "border-border text-subtle")}
                        aria-label={`${c}, cohort ${k}: ${col.cohorts[k] ?? 0} policies`}
                      >
                        {k} {num(col.cohorts[k] ?? 0)}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="text-[12px] text-muted-foreground">
            Window opens {settings.windowOpens} days before due. Grace {settings.graceMonthly} days for monthly mode and {settings.graceOther} days for other modes. Lapse boundary {settings.lapseBoundary} days.
          </p>
        </>
      ) : (
        <StageSettingsEditor />
      )}
    </div>
  );
}
