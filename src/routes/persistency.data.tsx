import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/data")({
  head: () => ({
    meta: [
      { title: "Data and integrations · Persistency · desible.ai" },
      { name: "description", content: "File adapters, freshness, rejects and paid-meanwhile suppression for the persistency engine." },
      { property: "og:title", content: "Data and integrations · Persistency · desible.ai" },
      { property: "og:description", content: "File adapters, freshness, rejects and paid-meanwhile suppression for the persistency engine." },
    ],
  }),
  component: DataPage,
});

function DataPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Data and integrations"
      title="Data and integrations"
      step={9}
      tiers={["simulated"]}
      willShow={[
        "File adapters with schedule, rows, rejects and freshness",
        "Sample file viewer and column mapper",
        "Paid-meanwhile panel",
      ]}
    />
  );
}
