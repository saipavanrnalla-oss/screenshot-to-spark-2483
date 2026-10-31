import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";

export const Route = createFileRoute("/persistency/where-we-sit")({
  head: () => ({
    meta: [
      { title: "Where Desible sits · Persistency · desible.ai" },
      { name: "description", content: "How the control tower sits on top of your existing systems and vendors, file-first." },
      { property: "og:title", content: "Where Desible sits · Persistency · desible.ai" },
      { property: "og:description", content: "How the control tower sits on top of your existing systems and vendors, file-first." },
    ],
  }),
  component: WhereWeSitPage,
});

function WhereWeSitPage() {
  return (
    <BuildStepPlaceholder
      eyebrow="Where Desible sits"
      title="Where Desible sits"
      step={9}
      tiers={["simulated"]}
      willShow={[
        "Your systems, the control tower and executors, with file names and schedules",
        "Vendor coexistence table with Observe, Direct or Replace-in-slice per vendor",
      ]}
    />
  );
}
