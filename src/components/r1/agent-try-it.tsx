import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/r1/status-chip";
import { inputCls } from "@/components/r1/tabs";
import { CLASSIFIER_EXAMPLES, classifyReason, summariseHandoff, type HandoffPacket, type ReasonResult } from "@/engine/agent-try";

export const TRY_IT_AGENTS = ["reason-classifier", "handoff-summariser"] as const;

/** Paste a customer line or a call, see exactly what the agent returns. */
export function AgentTryIt({ id }: { id: string }) {
  const isClassifier = id === "reason-classifier";
  const [text, setText] = useState(CLASSIFIER_EXAMPLES[0]!);
  const [res, setRes] = useState<ReasonResult | HandoffPacket | null>(null);
  const run = () =>
    setRes(isClassifier ? classifyReason(text) : summariseHandoff(text, { name: "Sunil Kapoor", policy: "SLI02409101", premium: "Rs 36,000", due: "14 Jan 2027", stage: "Renewal window, T-78", attempts: 2 }));
  return (
    <section className="panel space-y-3 p-4" aria-label="Try the agent">
      <header>
        <h2 className="text-[14px] font-semibold text-foreground">Try it with any words</h2>
        <p className="text-[12px] text-muted-foreground">{isClassifier ? "Paste what the customer said. The agent returns the disposition, the reason for not paying, how sure it is, and the next step." : "Paste a call. The agent writes the six-field packet a person reads before they call the customer back."}</p>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {CLASSIFIER_EXAMPLES.map((e, i) => (
          <button key={i} type="button" onClick={() => { setText(e); setRes(null); }} className="rounded-pill border border-border px-2 py-0.5 text-[12px] text-muted-foreground hover:border-primary hover:text-primary">Example {i + 1}</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} rows={4} aria-label="Agent input" className={`${inputCls} h-auto py-2`} />
      <div className="flex justify-end"><Button size="sm" onClick={run} disabled={!text.trim()}><Sparkles /> Run the agent</Button></div>
      {res && "reason" in res && "confidence" in res && (
        <div className="grid gap-3 rounded-card border border-border bg-surface-translucent p-3 text-[13px] md:grid-cols-2">
          <Field label="Disposition">{res.disposition} · {res.subDisposition}</Field>
          <Field label="Reason for not paying"><span className="font-medium">{res.reason}</span> <StatusChip tone={res.confidence >= 0.75 ? "ok" : res.confidence >= 0.6 ? "risk" : "off"}>{Math.round(res.confidence * 100)}% sure</StatusChip></Field>
          <Field label="Words it heard">{res.evidence.length ? res.evidence.map((e) => `"${e}"`).join(", ") : "None that match a reason"}</Field>
          <Field label="Stop calling">{res.stopCalling ? "Yes, hand to a person" : "No"}</Field>
          <div className="md:col-span-2"><Field label="Next step">{res.nextStep}</Field></div>
        </div>
      )}
      {res && "who" in res && (
        <dl className="grid gap-2 rounded-card border border-border bg-surface-translucent p-3 text-[13px] md:grid-cols-[180px_1fr]">
          {([["Who", res.who], ["Policy", res.policy], ["What happened", res.whatHappened], ["Customer said", res.customerSaid], ["Reason and intent", res.reasonAndIntent], ["Recommended next step", res.recommended], ["Do not", res.doNot]] as const).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-[12px] text-muted-foreground">{k}</dt><dd className="text-foreground">{v}</dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
