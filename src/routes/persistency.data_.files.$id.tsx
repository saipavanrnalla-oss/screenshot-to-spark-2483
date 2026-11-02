import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, NoteBanner, Panel } from "@/components/ds/primitives";
import { DataGrid } from "@/components/r1/data-grid";
import { StatusChip } from "@/components/r1/status-chip";
import { PageTabs, selectCls } from "@/components/r1/tabs";
import { importPermission, useAdapterRows, useFileHistory } from "@/components/r1/data-model";
import { DATE_FORMATS, TARGETS, autoMap, sampleFor, seedRejects } from "@/data/persistency/r1/files";
import { useCan, useUser } from "@/hooks/use-user";
import { can } from "@/config/users";
import { gate } from "@/lib/gate";
import { dateTime, num } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { useWork } from "@/store/work";

const search = z.object({
  tab: fallback(z.enum(["preview", "mapping", "rejects", "history"]).optional(), undefined),
});

export const Route = createFileRoute("/persistency/data_/files/$id")({
  validateSearch: zodValidator(search),
  beforeLoad: ({ search }) => gate("data", search),
  head: ({ params }) => ({
    meta: [
      { title: `File ${params.id} · Data files · desible.ai` },
      { name: "description", content: "File preview, column mapping, rejects and receipt history." },
      { property: "og:title", content: `File ${params.id} · Data files · desible.ai` },
      { property: "og:description", content: "File preview, column mapping, rejects and receipt history." },
    ],
  }),
  component: FilePage,
});

function FilePage() {
  const { id } = Route.useParams();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const nav = useNavigate();
  const user = useUser();
  const a = useAdapterRows().find((x) => x.id === id);
  if (!a) return <EmptyState title={`There is no file called ${id}.`} action={<Link to="/persistency/data" className="text-[13px] text-primary hover:underline">Back to Data files</Link>} />;
  const tab = s.tab ?? "preview";
  const perm = importPermission(a);
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <Link to="/persistency/data" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Data files</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[20px] font-semibold text-foreground">{a.name}</h1>
        <StatusChip tone={a.overdue ? "risk" : "ok"}>{a.overdue ? "Overdue" : a.direction === "Out" ? "Sent" : "Received"}</StatusChip>
        <span className="text-[12px] text-muted-foreground">{a.direction} · {a.source} · {a.schedule} · last {dateTime(a.lastReceived)}</span>
        {perm && user && can(user, perm) && <Button size="sm" className="ml-auto" onClick={() => nav({ to: "/persistency/data/import/$id", params: { id } })}><Upload /> Import file</Button>}
      </div>
      {a.overdue && <NoteBanner tone="attention">This file is overdue. Expected {a.schedule.toLowerCase()}; last received {dateTime(a.lastReceived)}.</NoteBanner>}
      <PageTabs
        label="File"
        value={tab}
        onChange={(v) => navigate({ search: { tab: v === "preview" ? undefined : v } })}
        tabs={[
          { id: "preview", label: "Preview" },
          { id: "mapping", label: "Mapping" },
          { id: "rejects", label: "Rejects", count: a.rejects || undefined },
          { id: "history", label: "History" },
        ]}
      />
      {tab === "preview" && <Preview id={id} />}
      {tab === "mapping" && <Mapping id={id} />}
      {tab === "rejects" && <Rejects id={id} />}
      {tab === "history" && <History id={id} />}
    </div>
  );
}

