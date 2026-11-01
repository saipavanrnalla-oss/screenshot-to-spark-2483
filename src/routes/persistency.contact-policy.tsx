import { createFileRoute } from "@tanstack/react-router";
import { gate } from "@/lib/gate";
import { useMemo } from "react";
import { Lock } from "lucide-react";
import { DataTable, PageHeader, Panel, StatusPill } from "@/components/ds/primitives";
import { KillSwitchControls } from "@/components/persistency/kill-switch";
import { AuditLogTable } from "@/components/persistency/audit-log";
import { useScopedPolicies } from "@/hooks/use-shell";
import { CONDUCT_CHECKS, qaSamples } from "@/data/persistency";
import { useDecisions, usePersistencyStore } from "@/store/persistency";
import { date, dateTime, num, pct } from "@/lib/format";

export const Route = createFileRoute("/persistency/contact-policy")({
  beforeLoad: ({ search }) => gate("contact-policy", search),
  head: () => ({
    meta: [
      { title: "Guardrails · Persistency · desible.ai" },
      { name: "description", content: "Contact rules, approvals, conduct checks, the audit log and the kill switch." },
      { property: "og:title", content: "Guardrails · Persistency · desible.ai" },
      { property: "og:description", content: "Contact rules, approvals, conduct checks, the audit log and the kill switch." },
    ],
  }),
  component: GuardrailsPage,
});

const PROPOSED = "Proposed by Desible, insurer to confirm";
const INSURER = "Insurer rule";

const APPROVALS: [string, string, string][] = [
  ["New or edited rule (renewal, warming, sourcing)", "Head of Persistency", "None"],
  ["Rule touching field visits or team targets", "Regional lead", "Head of Persistency"],
  ["Late-lapse revival terms", "Underwriting", "Head of Persistency"],
  ["Mandate re-presentation and retry batches", "Ops / remittance", "None"],
  ["Late fee waiver up to ₹500", "Team lead", "None"],
  ["Late fee waiver above ₹500", "Head of Persistency", "Compliance"],
  ["Guardrail change", "Compliance", "Head of Persistency"],
  ["Kill switch (global or per workflow)", "Compliance or Head of Persistency", "Logged, no second approver"],
  ["Vendor mode change (Observe, Direct, Replace-in-slice)", "Head of Persistency", "CXO"],
  ["Cohort set used for decisions", "Head of Persistency", "MIS / analytics"],
];

