import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, NoteBanner, Panel } from "@/components/ds/primitives";
import { selectCls } from "@/components/r1/tabs";
import { applyImport, importPermission, summarise } from "@/components/r1/data-model";
import { ADAPTERS, DATE_FORMATS, TARGETS, autoMap, checkFile, missingColumns, parseCsv, sampleFor, type CheckResult, type DateFormat, type SampleFile } from "@/data/persistency/r1/files";
import { useUser } from "@/hooks/use-user";
import { can } from "@/config/users";
import { gate } from "@/lib/gate";
import { num } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { useWork } from "@/store/work";

export const Route = createFileRoute("/persistency/data_/import/$id")({
  beforeLoad: ({ search }) => gate("data", search),
  head: ({ params }) => ({
    meta: [
      { title: `Import ${params.id} · Data files · desible.ai` },
      { name: "description", content: "Import a file: upload, map and check, confirm." },
      { property: "og:title", content: `Import ${params.id} · Data files · desible.ai` },
      { property: "og:description", content: "Import a file: upload, map and check, confirm." },
    ],
  }),
  component: ImportWizard,
});

const STEPS = ["Upload", "Map and check", "Confirm"] as const;

function ImportWizard() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const user = useUser();
  const a = ADAPTERS.find((x) => x.id === id);
  const savedMap = useWork((s) => s.mappings[id]);
  const saveMapping = useWork((s) => s.saveMapping);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<SampleFile | null>(null);
  const [refused, setRefused] = useState<string[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fmt, setFmt] = useState<DateFormat>((savedMap?.dateFormat as DateFormat | undefined) ?? "yyyy-mm-dd");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const targets = TARGETS[id] ?? [];
  const perm = a ? importPermission(a) : null;
  const summary = useMemo(() => (check ? summarise(id, check) : null), [check, id]);

  if (!a || !perm) return <EmptyState title="This file cannot be imported." action={<Link to="/persistency/data" className="text-[13px] text-primary hover:underline">Back to Data files</Link>} />;
  if (!user || !can(user, perm)) return <EmptyState title={`${user?.name ?? "This user"} cannot import ${a.name}.`} action={<Link to="/persistency/data/files/$id" params={{ id }} className="text-[13px] text-primary hover:underline">Open the file page</Link>} />;

  const load = (f: SampleFile) => {
    const miss = missingColumns(id, f.header);
    if (miss.length) {
      setRefused(miss);
      setFile(null);
      return;
    }
    setRefused(null);
    setFile(f);
    const auto = autoMap(id, f.header);
    setMapping(savedMap ? { ...auto, ...Object.fromEntries(Object.entries(savedMap.mapping).filter(([k]) => f.header.includes(k))) } : auto);
    setCheck(null);
    setStep(1);
  };
  const runCheck = () => {
    if (!file) return;
    setBusy(true);
    setTimeout(() => {
      setCheck(checkFile(id, file, mapping, fmt));
      setBusy(false);
    }, 10);
  };
  const mapped = new Set(Object.values(mapping));
  const missingReq = targets.filter((t) => t.required && !mapped.has(t.key));
  const reasons = check ? Object.entries(check.rejects.reduce<Record<string, number>>((m, r) => ({ ...m, [r.reason]: (m[r.reason] ?? 0) + 1 }), {})) : [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <Link to="/persistency/data/files/$id" params={{ id }} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> {a.name}</Link>
      <h1 className="text-[20px] font-semibold text-foreground">Import {a.name}</h1>
      <ol className="flex gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[12px] ${i === step ? "border-primary text-foreground" : i < step ? "border-border text-ok" : "border-border text-muted-foreground"}`}>
            {i < step ? <Check className="size-3" /> : <span className="tabular">{i + 1}</span>} {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Panel title="Upload">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border px-6 py-10 text-[13px] text-subtle hover:border-primary"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void f.text().then((t) => load({ ...parseCsv(t), name: f.name }));
            }}
          >
            <Upload className="size-5" />
            Drop a CSV here or click to choose one
            <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose a CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then((t) => load({ ...parseCsv(t), name: f.name })); }} />
          </label>
          {sampleFor(id) && <Button variant="link" className="mt-2 px-0" onClick={() => load(sampleFor(id)!)}>Use sample file</Button>}
          {refused && <NoteBanner tone="attention" className="mt-3">File refused. Missing columns: {refused.join(", ")}.</NoteBanner>}
        </Panel>
      )}

      {step === 1 && file && (
        <Panel title={`Map and check · ${file.name} · ${num(file.rows.length)} rows`}>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium">Source column</th><th className="font-medium">Target field</th><th className="font-medium">Sample value</th></tr></thead>
            <tbody>
              {file.header.map((h, i) => (
                <tr key={h} className="border-t border-border/60">
                  <td className="py-1.5 font-mono">{h}</td>
                  <td>
                    <select value={mapping[h] ?? ""} onChange={(e) => { setCheck(null); setMapping((m) => { const n = { ...m }; if (e.target.value) n[h] = e.target.value; else delete n[h]; return n; }); }} className={`${selectCls} w-full ${!mapping[h] ? "border-attention" : ""}`} aria-label={`Target for ${h}`}>
                      <option value="">Not mapped</option>
                      {targets.map((t) => <option key={t.key} value={t.key}>{t.label}{t.required ? " (required)" : ""}</option>)}
                    </select>
                  </td>
                  <td className="pl-3 text-subtle tabular">{file.rows[0]?.[i] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {targets.some((t) => t.date) && (
            <label className="mt-3 block text-[12px] font-medium text-muted-foreground">Date format
              <select value={fmt} onChange={(e) => { setFmt(e.target.value as DateFormat); setCheck(null); }} className={`${selectCls} mt-1 block`} aria-label="Date format">{DATE_FORMATS.map((d) => <option key={d}>{d}</option>)}</select>
            </label>
          )}
          {missingReq.length > 0 && <p className="mt-2 text-[12px] text-attention">Map every required field: {missingReq.map((t) => t.label).join(", ")}.</p>}
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button size="sm" disabled={missingReq.length > 0 || busy} onClick={runCheck}>{busy ? "Checking" : "Check"}</Button>
            {check && <Button size="sm" disabled={check.valid.length === 0} onClick={() => setStep(2)}>Next</Button>}
          </div>
          {check && (
            <div className="mt-4 space-y-2">
              <p className="text-[13px]"><span className="font-semibold tabular text-ok">{num(check.valid.length)}</span> valid rows · <span className="font-semibold tabular text-attention">{num(check.rejects.length)}</span> rejects</p>
              {reasons.length > 0 && (
                <>
                  <ul className="text-[13px] text-subtle">{reasons.map(([r, n]) => <li key={r}>{r}: <span className="tabular">{num(n)}</span></li>)}</ul>
                  <Button size="sm" variant="outline" onClick={() => downloadCsv(`${id}-rejects.csv`, ["ROW", "REASON"], check.rejects.map((r) => [r.row, r.reason]))}><Download /> Download rejects</Button>
                </>
              )}
            </div>
          )}
        </Panel>
      )}

      {step === 2 && check && summary && (
        <Panel title="Confirm">
          <p className="text-[13px] text-subtle">{num(check.valid.length)} valid rows will be imported; {num(check.rejects.length)} rejects are left out.</p>
          <ul className="mt-3 space-y-1 text-[13px]">
            {summary.lines.map(([k, v]) => <li key={k} className="flex max-w-md justify-between"><span>{k}</span><span className="font-semibold tabular">{num(v)}</span></li>)}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button
              size="sm"
              onClick={() => {
                if (!savedMap || JSON.stringify(savedMap.mapping) !== JSON.stringify(mapping) || savedMap.dateFormat !== fmt) saveMapping(id, mapping, fmt);
                applyImport(id, check, user.name, check.rejects.length);
                toast.success(`${a.name} imported`, { description: summary.lines.map(([k, v]) => `${k} ${num(v)}`).join(" · ") });
                navigate({ to: "/persistency/data/files/$id", params: { id }, search: { tab: "history" } });
              }}
            >
              Confirm import
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