function Preview({ id }: { id: string }) {
  const f = useMemo(() => sampleFor(id), [id]);
  if (!f) return <EmptyState title="This file is produced by the app. Lists made in Outbound lists appear here when sent." />;
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-[12px]">
        <thead className="bg-card"><tr>{f.header.map((h) => <th key={h} className="border-b border-border px-3 py-2 text-left font-mono font-medium text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>{f.rows.slice(0, 25).map((r, i) => <tr key={i} className="border-b border-border/60">{r.map((c, j) => <td key={j} className="px-3 py-1.5 tabular">{c}</td>)}</tr>)}</tbody>
      </table>
      <p className="px-3 py-2 text-[12px] text-muted-foreground">First 25 of {num(f.rows.length)} rows.</p>
    </div>
  );
}

function Mapping({ id }: { id: string }) {
  const f = useMemo(() => sampleFor(id), [id]);
  const savedMap = useWork((s) => s.mappings[id]);
  const saveMapping = useWork((s) => s.saveMapping);
  const mayMap = useCan("files.map");
  const targets = TARGETS[id] ?? [];
  const base = useMemo(() => savedMap?.mapping ?? (f ? autoMap(id, f.header) : {}), [savedMap, f, id]);
  const [m, setM] = useState<Record<string, string>>(base);
  const [fmt, setFmt] = useState<string>(savedMap?.dateFormat ?? "yyyy-mm-dd");
  if (!f || !targets.length) return <EmptyState title="This file has no mapping." />;
  const dirty = JSON.stringify(m) !== JSON.stringify(base) || fmt !== (savedMap?.dateFormat ?? "yyyy-mm-dd");
  const mapped = new Set(Object.values(m));
  const missing = targets.filter((t) => t.required && !mapped.has(t.key));
  return (
    <Panel
      title={`Mapping, version ${savedMap?.version ?? 1}`}
      actions={mayMap && <Button size="sm" disabled={!dirty || missing.length > 0} onClick={() => { saveMapping(id, m, fmt); toast.success("Mapping saved as a new version"); }}>Save mapping</Button>}
      bodyClassName="p-0"
    >
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">Source column</th><th className="px-3 py-2 font-medium">Target field</th><th className="px-3 py-2 font-medium">Transform</th><th className="px-3 py-2 font-medium">Required</th></tr></thead>
        <tbody>
          {f.header.map((h) => {
            const t = targets.find((x) => x.key === m[h]);
            return (
              <tr key={h} className="border-t border-border/60">
                <td className="px-3 py-1.5 font-mono">{h}</td>
                <td className="px-3 py-1.5">
                  <select disabled={!mayMap} value={m[h] ?? ""} onChange={(e) => setM((x) => { const n = { ...x }; if (e.target.value) n[h] = e.target.value; else delete n[h]; return n; })} className={`${selectCls} w-full`} aria-label={`Target for ${h}`}>
                    <option value="">Not mapped</option>
                    {targets.map((tg) => <option key={tg.key} value={tg.key}>{tg.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5">{t?.date ? <select disabled={!mayMap} value={fmt} onChange={(e) => setFmt(e.target.value)} className={selectCls} aria-label="Date format">{DATE_FORMATS.map((d) => <option key={d}>{d}</option>)}</select> : <span className="text-subtle">Trim spaces</span>}</td>
                <td className="px-3 py-1.5">{t?.required ? "Required" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {missing.length > 0 && <p className="px-3 py-2 text-[12px] text-attention">Required fields not mapped: {missing.map((x) => x.label).join(", ")}</p>}
    </Panel>
  );
}

function Rejects({ id }: { id: string }) {
  const rows = seedRejects(id);
  if (!rows.length) return <EmptyState title="No rejects in the last file." />;
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={() => downloadCsv(`${id}-rejects.csv`, ["ROW", "REASON", "VALUE"], rows.map((r) => [r.row, r.reason, r.value]))}><Download /> Download rejects</Button>
      <DataGrid label="Rejects" rows={rows} rowKey={(r) => String(r.row)} columns={[{ id: "row", label: "Row", align: "right", value: (r) => r.row }, { id: "reason", label: "Reason", value: (r) => r.reason }, { id: "value", label: "Value", value: (r) => r.value || "(blank)" }]} />
    </div>
  );
}

function History({ id }: { id: string }) {
  const rows = useFileHistory(id);
  const addNote = useWork((s) => s.addFileNote);
  const user = useUser();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  return (
    <>
      <DataGrid
        label="History"
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { id: "at", label: "Time", value: (r) => r.at, render: (r) => dateTime(r.at) },
          { id: "rows", label: "Rows", align: "right", value: (r) => r.rows, render: (r) => num(r.rows) },
          { id: "rejects", label: "Rejects", align: "right", value: (r) => r.rejects, render: (r) => num(r.rejects) },
          { id: "by", label: "Imported by", value: (r) => r.by },
          { id: "notes", label: "Notes", value: (r) => r.notes.join("; "), render: (r) => <span className="text-subtle">{r.notes.join(" · ")}</span> },
          { id: "act", label: "", sortable: false, value: () => "", render: (r) => <Button size="sm" variant="ghost" onClick={() => { setOpen(r.id); setNote(""); }}>Add note</Button> },
        ]}
      />
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-md rounded-card border-border bg-card">
          <DialogHeader><DialogTitle className="text-[14px] font-semibold">Add note</DialogTitle></DialogHeader>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" className="block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px]" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
            <Button disabled={!note.trim()} onClick={() => { if (open) addNote(id, open, note.trim(), user?.name ?? "User"); setOpen(null); toast.success("Note added"); }}>Add note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
