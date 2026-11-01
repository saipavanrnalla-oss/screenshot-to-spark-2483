import { createFileRoute, Link } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Chip, DataTable, PageHeader, Panel, SegmentedControl, StatusPill } from "@/components/ds/primitives";
import { VendorCoexistenceTable } from "@/components/persistency/vendor-modes";
import { useScopedPolicies } from "@/hooks/use-shell";
import { PERSONAS } from "@/config/personas";
import { EARLY_LAPSE_MAX_DAYS, GRACE_DAYS, INSURER_NAME, LANGUAGES, PAYMENT_MODES, PRODUCTS, WARMING_STATIONS, type CohortSet } from "@/data/persistency";
import { useAdapters, usePersistencyStore } from "@/store/persistency";

export const Route = createFileRoute("/persistency/admin")({
  beforeLoad: ({ search }) => gate("admin", search),
  head: () => ({
    meta: [
      { title: "Setup · Persistency · desible.ai" },
      { name: "description", content: "Insurer profile, grace rules, station calendar, cohort source per product and vendor modes." },
      { property: "og:title", content: "Setup · Persistency · desible.ai" },
      { property: "og:description", content: "Insurer profile, grace rules, station calendar, cohort source per product and vendor modes." },
    ],
  }),
  component: SetupPage,
});

const SET_OPTIONS = ["Your file", "Rules", "Starter score"] as const;
const SET_OF: Record<(typeof SET_OPTIONS)[number], CohortSet> = { "Your file": "insurer", Rules: "rules", "Starter score": "starter" };
const LABEL_OF: Record<CohortSet, (typeof SET_OPTIONS)[number]> = { insurer: "Your file", rules: "Rules", starter: "Starter score" };

