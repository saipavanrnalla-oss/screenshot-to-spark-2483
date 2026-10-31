import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/cohorts")({
  head: () => ({
    meta: [
      { title: "Cohorts · Persistency · desible.ai" },
      { name: "description", content: "Bring your own cohorts, build them with rules, or start with Desible's starter scorecard, and compare all three on the same policies." },
      { property: "og:title", content: "Cohorts · Persistency · desible.ai" },
      { property: "og:description", content: "Bring your own cohorts, build them with rules, or start with Desible's starter scorecard, and compare all three on the same policies." },
    ],
  }),
  component: CohortsPage,
});

function CohortsPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Cohorts"
      title="Cohorts: bring your own, rules or starter score"
      step={4}
      tiers={["live-engine", "simulated"]}
      willShow={[
        "Bring your own: drop a file, map columns, see A1 to A5 and the Unscored cohort",
        "Rules builder with AND/OR conditions and a live policy count",
        "Desible starter score with visible, editable weights",
        "Compare: agreement matrix, lapse rate by band and drift",
      ]}
    />
  );
}
