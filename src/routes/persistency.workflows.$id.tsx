import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";
import { workflowById } from "@/data/persistency";

export const Route = createFileRoute("/persistency/workflows/$id")({
  head: ({ params }) => {
    const wf = workflowById(params.id);
    const title = wf ? `${wf.id} ${wf.name} · Workflows · desible.ai` : "Workflow · desible.ai";
    const description = wf ? `${wf.name}: trigger, steps, executor and tier.` : "Persistency workflow detail.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: WorkflowDetail,
});

function WorkflowDetail() {
  const { id } = Route.useParams();
  const wf = workflowById(id);
  return (
    <BuildStepPlaceholder
      eyebrow={`Workflow ${wf?.id ?? id}`}
      title={wf?.name ?? "Unknown workflow"}
      step={6}
      tiers={wf ? [wf.tier] : ["live-engine"]}
      willShow={[wf?.hasCanvas ? "Full workflow canvas with Rule, File, LLM, Human and Stub chips" : "Read-only step list", "Node detail with the configuration each step reads"]}
    />
  );
}
