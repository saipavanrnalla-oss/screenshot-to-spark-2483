import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept so existing links keep working.
export const Route = createFileRoute("/persistency/where-we-sit")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/persistency/where-desible-sits", search });
  },
});
