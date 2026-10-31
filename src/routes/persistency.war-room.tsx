import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/war-room")({
  head: () => ({
    meta: [
      { title: "Month-end war room · Persistency · desible.ai" },
      { name: "description", content: "Collection against plan, run-rate and rule-based reallocations for the last days of the month." },
      { property: "og:title", content: "Month-end war room · Persistency · desible.ai" },
      { property: "og:description", content: "Collection against plan, run-rate and rule-based reallocations for the last days of the month." },
    ],
  }),
  component: WarRoomPage,
});

function WarRoomPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Month-end war room"
      title="Month-end war room"
      step={8}
      tiers={["live-engine", "simulated"]}
      willShow={[
        "Collection vs plan gauge and day-by-day run-rate",
        "Team leaderboard and cohort performance this week",
        "Rule-based recommendations with Approve, Edit or Ignore",
      ]}
    />
  );
}