function SetupPage() {
  const { scoped } = useScopedPolicies();
  const adapters = useAdapters();
  const s = usePersistencyStore();
  const [number, setNumber] = useState(s.testNumber ?? "");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Setup"
        title="Setup"
        description="Everything the engine reads, in one place. Changes apply to this session."
        tiers={["live-engine"]}
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm"><RotateCcw /> Load sample insurer</Button></AlertDialogTrigger>
            <AlertDialogContent className="border-border bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset to the sample insurer?</AlertDialogTitle>
                <AlertDialogDescription>All simulated events, approvals, settings and logged outcomes from this session are cleared. The seeded book of 12,000 policies loads again.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { s.resetDemo(); setNumber(""); toast("Sample insurer loaded", { description: "Demo seed reset." }); }}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Insurer profile" title={INSURER_NAME} tiers={["live-engine"]}>
          <dl className="space-y-3 text-xs">
            <div><dt className="text-muted-foreground">Name</dt><dd className="mt-0.5 font-semibold text-foreground">{INSURER_NAME} (composite, no real branding)</dd></div>
            <div><dt className="text-muted-foreground">Products</dt><dd className="mt-1 flex gap-1.5">{PRODUCTS.map((p) => <Chip key={p} active>{p}</Chip>)}</dd></div>
            <div><dt className="text-muted-foreground">Payment modes</dt><dd className="mt-1 flex flex-wrap gap-1.5">{PAYMENT_MODES.map((p) => <Chip key={p} active>{p}</Chip>)}</dd></div>
          </dl>
        </Panel>

        <Panel eyebrow="Grace rules" title="From payment mode" tiers={["live-engine"]}>
          <DataTable head={["Rule", "Value", "Source"]} minWidth={420}>
            <tr><td className="text-foreground">Grace, Monthly mode</td><td className="font-semibold text-foreground">{GRACE_DAYS.Monthly} days</td><td><StatusPill status="healthy">Insurer rule</StatusPill></td></tr>
            <tr><td className="text-foreground">Grace, all other modes</td><td className="font-semibold text-foreground">{GRACE_DAYS.other} days</td><td><StatusPill status="healthy">Insurer rule</StatusPill></td></tr>
            <tr><td className="text-foreground">Early lapse</td><td className="font-semibold text-foreground">{EARLY_LAPSE_MAX_DAYS} days or less after grace</td><td><StatusPill status="healthy">Insurer rule</StatusPill></td></tr>
            <tr><td className="text-foreground">Late lapse revival</td><td className="font-semibold text-foreground">Good-health declaration or medicals</td><td><StatusPill status="healthy">Insurer rule</StatusPill></td></tr>
          </DataTable>
        </Panel>
      </div>

      <Panel eyebrow="Station calendar" title="Nine warming stations" tiers={["live-engine"]}>
        <DataTable head={["#", "Day", "Label (editable)", "Channel", "Content"]} minWidth={720}>
          {WARMING_STATIONS.map((st) => (
            <tr key={st.n}>
              <td className="text-muted-foreground">{st.n}</td>
              <td className="text-subtle tabular">T{st.dayOffset}</td>
              <td>
                <Input value={s.stationLabels[st.n] ?? st.label} onChange={(e) => s.setStationLabel(st.n, e.target.value)} aria-label={`Label for station ${st.n}`} className="h-7 w-48 rounded-input border-border bg-surface-translucent text-xs" />
              </td>
              <td className="text-subtle">{st.channel}</td>
              <td className="text-subtle">{st.content}</td>
            </tr>
          ))}
        </DataTable>
        <p className="mt-2 text-[11px] text-dim">Labels show on the Lifecycle track. ULIP starts each station a month earlier (product matrix).</p>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Cohort source" title="Per product" tiers={["live-engine"]}>
          <ul className="space-y-3">
            {PRODUCTS.map((p) => (
              <li key={p} className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-foreground">{p}</span>
                <SegmentedControl size="sm" label={`Cohort source for ${p}`} value={LABEL_OF[s.activeCohortSet[p]]} options={SET_OPTIONS} onChange={(v) => s.setActiveCohortSet(p, SET_OF[v])} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel eyebrow="Live channels" title="Registered test number" tiers={["live-channels"]}>
          <p className="text-xs text-subtle">Test sends from workflow steps and the handoff screen go only to this number. Customers are never contacted from a test.</p>
          <div className="mt-3 flex gap-2">
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+91 98xxxxxx00" aria-label="Registered test number" className="h-8 w-56 rounded-input border-border bg-surface-translucent text-xs" />
            <Button size="sm" disabled={number.replace(/\D/g, "").length < 10} onClick={() => { s.setTestNumber(number.trim()); toast("Test number saved"); }}>Save</Button>
            {s.testNumber && <Button size="sm" variant="outline" onClick={() => { s.setTestNumber(null); setNumber(""); }}>Remove</Button>}
          </div>
          <p className="mt-2">{s.testNumber ? <StatusPill status="healthy">Test number registered</StatusPill> : <StatusPill status="attention">Needs a registered test number</StatusPill>}</p>
        </Panel>
      </div>

      <Panel eyebrow="Vendor modes" title="How each vendor works with Desible" tiers={["simulated"]}>
        <VendorCoexistenceTable policies={scoped} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel eyebrow="File adapters" title={`${adapters.filter((a) => a.enabled).length} of ${adapters.length} on`} tiers={["simulated"]}>
          <ul className="space-y-1.5 text-xs">
            {adapters.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className="text-foreground">{a.name}</span>
                {!a.enabled ? <StatusPill status="simulated">Off</StatusPill> : a.stale ? <StatusPill status="attention">Late</StatusPill> : <StatusPill status="healthy">On time</StatusPill>}
              </li>
            ))}
          </ul>
          <Link to="/persistency/data" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">Manage in Data and integrations</Link>
        </Panel>

        <Panel eyebrow="Languages" title={`${s.languages.length} of ${LANGUAGES.length} enabled`} tiers={["live-engine"]}>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((l) => <Chip key={l} active={s.languages.includes(l)} onClick={() => s.toggleLanguage(l)}>{l}</Chip>)}
          </div>
          <p className="mt-2 text-[11px] text-dim">Scripts and templates are kept for enabled languages only.</p>
        </Panel>

        <Panel eyebrow="Personas" title={`${s.enabledPersonas.length} of ${PERSONAS.length} enabled`} tiers={["live-engine"]}>
          <ul className="space-y-1.5">
            {PERSONAS.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground">{p.label}</span>
                <Switch aria-label={`Enable ${p.label}`} checked={s.enabledPersonas.includes(p.id)} disabled={p.id === "head"} onCheckedChange={() => s.togglePersona(p.id)} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-dim">Disabled personas leave the "Viewing as" list. Head of Persistency always stays on.</p>
        </Panel>
      </div>
    </div>
  );
}
