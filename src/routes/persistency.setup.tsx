import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/setup")({
  head: () => ({
    meta: [
      { title: "Setup · Persistency · desible.ai" },
      { name: "description", content: "Insurer profile, grace rules, station calendar, cohort source per product and vendor modes." },
      { property: "og:title", content: "Setup · Persistency · desible.ai" },
      { property: "og:description", content: "Insurer profile, grace rules, station calendar, cohort source per product and vendor modes." },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Setup"
      title="Setup"
      step={9}
      tiers={["live-engine"]}
      willShow={[
        "Insurer profile, grace rules and station calendar",
        "Cohort source per product, vendor modes and personas",
        "Load sample insurer",
      ]}
    />
  );
}
