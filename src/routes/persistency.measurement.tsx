import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/measurement")({
  head: () => ({
    meta: [
      { title: "Measurement · Persistency · desible.ai" },
      { name: "description", content: "Premium-weighted persistency, collection funnel and the proof method behind any claimed uplift." },
      { property: "og:title", content: "Measurement · Persistency · desible.ai" },
      { property: "og:description", content: "Premium-weighted persistency, collection funnel and the proof method behind any claimed uplift." },
    ],
  }),
  component: MeasurementPage,
});

function MeasurementPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Measurement"
      title="Measurement and proof"
      step={8}
      tiers={["live-engine", "simulated"]}
      willShow={[
        "Premium-weighted persistency 13M to 61M with the mode rule",
        "Collection, run-rate, funnel and cost per rupee collected",
        "Proof method selector; no uplift claimed until one is agreed",
      ]}
    />
  );
}
