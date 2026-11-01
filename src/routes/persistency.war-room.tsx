import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept so existing links keep working.
export const Route = createFileRoute("/persistency/war-room")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/persistency/collections", search });
  },
});
