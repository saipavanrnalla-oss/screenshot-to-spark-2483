import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Circle, Loader2, Play, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ds/primitives";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { StatusChip } from "@/components/r1/status-chip";
import { useWorkflowRows } from "@/components/r1/wf-model";
import { gate } from "@/lib/gate";
import { COHORTS } from "@/components/r1/policy-model";

export const Route = createFileRoute("/persistency/launch")({
  beforeLoad: ({ search }) => gate("launch", search),
  head: () => ({
    meta: [
      { title: "Run a workflow · Persistency · desible.ai" },
      { name: "description", content: "Import a policy list and start a workflow. Each policy is routed by renewal propensity." },
      { property: "og:title", content: "Run a workflow · Persistency · desible.ai" },
      { property: "og:description", content: "Import a policy list and start a workflow. Each policy is routed by renewal propensity." },
    ],
  }),
  component: LaunchPage,
});

const WHATSAPP_COHORTS = ["Highest propensity", "High propensity", "Moderate propensity"];
const REQUIRED = ["policy_number", "customer_name", "phone", "cohort"] as const;
const ENDPOINT_KEY = "pct-launch-endpoint-v1";

const SAMPLE = `policy_number,customer_name,phone,product,premium,cohort
SLI02400901,Customer A,+910000000001,ULIP,48000,Highest propensity
SLI02400902,Customer B,+910000000002,Traditional,36000,Lowest propensity`;

type Outcome = "Pays" | "Wants an explanation";

interface Row {
  id: string;
  policy: string;
  name: string;
  phone: string;
  product: string;
  premium: string;
  cohort: string;
  channel: "WhatsApp" | "Voice call";
  steps: string[];
  done: number;
  outcome?: Outcome;
  sent: "pending" | "sent" | "not set" | "failed";
}

function parseCsv(text: string): { rows: Record<string, string>[]; missing: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], missing: [...REQUIRED] };
  const head = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((r) => !head.includes(r));
  const rows = lines.slice(1).map((l) => {
    const cells = l.split(",").map((c) => c.trim());
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  });
  return { rows, missing };
}

function stepsFor(channel: Row["channel"]): string[] {
  return channel === "WhatsApp"
    ? ["File imported", "Checked: paid, hold, contact policy", "Routed by renewal propensity", "WhatsApp renewal reminder sent", "Waiting for a reply"]
    : ["File imported", "Checked: paid, hold, contact policy", "Routed by renewal propensity", "Early renewal call placed", "Call recorded and classified"];
}

