import { createFileRoute } from "@tanstack/react-router";
import type { ChannelResult } from "@/engine/live-run";
import { addResult, resultsSince } from "@/server-lib/live-store";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };

/**
 * POST: the voice or WhatsApp platform reports the result of a call or message (and the demo payment
 * page reports a payment). GET: the board polls for results since a time.
 */
export const Route = createFileRoute("/api/live/result")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const b = (await request.json()) as Partial<ChannelResult>;
        if (!b.policy || (b.channel !== "Voice" && b.channel !== "WhatsApp")) {
          return Response.json({ ok: false, error: "policy and channel (Voice or WhatsApp) are required" }, { status: 400, headers: CORS });
        }
        const r: ChannelResult = {
          requestId: b.requestId, policy: b.policy, step: b.step, channel: b.channel,
          disposition: b.disposition, subDisposition: b.subDisposition, transcript: Array.isArray(b.transcript) ? b.transcript : undefined,
          recordingUrl: b.recordingUrl, delivered: b.delivered, read: b.read, paid: b.paid, at: new Date().toISOString(),
        };
        addResult(r);
        return Response.json({ ok: true, at: r.at }, { headers: CORS });
      },
      GET: ({ request }) => {
        const q = new URL(request.url).searchParams;
        return Response.json({ results: resultsSince(q.get("since"), q.get("policy")), now: new Date().toISOString() }, { headers: CORS });
      },
    },
  },
});
