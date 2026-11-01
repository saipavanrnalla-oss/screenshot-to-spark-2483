import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept so existing links keep working.
export const Route = createFileRoute("/persistency/queues/$persona")({
  beforeLoad: ({ search, params }) => {
    throw redirect({ to: "/persistency/work/$persona", params: { persona: params.persona }, search });
  },
});
