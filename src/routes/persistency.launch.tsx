import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Play, PlayCircle, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteBanner, PageHeader } from "@/components/ds/primitives";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { StatusChip } from "@/components/r1/status-chip";
import { WF_NAME, runStatus, stageTone } from "@/components/r1/live-ui";
import { PALETTE_BY_TYPE } from "@/data/persistency/r1/wf";
import { gate } from "@/lib/gate";
import {
  BOOTH_FILE, FILE_COLUMNS, REPLIES, SAMPLE_FILE, bandLabel, parseDueFile, stagePolicy,
  type DueRow, type Reply, type RunState, type Staged,
} from "@/engine/live-run";
import { liveGraph, useLive } from "@/store/live";

export const Route = createFileRoute("/persistency/launch")({
  beforeLoad: ({ search }) => gate("launch", search),
  head: () => ({
    meta: [
      { title: "Load the due list · Persistency · desible.ai" },
      { name: "description", content: "Upload the due list. Each policy is staged and starts its workflow at the right step." },
      { property: "og:title", content: "Load the due list · Persistency · desible.ai" },
      { property: "og:description", content: "Upload the due list. Each policy is staged and starts its workflow at the right step." },
    ],
  }),
  component: LaunchPage,
});

function LaunchPage() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("due-list.csv");
  const [checked, setChecked] = useState<{ rows: DueRow[]; staged: Staged[]; problems: { line: number; message: string }[] } | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { runs, uploads, replies, addUpload, setReply, step, stepAll, clear } = useLive();
  const list = useMemo(() => Object.values(runs), [runs]);
  const current = uploads[0];
  const board = current ? list.filter((r) => r.events[0]?.title.includes(current.fileName)) : list;

  const check = () => {
    const p = parseDueFile(text);
    setMissing(p.missing);
    if (p.missing.length) {
      setChecked(null);
      return;
    }
    setChecked({ rows: p.rows, staged: p.rows.map((r) => stagePolicy(r)), problems: p.problems });
  };

  const start = () => {
    if (!checked) return;
    const up = addUpload(fileName, checked.rows);
    toast.success(`${up.started} ${up.started === 1 ? "policy" : "policies"} started${up.skipped.length ? `, ${up.skipped.length} not in these workflows` : ""}`);
    setChecked(null);
    setText("");
  };

  const runnable = board.filter((r) => !r.done && !r.waitingCase);

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <PageHeader title="Load the due list" meta="Upload the file. Each policy is staged and starts its workflow at the right step." />

      <section className="panel space-y-3 p-4" aria-label="Due list file">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Due list</p>
            <p className="text-[12px] text-muted-foreground">CSV with one row per policy. Required: policy number, customer name, mobile, due date, mode, premium.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setFileName(f.name); setChecked(null); } e.target.value = ""; }} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Upload CSV</Button>
            <Button size="sm" variant="outline" onClick={() => { setText(SAMPLE_FILE); setFileName("booth-two-policies.csv"); setChecked(null); }}>Two-policy sample</Button>
            <Button size="sm" variant="outline" onClick={() => { setText(BOOTH_FILE); setFileName("due-list-nov.csv"); setChecked(null); }}>Four-policy sample</Button>
          </div>
        </div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setChecked(null); }} rows={5} aria-label="Due list contents" placeholder={FILE_COLUMNS.map((c) => c.key).join(",")} className={`${inputCls} h-auto py-2 font-mono text-[12px]`} />
        {missing.length > 0 && <NoteBanner tone="failed">The file is missing {missing.join(", ")}.</NoteBanner>}
        <details className="text-[12px]">
          <summary className="cursor-pointer font-medium text-muted-foreground">Columns the file can carry</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="text-muted-foreground"><tr><th className="py-1 pr-3 font-medium">Column</th><th className="py-1 pr-3 font-medium">Meaning</th><th className="py-1 pr-3 font-medium">Needed</th><th className="py-1 font-medium">Example</th></tr></thead>
              <tbody>
                {FILE_COLUMNS.map((c) => (
                  <tr key={c.key} className="border-t border-border"><td className="py-1 pr-3 font-mono">{c.key}</td><td className="py-1 pr-3">{c.label}</td><td className="py-1 pr-3">{c.required ? "Yes" : "No"}</td><td className="py-1 font-mono">{c.example}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <div className="flex justify-end">
          <Button onClick={check} disabled={!text.trim()}><FileCheck2 /> Check and stage</Button>
        </div>
      </section>

      {checked && (
        <section className="panel space-y-3 p-4" aria-label="Staging">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-foreground">{checked.rows.length} {checked.rows.length === 1 ? "policy" : "policies"} read from {fileName}</p>
              <p className="text-[12px] text-muted-foreground">Each policy's stage and starting step, with the reason.</p>
            </div>
            <Button onClick={start} disabled={!checked.staged.some((s) => s.workflowId)}><Play /> Start {checked.staged.filter((s) => s.workflowId).length} {checked.staged.filter((s) => s.workflowId).length === 1 ? "policy" : "policies"}</Button>
          </header>
          {checked.problems.length > 0 && (
            <NoteBanner tone="attention">
              {checked.problems.length} {checked.problems.length === 1 ? "row was" : "rows were"} not read: {checked.problems.map((p) => `line ${p.line}, ${p.message}`).join("; ")}.
            </NoteBanner>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className="text-[12px] text-muted-foreground">
                <tr>{["Policy", "Renewal", "Stage", "Band", "Autopay", "Starts at", "Why"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {checked.rows.map((r, i) => {
                  const s = checked.staged[i]!;
                  const node = s.workflowId && s.entryNodeId ? liveGraph(s.workflowId).nodes.find((n) => n.id === s.entryNodeId) : undefined;
                  return (
                    <tr key={r.policy} className="border-t border-border align-top">
                      <td className="py-2 pr-3"><p className="font-medium text-foreground">{r.name}</p><p className="font-mono text-[12px] text-muted-foreground">{r.policy}</p></td>
                      <td className="py-2 pr-3">{s.renewal}</td>
                      <td className="py-2 pr-3"><StatusChip tone={stageTone(s.stage)}>{s.stage}</StatusChip><p className="mt-1 text-[12px] text-muted-foreground">{s.timing}</p></td>
                      <td className="py-2 pr-3">{bandLabel(r.band)}</td>
                      <td className="py-2 pr-3">{r.autopay}</td>
                      <td className="py-2 pr-3">{s.workflowId ? <><p className="text-foreground">{WF_NAME[s.workflowId]}</p><p className="text-[12px] text-muted-foreground">{node?.label ?? s.entryNodeId}</p></> : <span className="text-muted-foreground">Not started</span>}</td>
                      <td className="py-2 text-[12px] text-subtle"><ul className="list-disc space-y-0.5 pl-4">{s.reasons.map((x) => <li key={x}>{x}</li>)}</ul></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {board.length > 0 && (
        <section className="space-y-3" aria-label="Policies running">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Running from {current?.fileName ?? "uploads"}</h2>
              <p className="text-[12px] text-muted-foreground">Each step runs when you press Run. Pick the customer's answer to show a branch, or leave it to the customer.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { clear(); toast("Runs cleared"); }}>Clear runs</Button>
              <Button size="sm" onClick={() => stepAll(runnable.map((r) => r.id))} disabled={!runnable.length}><PlayCircle /> Run next step for all</Button>
            </div>
          </header>
          <div className="grid gap-3 lg:grid-cols-2">
            {board.map((r) => <RunCard key={r.id} run={r} reply={replies[r.id] ?? "As the customer would"} onReply={(v) => setReply(r.id, v)} onStep={() => step(r.id)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function RunCard({ run, reply, onReply, onStep }: { run: RunState; reply: Reply; onReply: (r: Reply) => void; onStep: () => void }) {
  const g = liveGraph(run.graphId);
  const node = g.nodes.find((n) => n.id === run.nodeId);
  const pal = node ? PALETTE_BY_TYPE[node.type] : undefined;
  const st = runStatus(run);
  const last = run.events.slice(-3).reverse();
  const isCall = node?.type === "agent.voice" || (node?.type === "agent.payment" && /call/i.test(node.label));
  return (
    <article className="panel flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">{run.row.name}</p>
          <p className="text-[12px] text-muted-foreground"><span className="font-mono">{run.row.policy}</span> · {run.row.plan} · Rs {run.row.premium.toLocaleString("en-IN")} {run.row.mode.toLowerCase()} · {bandLabel(run.row.band)}</p>
        </div>
        <StatusChip tone="neutral">{WF_NAME[run.graphId]}</StatusChip>
        <StatusChip tone={st.tone}>{st.word}</StatusChip>
      </header>

      {!run.done && node && (
        <div className="rounded-card border border-border bg-surface-translucent p-3">
          <p className="text-[12px] text-muted-foreground">{run.waitingCase ? "Waiting at" : "Next step"}</p>
          <p className="text-[13px] font-medium text-foreground">{node.label}</p>
          <p className="text-[12px] text-muted-foreground">{node.config.executor ?? pal?.executor ?? "Platform"}{node.config.script ? ` · ${node.config.script}` : ""}</p>
          {run.waitingCase ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <UserRound className="size-4 text-attention" />
              <span>{run.waitingCase.why}</span>
              <Link to="/persistency/queue" className="ml-auto font-medium text-primary hover:underline">Open in the queue</Link>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isCall && (
                <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  Customer's answer
                  <select value={reply} onChange={(e) => onReply(e.target.value as Reply)} className={selectCls} aria-label={`Customer's answer for ${run.row.policy}`}>
                    {REPLIES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
              )}
              {!isCall && (
                <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  Customer
                  <select value={reply === "Pays now" ? "Pays now" : "As the customer would"} onChange={(e) => onReply(e.target.value as Reply)} className={selectCls} aria-label={`Customer action for ${run.row.policy}`}>
                    <option>As the customer would</option>
                    <option>Pays now</option>
                  </select>
                </label>
              )}
              <Button size="sm" className="ml-auto" onClick={onStep}><Play /> Run</Button>
            </div>
          )}
        </div>
      )}

      <ol className="space-y-1.5">
        {last.map((e) => (
          <li key={e.id} className="text-[12px]">
            <span className="text-foreground">{e.title}</span>
            {e.status && <span className="text-muted-foreground"> · {e.status}</span>}
            <span className="text-muted-foreground"> · {e.by}</span>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex justify-end">
        <Link to="/persistency/runs/$policy" params={{ policy: run.id }} className="text-[12px] font-medium text-primary hover:underline">Open the full trail</Link>
      </div>
    </article>
  );
}
