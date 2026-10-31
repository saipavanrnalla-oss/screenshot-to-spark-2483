import { createFileRoute } from "@tanstack/react-router";
import { BuildStepPlaceholder } from "@/components/persistency/build-step-placeholder";
import { personaById } from "@/config/personas";

export const Route = createFileRoute("/persistency/queues/$persona")({
  head: ({ params }) => {
    const p = personaById(params.persona);
    const title = `${p.landsOn} · ${p.label} · desible.ai`;
    const description = `Work queue for ${p.label}: ${p.panels.join(", ")}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: PersonaQueue,
});

function PersonaQueue() {
  const { persona } = Route.useParams();
  const p = personaById(persona);
  return (
    <BuildStepPlaceholder
      eyebrow={`Work queue · ${p.label}`}
      title={p.landsOn}
      step={7}
      tiers={["live-engine", "live-channels"]}
      willShow={[...p.panels.map((x) => `Panel: ${x}`), `Primary action: ${p.primaryAction}`, "What changed since yesterday"]}
    />
  );
}
