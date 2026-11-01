import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/ds/primitives";
import { PersonaHome } from "@/components/persistency/persona-home";
import { PERSONAS, panelTitles } from "@/config/personas";

export const Route = createFileRoute("/persistency/work/$persona")({
  head: ({ params }) => {
    const p = PERSONAS.find((x) => x.id === params.persona);
    const title = p ? `${p.landsOn} · ${p.label} · desible.ai` : "Work queue · desible.ai";
    const description = p ? `Work queue for ${p.label}: ${panelTitles(p).join(", ")}.` : "Persistency work queue.";
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
  const p = PERSONAS.find((x) => x.id === persona);
  if (!p) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4">
        <PageHeader eyebrow="Work queues" title="No such work queue" tiers={["live-engine"]} />
        <EmptyState title={`There is no persona called "${persona}".`} action={<Link to="/persistency" className="text-xs font-semibold text-primary hover:underline">Back to the Control Tower</Link>} />
      </div>
    );
  }
  return <PersonaHome key={p.id} persona={p} />;
}
