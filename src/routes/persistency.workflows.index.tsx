import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/workflows/")({
  head: () => ({
    meta: [
      { title: "Workflows · Persistency · desible.ai" },
      { name: "description", content: "Eighteen persistency workflows from sourcing to revival, with the executor and tier of every step." },
      { property: "og:title", content: "Workflows · Persistency · desible.ai" },
      { property: "og:description", content: "Eighteen persistency workflows from sourcing to revival, with the executor and tier of every step." },
    ],
  }),
  component: WorkflowsPage,
});

function WorkflowsPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Workflows"
      title="18 workflows"
      step={6}
      tiers={["live-engine", "live-channels", "simulated"]}
      willShow={[
        "Library of 18 workflows grouped by stage",
        "Products, trigger, executor, tier, last run and policies in each",
        "Full canvases for W1, R2, R4, L2, L3 and X1",
      ]}
    />
  );
}
