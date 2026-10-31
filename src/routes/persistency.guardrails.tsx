import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/guardrails")({
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

function GuardrailsPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Guardrails"
      title="Guardrails and audit"
      step={8}
      tiers={["live-engine"]}
      willShow={[
        "Contact policy, call windows, DND and consent checks",
        "Approvals matrix and searchable audit log",
        "Global and per-workflow kill switch",
      ]}
    />
  );
}
