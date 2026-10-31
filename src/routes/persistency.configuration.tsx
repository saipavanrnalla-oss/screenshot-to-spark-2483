import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/configuration")({
  head: () => ({
    meta: [
      { title: "Configuration · Persistency · desible.ai" },
      { name: "description", content: "Configure every rule by product, policy year, payment mode, channel, cohort and more, with precedence and conflicts visible." },
      { property: "og:title", content: "Configuration · Persistency · desible.ai" },
      { property: "og:description", content: "Configure every rule by product, policy year, payment mode, channel, cohort and more, with precedence and conflicts visible." },
    ],
  }),
  component: ConfigurationPage,
});

function ConfigurationPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Configuration"
      title="The dimension console"
      step={5}
      tiers={["live-engine"]}
      willShow={[
        "Rule list by stage, rule editor with 17 dimensions and 9 settings",
        "Who this affects, live count and conflict check",
        "Precedence explainer and product by stage matrix",
      ]}
    />
  );
}