function LaunchPage() {
  const workflows = useWorkflowRows().filter((r) => !r.archived);
  const [code, setCode] = useState("R1");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const timers = useRef<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setEndpoint(localStorage.getItem(ENDPOINT_KEY) ?? "");
    } catch {
      /* storage can be blocked */
    }
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const saveEndpoint = (v: string) => {
    setEndpoint(v);
    try {
      localStorage.setItem(ENDPOINT_KEY, v);
    } catch {
      /* storage can be blocked */
    }
  };

  const advance = (id: string, to: number, extra?: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, done: Math.max(r.done, to), ...extra } : r)));

  const start = async () => {
    const parsed = parseCsv(text);
    if (parsed.missing.length) {
      setProblem(`The file is missing the column${parsed.missing.length > 1 ? "s" : ""} ${parsed.missing.join(", ")}.`);
      return;
    }
    const bad = parsed.rows.filter((r) => !COHORTS.includes(r["cohort"] as never));
    if (!parsed.rows.length || bad.length) {
      setProblem(bad.length ? `Row ${parsed.rows.indexOf(bad[0]!) + 1} has an unknown cohort. Use one of: ${COHORTS.filter((c) => c !== "Unscored").join(", ")}.` : "The file has no rows.");
      return;
    }
    setProblem(null);
    timers.current.forEach((t) => window.clearTimeout(t));
    const built: Row[] = parsed.rows.map((r, i) => {
      const channel: Row["channel"] = WHATSAPP_COHORTS.includes(r["cohort"]!) ? "WhatsApp" : "Voice call";
      return { id: `${Date.now()}-${i}`, policy: r["policy_number"]!, name: r["customer_name"]!, phone: r["phone"]!, product: r["product"] ?? "", premium: r["premium"] ?? "", cohort: r["cohort"]!, channel, steps: stepsFor(channel), done: 0, sent: "pending" };
    });
    setRows(built);

    // Hand the rows to the voice and WhatsApp platform when an endpoint is set.
    let sent: Row["sent"] = "not set";
    if (endpoint.trim()) {
      try {
        const res = await fetch(endpoint.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow: code, rows: built.map((b) => ({ policy_number: b.policy, customer_name: b.name, phone: b.phone, product: b.product, premium: b.premium, cohort: b.cohort, channel: b.channel })) }),
        });
        sent = res.ok ? "sent" : "failed";
      } catch {
        sent = "failed";
      }
    }
    setRows((rs) => rs.map((r) => ({ ...r, sent })));
    if (sent === "failed") toast.error("The platform did not accept the list. Check the address under Connection.");
    else if (sent === "sent") toast.success(`${built.length} ${built.length === 1 ? "policy" : "policies"} sent to the platform`);

    built.forEach((b, i) => {
      b.steps.slice(0, 5).forEach((_, s) => {
        timers.current.push(window.setTimeout(() => advance(b.id, s + 1), 700 * (s + 1) + i * 250));
      });
    });
  };

  const record = (r: Row, outcome: Outcome) => {
    const extra = outcome === "Pays" ? ["Customer agreed to pay", "Payment link sent on WhatsApp", "Waiting for payment"] : ["Customer asked for an explanation", "Product explanation call placed", "Policy details sent on WhatsApp"];
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, outcome, steps: [...x.steps, ...extra] } : x)));
    extra.forEach((_, k) => timers.current.push(window.setTimeout(() => advance(r.id, 5 + k + 1), 700 * (k + 1))));
  };

  const wf = workflows.find((w) => w.code === code);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader title="Run a workflow" meta="Import a list, start the workflow and follow each policy" />
      <section className="panel space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <label className="block text-[12px] font-medium text-muted-foreground">
            Workflow
            <select value={code} onChange={(e) => setCode(e.target.value)} className={`${selectCls} mt-1 w-full`} aria-label="Workflow">
              {workflows.map((w) => (
                <option key={w.code} value={w.code}>{w.name}</option>
              ))}
            </select>
          </label>
          <div className="text-[13px] text-subtle">
            <p className="text-[12px] font-medium text-muted-foreground">Routing</p>
            <p className="mt-1">Highest, high and moderate propensity: WhatsApp renewal reminder with a payment link.</p>
            <p>Low and lowest propensity: early renewal call.</p>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-muted-foreground">Policy list (CSV)</p>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = ""; }} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Upload CSV</Button>
              <Button size="sm" variant="outline" onClick={() => setText(SAMPLE)}>Use sample file</Button>
            </div>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Policy list" placeholder="policy_number,customer_name,phone,product,premium,cohort" className={`${inputCls} mt-2 h-auto py-2 font-mono text-[12px]`} />
          {problem && <p className="mt-1 text-[12px] text-failed">{problem}</p>}
        </div>
        <details className="text-[13px]">
          <summary className="cursor-pointer text-[12px] font-medium text-muted-foreground">Connection</summary>
          <label className="mt-2 block text-[12px] font-medium text-muted-foreground">
            Address that receives the list
            <input value={endpoint} onChange={(e) => saveEndpoint(e.target.value)} placeholder="https://" className={`${inputCls} mt-1`} aria-label="Platform address" />
          </label>
          <p className="mt-1 text-[12px] text-muted-foreground">The list is posted as JSON with the channel chosen for each policy. Leave it empty to run without sending.</p>
        </details>
        <div className="flex justify-end">
          <Button onClick={start} disabled={!text.trim()}><Play /> Start {wf?.name ?? "workflow"}</Button>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="space-y-3" aria-label="Policies in the run">
          {rows.map((r) => (
            <article key={r.id} className="panel p-4">
              <header className="flex flex-wrap items-center gap-3">
                <h2 className="text-[14px] font-semibold text-foreground">{r.name} · {r.policy}</h2>
                <StatusChip tone="neutral">{r.cohort}</StatusChip>
                <StatusChip tone="ok">{r.channel}</StatusChip>
                <span className="text-[12px] text-muted-foreground">{r.product} · {r.phone}</span>
                <span className="ml-auto text-[12px] text-muted-foreground">
                  {r.sent === "sent" ? "Sent to the platform" : r.sent === "failed" ? "Not accepted by the platform" : r.sent === "not set" ? "No address set, not sent" : "Sending"}
                </span>
              </header>
              <ol className="mt-3 space-y-1.5">
                {r.steps.map((s, i) => (
                  <li key={s + i} className={`flex items-center gap-2 text-[13px] ${i < r.done ? "text-foreground" : "text-muted-foreground"}`}>
                    {i < r.done ? <Check className="size-4 text-healthy" /> : i === r.done ? <Loader2 className="size-4 animate-spin text-primary" /> : <Circle className="size-4" />}
                    {s}
                  </li>
                ))}
              </ol>
              {r.channel === "Voice call" && r.done >= 5 && !r.outcome && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-[12px] text-muted-foreground">Call result</span>
                  <Button size="sm" variant="outline" onClick={() => record(r, "Pays")}>Customer will pay</Button>
                  <Button size="sm" variant="outline" onClick={() => record(r, "Wants an explanation")}>Customer wants an explanation</Button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