function GuardrailsPage() {
  const { scoped } = useScopedPolicies();
  const decisions = useDecisions(scoped);
  const rules = usePersistencyStore((s) => s.rules);
  const guardrails = rules.filter((r) => r.level === "guardrail");
  const qa = useMemo(() => qaSamples(scoped), [scoped]);

  const counts = useMemo(() => {
    const byRule = new Map<string, number>();
    for (const d of decisions.values()) if (d.level === "guardrail") byRule.set(d.ruleId, (byRule.get(d.ruleId) ?? 0) + 1);
    const dnd = scoped.filter((p) => p.state === "Do-not-contact").length;
    const twoWeek = scoped.filter((p) => p.touchesLast30d >= 3 && p.lastTouch && p.lastTouch >= "2026-10-22").length;
    return { byRule, dnd, twoWeek };
  }, [decisions, scoped]);

  const contact: { rule: string; value: string; source: string; now: string }[] = [
    { rule: "Max touches per customer per week", value: "2 across all channels and vendors", source: PROPOSED, now: `${num(counts.twoWeek)} customers had 3 or more touches since 22 Oct` },
    { rule: "Max touches per customer in 30 days", value: "8, then hold (G2)", source: PROPOSED, now: `${num(counts.byRule.get("G2") ?? 0)} held today` },
    { rule: "Call window", value: "09:00 to 19:00 IST, Monday to Saturday", source: INSURER, now: "Checked before every call" },
    { rule: "DND scrub", value: "Every number checked against the DND list before dialling", source: INSURER, now: `${num(counts.dnd)} customers on do-not-contact` },
    { rule: "WhatsApp consent", value: "WhatsApp only to customers who opted in", source: INSURER, now: "Opt-in flag read from due_list" },
    { rule: "Language match", value: "Script and agent in the customer's recorded language", source: PROPOSED, now: `${qa.filter((q) => !q.results["Language matches customer"]).length} of ${qa.length} sampled calls mismatched` },
    { rule: "Free-look", value: "No renewal or payment content while free-look is open (G3)", source: INSURER, now: `${num(counts.byRule.get("G3") ?? 0)} policies in free-look` },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader eyebrow="Guardrails" title="Guardrails and audit" description="Guardrails always win over every other rule. Proposed values wait for the insurer to confirm them." tiers={["live-engine"]} />

      <Panel eyebrow="Kill switch" title="Stop the engine acting" tiers={["live-engine"]}>
        <KillSwitchControls />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel eyebrow="Contact policy" title="Who can be contacted, how often and when" tiers={["live-engine"]}>
          <DataTable head={["Rule", "Value", "Source", "Today"]} minWidth={720}>
            {contact.map((c) => (
              <tr key={c.rule}>
                <td className="font-semibold text-foreground">{c.rule}</td>
                <td className="text-subtle">{c.value}</td>
                <td>{c.source === INSURER ? <StatusPill status="healthy">Insurer rule</StatusPill> : <StatusPill status="attention">{PROPOSED}</StatusPill>}</td>
                <td className="text-subtle">{c.now}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel eyebrow="Locked guardrails" title={`${guardrails.length} guardrails`} tiers={["live-engine"]}>
          <ul className="space-y-2">
            {guardrails.map((g) => (
              <li key={g.id} className="rounded-input border border-border bg-surface-translucent p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-foreground"><Lock className="mr-1 inline size-3 text-muted-foreground" /><span className="mr-1.5 text-primary">{g.id}</span>{g.name}</p>
                  <span className="text-xs font-semibold text-foreground tabular">{num(counts.byRule.get(g.id) ?? 0)}</span>
                </div>
                <p className="mt-1 text-xs text-subtle">{g.then.action}{g.then.contactRule ? `. ${g.then.contactRule}` : ""}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {g.source === INSURER ? <StatusPill status="healthy">Insurer rule</StatusPill> : <StatusPill status="attention">{PROPOSED}</StatusPill>}
                  Effective {date(g.effectiveFrom)} · owner {g.needsApprovalFrom}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-dim">Number on the right: policies this guardrail decided today.</p>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Approvals matrix" title="Who approves what" tiers={["live-engine"]}>
          <DataTable head={["Change", "Approver", "Second approver"]} minWidth={520}>
            {APPROVALS.map(([c, a, b]) => (
              <tr key={c}>
                <td className="text-foreground">{c}</td>
                <td className="font-semibold text-subtle">{a}</td>
                <td className="text-subtle">{b}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel eyebrow="Conduct checks" title="Call QA sample" tiers={["simulated"]}>
          <ul className="space-y-1.5">
            {CONDUCT_CHECKS.map((c) => {
              const pass = qa.filter((q) => q.results[c]).length;
              return (
                <li key={c} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground">{c}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-subtle tabular">{pass} of {qa.length} pass ({pct(pass / Math.max(qa.length, 1), 0)})</span>
                    {pass === qa.length ? <StatusPill status="healthy">Pass</StatusPill> : <StatusPill status="failed">{qa.length - pass} fail</StatusPill>}
                  </span>
                </li>
              );
            })}
          </ul>
          <DataTable head={["Sample", "Policy", "When", "Executor", "Result"]} minWidth={520} maxHeight={220} className="mt-4">
            {qa.filter((q) => CONDUCT_CHECKS.some((c) => !q.results[c])).concat(qa.filter((q) => CONDUCT_CHECKS.every((c) => q.results[c])).slice(0, 4)).map((q) => (
              <tr key={q.id}>
                <td className="text-muted-foreground tabular">{q.id}</td>
                <td className="font-semibold text-foreground tabular">{q.policyId}</td>
                <td className="text-subtle tabular">{dateTime(q.at)}</td>
                <td className="text-subtle">{q.executor}</td>
                <td className="text-subtle">{q.note}</td>
              </tr>
            ))}
          </DataTable>
          <p className="mt-2 text-[11px] text-dim">Samples are drawn from vendor call recordings. Recordings and scoring are simulated in this build.</p>
        </Panel>
      </div>

      <Panel eyebrow="Audit log" title="Every decision and change" tiers={["live-engine"]}>
        <AuditLogTable maxHeight={480} />
      </Panel>
    </div>
  );
}
