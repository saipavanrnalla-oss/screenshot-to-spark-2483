import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept so existing links keep working.
export const Route = createFileRoute("/persistency/guardrails")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/persistency/contact-policy", search });
  },
});
