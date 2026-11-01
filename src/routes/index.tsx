import { createFileRoute, redirect } from "@tanstack/react-router";

// The old entry page lives in components/persistency/hidden/entry-page.tsx for a later version.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Persistency · desible.ai" },
      { name: "description", content: "Policy stages, rules, workflows, agents, data files and reports for persistency teams at Insurers." },
      { property: "og:title", content: "Persistency · desible.ai" },
      { property: "og:description", content: "Policy stages, rules, workflows, agents, data files and reports for persistency teams at Insurers." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
