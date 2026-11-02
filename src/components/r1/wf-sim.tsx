import { useEffect, useMemo, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ds/primitives";
import { StatusChip } from "./status-chip";
import { selectCls } from "./tabs";
import { SCENARIOS, type Scenario, type WfGraph } from "@/data/persistency/r1/wf";
import { simulate, type SimResult } from "@/engine/workflow";
import type { Policy } from "@/data/persistency";
import type { SimRun } from "@/data/persistency/r1/types";

const TEST_POLICIES = ["TEST-0001 (test policy)", "TEST-0002 (test policy)"];

/** Plays a graph node by node, 700 to 900 ms apart, and reports Pass or Fail. */
export function SimConsole({ graph, policies, by, onActive, onStored, onClose }: { graph: WfGraph; policies: Policy[]; by: string; onActive: (id: string | null) => void; onStored: (run: SimRun) => void; onClose: () => void }) {
  const options = useMemo(() => [...policies.slice(0, 12).map((p) => p.policyId), ...TEST_POLICIES], [policies]);
  const [policy, setPolicy] = useState(options[0] ?? TEST_POLICIES[0]!);
  const [scenario, setScenario] = useState<Scenario>("Promises a date");
  const [result, setResult] = useState<SimResult | null>(null);
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      onActive(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const run = () => {
    if (timer.current) clearTimeout(timer.current);
    const r = simulate(graph, scenario);
    setResult(r);
    setShown(0);
    setRunning(true);
    const step = (i: number) => {
      if (i >= r.steps.length) {
        setRunning(false);
        onActive(null);
        const stored: SimRun = { id: `SIM-${Date.now().toString(36)}`, at: new Date().toISOString(), by, policyId: policy.split(" ")[0]!, scenario, result: r.result, reason: r.reason, steps: r.steps.length };
        onStored(stored);
        toast[r.result === "Pass" ? "success" : "error"](`Simulation ${r.result === "Pass" ? "passed" : "failed"} in ${r.steps.length} steps`, r.reason ? { description: r.reason } : undefined);
        return;
      }
      setShown(i + 1);
      onActive(r.steps[i]!.nodeId);
      timer.current = setTimeout(() => step(i + 1), 700 + ((i * 97) % 200));
    };
    step(0);
  };

  return (
    <Panel
      title="Simulation"
      actions={
        <Button size="icon" variant="ghost" className="size-7" aria-label="Close simulation" onClick={onClose}>
          <X />
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12px] font-medium text-muted-foreground">
          Policy
          <select value={policy} onChange={(e) => setPolicy(e.target.value)} className={`${selectCls} mt-1 block`} aria-label="Policy">
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-medium text-muted-foreground">
          Scenario
          <select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)} className={`${selectCls} mt-1 block`} aria-label="Scenario">
            {SCENARIOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <Button size="sm" onClick={run} disabled={running}>
          <Play /> {running ? "Running" : "Run"}
        </Button>
        {result && !running && <StatusChip tone={result.result === "Pass" ? "ok" : "risk"}>{result.result}</StatusChip>}
        {result && !running && result.reason && <span className="text-[12px] text-subtle">{result.reason}</span>}
      </div>
      {result && (
        <table className="mt-3 w-full text-[12px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              <th className="py-1 pr-2">#</th>
              <th className="pr-2">Step</th>
              <th className="pr-2">Executor</th>
              <th className="pr-2">Disposition</th>
              <th className="pr-2">Edge taken</th>
              <th className="pr-2">Guardrail checks</th>
              <th className="text-right">Elapsed</th>
            </tr>
          </thead>
          <tbody>
            {result.steps.slice(0, shown).map((s, i) => (
              <tr key={i} className="border-t border-border/60 align-top">
                <td className="py-1 pr-2 tabular">{i + 1}</td>
                <td className="pr-2 text-foreground">{s.label}</td>
                <td className="pr-2">{s.executor}</td>
                <td className="pr-2">{s.disposition || "None"}</td>
                <td className="pr-2">{s.edge}</td>
                <td className="pr-2">{s.checks.length ? "Paid, hold, contact: clear" : "None needed"}{s.breach ? ` · Breach: ${s.breach}` : ""}</td>
                <td className="text-right tabular">{(s.elapsedMs / 1000).toFixed(1)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
