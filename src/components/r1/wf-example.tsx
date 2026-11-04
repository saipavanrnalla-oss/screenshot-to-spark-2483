import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ds/primitives";
import { StatusChip, type Tone } from "./status-chip";
import { selectCls } from "./tabs";
import type { WfGraph } from "@/data/persistency/r1/wf";
import { BASE_POLICIES, POLICY_INDEX, type Policy } from "@/data/persistency";
import { EXAMPLE_BEHAVIOURS, walkPolicy, type ExampleBehaviour, type WalkResult } from "@/engine/walk";

const tone = (state: string): Tone => (state === "Renewed" || state === "Renewed in the Grace Period" || state === "Revived" ? "ok" : state === "Closed with reason" ? "risk" : "neutral");

/** One policy per end state where the pool has them, so a sample shows every way the workflow can finish. */
export function variedSample(graph: WfGraph, pool: Policy[]): string[] {
  const seen = new Map<string, string>();
  const src = pool.length ? pool : BASE_POLICIES;
  for (const p of src.slice(0, 600)) {
    const w = walkPolicy(graph, p);
    if (w.complete && !seen.has(w.endState)) seen.set(w.endState, p.policyId);
    if (seen.size >= 4) break;
  }
  const ids = [...seen.values()];
  for (const p of src) {
    if (ids.length >= 6) break;
    if (!ids.includes(p.policyId)) ids.push(p.policyId);
  }
  return ids;
}

export function parsePolicyIds(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((t) => t.trim().replace(/^"|"$/g, "")).filter((t) => /^[A-Za-z0-9-]{5,}$/.test(t)))];
}

/** Run an example: paste or upload policy numbers, see the path each one takes and the one end state it reaches. */
export function ExampleRun({
  graph,
  suggested,
  onPath,
  onClose,
}: {
  graph: WfGraph;
  suggested: Policy[];
  onPath: (path: string[], active: string | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [behaviour, setBehaviour] = useState<ExampleBehaviour>("Follow the policy");
  const [results, setResults] = useState<WalkResult[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(
    () => () => {
      clear();
      onPath([], null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const show = (r: WalkResult) => {
    clear();
    setPicked(r.policyId);
    const ids = r.steps.map((s) => s.nodeId);
    const step = (i: number) => {
      onPath(ids.slice(0, i + 1), ids[i] ?? null);
      if (i < ids.length - 1) timer.current = setTimeout(() => step(i + 1), 450);
    };
    step(0);
  };

  const run = () => {
    const ids = parsePolicyIds(text);
    if (!ids.length) return void toast.error("Paste at least one policy number.");
    const found: Policy[] = [];
    const missing: string[] = [];
    for (const id of ids.slice(0, 200)) {
      const i = POLICY_INDEX.get(id);
      if (i === undefined) missing.push(id);
      else found.push(BASE_POLICIES[i]!);
    }
    setUnknown(missing);
    const out = found.map((p) => walkPolicy(graph, p, behaviour));
    setResults(out);
    if (out[0]) show(out[0]);
    else onPath([], null);
    if (out.length) toast.success(`${out.length} ${out.length === 1 ? "policy" : "policies"} ran through the workflow`);
  };

  const summary = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of results) m.set(r.endState, (m.get(r.endState) ?? 0) + 1);
    return [...m.entries()];
  }, [results]);
  const current = results.find((r) => r.policyId === picked);

  return (
    <Panel
      title="Run an example"
      actions={
        <Button size="icon" variant="ghost" className="size-7" aria-label="Close example run" onClick={onClose}>
          <X />
        </Button>
      }
    >
      <div className="space-y-3 text-[13px]">
        <p className="text-subtle">Paste policy numbers or upload a file. Each policy walks the workflow and stops at exactly one end state.</p>
        <textarea
          aria-label="Policy numbers"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="One policy number per line, or separated by commas"
          className="w-full rounded-input border border-border bg-card px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={file}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setText(await f.text());
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => file.current?.click()}><Upload /> Upload file</Button>
          <Button size="sm" variant="outline" disabled={!suggested.length} onClick={() => setText(variedSample(graph, suggested).join("\n"))}>Use a sample of policies</Button>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
            Customer
            <select aria-label="What the customer does" value={behaviour} onChange={(e) => setBehaviour(e.target.value as ExampleBehaviour)} className={selectCls}>
              {EXAMPLE_BEHAVIOURS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <Button size="sm" onClick={run}><Play /> Run</Button>
        </div>
        {unknown.length > 0 && <p className="text-[12px] text-destructive">Not found: {unknown.slice(0, 6).join(", ")}{unknown.length > 6 ? ` and ${unknown.length - 6} more` : ""}</p>}
        {results.length > 0 && (
          <div className="space-y-2">
            <ul className="flex flex-wrap gap-1.5" aria-label="End states">
              {summary.map(([state, n]) => <li key={state}><StatusChip tone={tone(state)}>{state} · {n}</StatusChip></li>)}
            </ul>
            <div className="max-h-56 overflow-y-auto rounded-card border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-card text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                  <tr><th className="px-3 py-1.5 font-medium">Policy</th><th className="px-3 py-1.5 font-medium">Steps</th><th className="px-3 py-1.5 font-medium">Ended at</th></tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.policyId} onClick={() => show(r)} className={`cursor-pointer border-t border-border/60 hover:bg-brand-tint ${picked === r.policyId ? "bg-brand-tint" : ""}`}>
                      <td className="px-3 py-1.5 tabular text-primary">{r.policyId}</td>
                      <td className="px-3 py-1.5 tabular">{r.steps.length}</td>
                      <td className="px-3 py-1.5"><StatusChip tone={tone(r.endState)}>{r.endState}</StatusChip>{r.reason && r.endState === "Closed with reason" ? <span className="ml-2 text-[12px] text-muted-foreground">{r.reason}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {current && (
              <ol className="max-h-64 space-y-0.5 overflow-y-auto text-[12px]" aria-label={`Path for ${current.policyId}`}>
                {current.steps.map((s, i) => (
                  <li key={`${s.nodeId}-${i}`} className="flex gap-2">
                    <span className="w-5 shrink-0 text-right text-muted-foreground tabular">{i + 1}</span>
                    <span className="flex-1">{s.label}</span>
                    <span className="text-muted-foreground">{s.who}</span>
                    <span className="w-40 shrink-0 text-right">{s.result}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
