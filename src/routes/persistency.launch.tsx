import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Loader2, MessageCircle, Phone, Play, PlayCircle, Radio, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteBanner, PageHeader } from "@/components/ds/primitives";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { StatusChip } from "@/components/r1/status-chip";
import { CHANNEL_TONE, WF_NAME, channelOf, runStatus, stageTone } from "@/components/r1/live-ui";
import { WorthCard } from "@/components/r1/worth-card";
import { PALETTE_BY_TYPE } from "@/data/persistency/r1/wf";
import { gate } from "@/lib/gate";
import {
  BOOTH_FILE, BOOTH_STORIES, INSURER_FORMAT_FILE, FILE_COLUMNS, REPLIES, SAMPLE_FILE, bandLabel, beatAt, parseDueFile, scriptFor, stagePolicy, wordsFor,
  type DueRow, type LiveEvent, type Reply, type RunState, type Staged,
} from "@/engine/live-run";
import { isLiveRun, liveGraph, previewEntry, useLive } from "@/store/live";

export const Route = createFileRoute("/persistency/launch")({
  beforeLoad: ({ search }) => gate("launch", search),
  head: () => ({
    meta: [
      { title: "Import due list · Persistency · desible.ai" },
      { name: "description", content: "Upload the due list. Each policy is staged and starts its workflow at the right step." },
      { property: "og:title", content: "Import due list · Persistency · desible.ai" },
      { property: "og:description", content: "Upload the due list. Each policy is staged and starts its workflow at the right step." },
    ],
  }),
  component: LaunchPage,
});

/** Contact steps worth comparing across customers, in journey order. */
const WORD_STEPS: { id: string; label: string }[] = [
  { id: "early", label: "Renewal call (T-90)" },
  { id: "explain1", label: "If not convinced" },
  { id: "link15", label: "WhatsApp link (T-15)" },
  { id: "link15b", label: "Second WhatsApp" },
  { id: "call15", label: "Reminder call (T-15)" },
  { id: "rehit", label: "Grace Period call" },
];

