import { createFileRoute } from "@tanstack/react-router";
import { dispatchLog, liveConfig } from "@/server-lib/live-store";

/** Whether real calls and messages go out, and the last dispatches, for the board and for debugging. */
export const Route = createFileRoute("/api/live/config")({
  server: {
    handlers: {
      GET: () => {
        const { url } = liveConfig();
        return Response.json({ live: !!url, target: url ? new URL(url).host : null, recent: dispatchLog().slice(-20) });
      },
    },
  },
});