function LaunchPage() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("due-list.csv");
  const [checked, setChecked] = useState<{ rows: DueRow[]; staged: Staged[]; problems: { line: number; message: string }[] } | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { runs, uploads, replies, addUpload, setReply, step, stepAll, clear, liveOn, serverLive, setLiveOn, loadConfig, poll } = useLive();
  const waiting = Object.values(runs).some((r) => r.live);
  useEffect(() => { void loadConfig(); }, [loadConfig]);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { void poll(); }, 2500);
    return () => clearInterval(t);
  }, [waiting, poll]);
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

  const runnable = board.filter((r) => !r.done && !r.waitingCase && !r.live);

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <PageHeader title="Import due list" meta="Upload the file. Each policy is staged and starts its workflow at the right step." />

      <section className="panel space-y-3 p-4" aria-label="Due list file">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Due list</p>
            <p className="text-[12px] text-muted-foreground">CSV with one row per policy. Required: policy number, customer name, mobile, due date, mode, premium. The insurer's own export columns (PO Name, Contact Number, Frequency, Suspense Balance, Net collectable premium and the rest) are read as they are.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setFileName(f.name); setChecked(null); } e.target.value = ""; }} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Upload CSV</Button>
            <Button size="sm" variant="outline" onClick={() => { setText(SAMPLE_FILE); setFileName("booth-use-cases.csv"); setChecked(null); }}>Booth use cases</Button>
            <Button size="sm" variant="outline" onClick={() => { setText(BOOTH_FILE); setFileName("due-list-nov.csv"); setChecked(null); }}>Seven-policy sample</Button>
            <Button size="sm" variant="outline" onClick={() => { setText(INSURER_FORMAT_FILE); setFileName("PAS-due-list-export.csv"); setChecked(null); }}>Insurer file format</Button>
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
              <p className="text-[12px] text-muted-foreground">Each policy's stage, the step it starts at, and the script it gets there, with the reason.</p>
            </div>
            <Button onClick={start} disabled={!checked.staged.some((s) => s.workflowId)}><Play /> Start {checked.staged.filter((s) => s.workflowId).length} {checked.staged.filter((s) => s.workflowId).length === 1 ? "policy" : "policies"}</Button>
          </header>
          {checked.problems.length > 0 && (
            <NoteBanner tone="attention">
              {checked.problems.length} {checked.problems.length === 1 ? "row was" : "rows were"} not read: {checked.problems.map((p) => `line ${p.line}, ${p.message}`).join("; ")}.
            </NoteBanner>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-[13px]">
              <thead className="text-[12px] text-muted-foreground">
                <tr>{["Policy", "Renewal", "Stage", "Band", "Starts at", "Script it gets", "Why"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {checked.rows.map((r, i) => {
                  const s = checked.staged[i]!;
                  const first = s.workflowId ? previewEntry(r) : undefined;
                  const sc = first ? scriptFor(r, s, first.nodeId) : undefined;
                  const ch = first ? channelOf(first.type, first.label) : undefined;
                  const story = BOOTH_STORIES[r.policy];
                  return (
                    <tr key={r.policy} className="border-t border-border align-top">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-foreground">{r.name}</p>
                        <p className="font-mono text-[12px] text-muted-foreground">{r.policy}</p>
                        {story && <p className="mt-1 text-[11px] text-primary">{story.live ? "Live use case" : "Scenario"} {story.code}: {story.title}</p>}
                      </td>
                      <td className="py-2 pr-3">{s.renewal}</td>
                      <td className="py-2 pr-3"><StatusChip tone={stageTone(s.stage)}>{s.stage}</StatusChip><p className="mt-1 text-[12px] text-muted-foreground">{s.timing}</p></td>
                      <td className="py-2 pr-3"><span className="font-medium text-foreground">{bandLabel(r.band)}</span><p className="text-[12px] text-muted-foreground">{r.language} · {r.autopay === "None" ? "No autopay" : r.autopay}</p>{r.suspense > 0 && <p className="text-[12px] text-muted-foreground">Collect Rs {r.netCollectable.toLocaleString("en-IN")} (Rs {r.suspense.toLocaleString("en-IN")} in suspense)</p>}</td>
                      <td className="py-2 pr-3">{s.workflowId ? <><p className="text-foreground">{WF_NAME[s.workflowId]}</p><p className="text-[12px] text-muted-foreground">{first?.label ?? s.entryNodeId}</p>{ch && <span className="mt-1 inline-block"><StatusChip tone={CHANNEL_TONE[ch]}>{ch}</StatusChip></span>}</> : <span className="text-muted-foreground">Not started</span>}</td>
                      <td className="py-2 pr-3">{sc ? <><p className="text-foreground">{sc.v.name}</p><p className="text-[12px] text-muted-foreground">Chosen for {sc.rule}</p></> : <span className="text-[12px] text-muted-foreground">{s.workflowId ? "No customer contact at this step" : ""}</span>}</td>
                      <td className="py-2 text-[12px] text-subtle"><ul className="list-disc space-y-0.5 pl-4">{s.reasons.map((x) => <li key={x}>{x}</li>)}</ul></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <WordsTable rows={checked.rows} staged={checked.staged} />
        </section>
      )}

      {board.length > 0 && (
        <section className="space-y-3" aria-label="Policies running">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Running from {current?.fileName ?? "uploads"}</h2>
              <p className="text-[12px] text-muted-foreground">Each step runs when you press Run. Live use cases place a real call or WhatsApp and move on when the result comes back; the others play their story.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { clear(); toast("Runs cleared"); }}>Clear runs</Button>
              <Button size="sm" onClick={() => { void stepAll(runnable.map((r) => r.id)); }} disabled={!runnable.length}><PlayCircle /> Run next step for all</Button>
            </div>
          </header>
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-card px-3 py-2 text-[12px]">
            <Radio className={`size-3.5 ${serverLive && liveOn ? "text-healthy" : "text-muted-foreground"}`} aria-hidden />
            {serverLive ? (
              <>
                <span className="text-foreground">{liveOn ? "Live: use cases 1, 2a and 2b place real calls and WhatsApp messages." : "Live calls are off: every step is simulated."}</span>
                <label className="ml-auto flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={liveOn} onChange={(e) => setLiveOn(e.target.checked)} /> Place real calls and messages</label>
              </>
            ) : (
              <span className="text-muted-foreground">Calls and WhatsApp messages are simulated. Set DISPATCH_URL on the server to place real ones for the live use cases.</span>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {board.map((r) => <RunCard key={r.id} run={r} live={isLiveRun(r, { liveOn, serverLive })} reply={replies[r.id] ?? "As the customer would"} onReply={(v) => setReply(r.id, v)} onStep={() => { void step(r.id); }} />)}
          </div>
        </section>
      )}
    </div>
  );
}

/** Side by side: which approved variant each customer gets at the same step. */
function WordsTable({ rows, staged }: { rows: DueRow[]; staged: Staged[] }) {
  const idx = rows.map((_, i) => i).filter((i) => staged[i]!.workflowId);
  if (idx.length < 2) return null;
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div>
        <p className="text-[13px] font-semibold text-foreground">Same step, different words</p>
        <p className="text-[12px] text-muted-foreground">One agent runs each step. The script changes with the customer's propensity band, language and product, from the approved library.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[12px]">
          <thead className="text-muted-foreground">
            <tr><th className="py-1 pr-3 font-medium">Customer</th>{WORD_STEPS.map((w) => <th key={w.id} className="py-1 pr-3 font-medium">{w.label}</th>)}</tr>
          </thead>
          <tbody>
            {idx.map((i) => {
              const r = rows[i]!;
              const s = staged[i]!;
              const g = liveGraph(s.workflowId!);
              return (
                <tr key={r.policy} className="border-t border-border align-top">
                  <td className="py-1.5 pr-3"><p className="text-foreground">{r.name}</p><p className="text-muted-foreground">{bandLabel(r.band)} · {r.language}</p></td>
                  {WORD_STEPS.map((w) => {
                    const onPath = g.nodes.some((n) => n.id === w.id) && !(w.id === "early" && s.bandGroup !== "Low propensity");
                    const sc = onPath ? scriptFor(r, s, w.id) : undefined;
                    return (
                      <td key={w.id} className="py-1.5 pr-3">
                        {sc ? <><p className="text-foreground">{sc.v.name}</p><p className="text-muted-foreground">{sc.rule}</p></> : <span className="text-muted-foreground">{onPath ? "Default wording" : "Not on this journey"}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChannelIcon({ kind }: { kind: LiveEvent["kind"] }) {
  if (kind === "call") return <Phone className="size-3.5 text-primary" aria-label="Call" />;
  if (kind === "whatsapp") return <MessageCircle className="size-3.5 text-healthy" aria-label="WhatsApp" />;
  return <span className="inline-block size-3.5" />;
}

function RunCard({ run, live, reply, onReply, onStep }: { run: RunState; live: boolean; reply: Reply; onReply: (r: Reply) => void; onStep: () => void }) {
  const { setPhone, applyByHand } = useLive();
  const firstContact = !run.events.some((e) => e.kind === "call" || e.kind === "whatsapp" || e.by === "Live dispatch");
  const g = liveGraph(run.graphId);
  const node = g.nodes.find((n) => n.id === run.nodeId);
  const pal = node ? PALETTE_BY_TYPE[node.type] : undefined;
  const st = runStatus(run);
  const last = run.events.filter((e) => e.kind !== "decision" && e.kind !== "file").slice(-5).reverse();
  const ch = node ? channelOf(node.type, node.label) : undefined;
  const isCall = ch === "Call";
  const sc = node ? scriptFor(run.row, run.staged, node.id) : undefined;
  const beat = node ? beatAt(run, node.id, (run.visits[node.id] ?? 0) + 1) : undefined;
  const lastScore = [...run.events].reverse().find((e) => e.kind === "score")?.worth;
  return (
    <article className="panel flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">{run.row.name}</p>
          <p className="text-[12px] text-muted-foreground"><span className="font-mono">{run.row.policy}</span> · {run.row.plan} · Rs {run.row.premium.toLocaleString("en-IN")} {run.row.mode.toLowerCase()} · {bandLabel(run.row.band)} · {run.row.language}</p>
          {run.story && <p className="mt-1 text-[12px] text-primary">{run.story.live ? "Live use case" : "Scenario"} {run.story.code}: {run.story.title}</p>}
        </div>
        {live && <StatusChip tone="ok">Live</StatusChip>}
        <StatusChip tone="neutral">{WF_NAME[run.graphId]}</StatusChip>
        <StatusChip tone={st.tone}>{st.word}</StatusChip>
      </header>
      {live && !run.done && firstContact && (
        <label className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          Call and WhatsApp this number
          <input value={run.row.phone} onChange={(e) => setPhone(run.id, e.target.value.replace(/[^\d+]/g, ""))} className={`${inputCls} h-8 max-w-[180px] font-mono`} aria-label={`Phone for ${run.row.policy}`} />
        </label>
      )}

      {!run.done && node && (
        <div className="rounded-card border border-border bg-surface-translucent p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] text-muted-foreground">{run.waitingCase ? "Waiting at" : "Next step"}</p>
            {ch && ch !== "Step" && <StatusChip tone={CHANNEL_TONE[ch]}>{ch}</StatusChip>}
          </div>
          <p className="text-[13px] font-medium text-foreground">{node.label}</p>
          <p className="text-[12px] text-muted-foreground">{node.config.executor ?? pal?.executor ?? "Platform"}</p>
          {sc && (
            <details className="mt-2 rounded-card border border-border bg-card px-2 py-1.5 text-[12px]">
              <summary className="cursor-pointer"><span className="font-medium text-foreground">Script: {sc.v.name}</span><span className="text-muted-foreground"> · chosen for {sc.rule} · v{sc.v.version}</span></summary>
              <p className="mt-1.5 text-subtle">{wordsFor(run, sc.v.text)}</p>
            </details>
          )}
          {run.live ? (
            <div className="mt-2 space-y-2 text-[12px]">
              <p className="flex items-center gap-2 text-foreground"><Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                {run.live.channel === "Voice" ? `Live call to ${run.live.phone}. The next step runs when the disposition comes back.` : `WhatsApp sent to ${run.live.phone}. The next step runs when the customer pays on the link.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {run.live.channel === "WhatsApp" && <Button size="sm" variant="outline" onClick={() => applyByHand(run.id, "No reply")}>No payment yet: move on</Button>}
                <Button size="sm" variant="outline" onClick={() => applyByHand(run.id)}>Use the scenario answer</Button>
              </div>
            </div>
          ) : run.waitingCase ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <UserRound className="size-4 text-attention" />
              <span>{run.waitingCase.why}</span>
              <Link to="/persistency/queue" className="ml-auto font-medium text-primary hover:underline">Open in manual follow-ups</Link>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isCall && (
                <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  Customer's answer
                  <select value={reply} onChange={(e) => onReply(e.target.value as Reply)} className={selectCls} aria-label={`Customer's answer for ${run.row.policy}`}>
                    {REPLIES.map((x) => <option key={x} value={x}>{x === "As the customer would" && beat ? `Scenario: ${beat}` : x}</option>)}
                  </select>
                </label>
              )}
              {ch === "WhatsApp" && (
                <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  Customer
                  <select value={reply === "Pays now" ? "Pays now" : "As the customer would"} onChange={(e) => onReply(e.target.value as Reply)} className={selectCls} aria-label={`Customer action for ${run.row.policy}`}>
                    <option value="As the customer would">{beat ? `Scenario: ${beat}` : "As the customer would"}</option>
                    <option value="Pays now">Pays now</option>
                  </select>
                </label>
              )}
              <Button size="sm" className="ml-auto" onClick={onStep}>{live && ch && (ch === "Call" || ch === "WhatsApp") && reply === "As the customer would" ? <><Phone /> {ch === "Call" ? "Place the call" : "Send on WhatsApp"}</> : <><Play /> Run</>}</Button>
            </div>
          )}
        </div>
      )}

      {lastScore && (
        <div className="rounded-card border border-border p-3">
          <p className="mb-1 text-[12px] text-muted-foreground">Worth Pursuing Model, latest score</p>
          <WorthCard w={lastScore} compact />
        </div>
      )}

      <ol className="space-y-1.5">
        {last.map((e) => (
          <li key={e.id} className="flex items-start gap-2 text-[12px]">
            <ChannelIcon kind={e.kind} />
            <div className="min-w-0">
              <span className="text-foreground">{e.title}</span>
              {e.status && e.status !== e.title && <span className="text-muted-foreground"> · {e.status}</span>}
              <span className="text-muted-foreground"> · {e.by}</span>
              {e.script && <p className="text-muted-foreground">Script: {e.script.name}</p>}
              {e.recordingUrl && <a href={e.recordingUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Call recording</a>}
              {e.kind === "call" && e.transcript && e.transcript.length > 1 && (
                <details className="mt-0.5">
                  <summary className="cursor-pointer font-medium text-primary">Transcript</summary>
                  <div className="mt-1 space-y-0.5 rounded-card border border-border bg-card p-2">
                    {e.transcript.map((t, i) => <Fragment key={i}><p><span className={`font-medium ${t.who === "Agent" ? "text-primary" : "text-foreground"}`}>{t.who}:</span> {t.text}</p></Fragment>)}
                  </div>
                </details>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex justify-end">
        <Link to="/persistency/runs/$policy" params={{ policy: run.id }} className="text-[12px] font-medium text-primary hover:underline">Open the full trail</Link>
      </div>
    </article>
  );
}
