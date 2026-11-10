import { createFileRoute } from "@tanstack/react-router";
import { liveConfig, logDispatch } from "@/server-lib/live-store";

/**
 * The board posts each live call or WhatsApp here; the server forwards it to DISPATCH_URL so the
 * platform address and token never reach the browser. With no DISPATCH_URL nothing is sent.
 */
export const Route = createFileRoute("/api/live/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const requestId = typeof body["requestId"] === "string" ? body["requestId"] : crypto.randomUUID();
        const origin = new URL(request.url).origin;
        const payload = { ...body, requestId, callbackUrl: `${origin}/api/live/result` };
        const { url, token } = liveConfig();
        const at = new Date().toISOString();
        const base = { requestId, policy: String(body["policy"] ?? ""), step: String(body["step"] ?? ""), channel: String(body["channel"] ?? ""), at };
        if (!url) {
          logDispatch({ ...base, forwarded: false });
          return Response.json({ requestId, forwarded: false, reason: "DISPATCH_URL is not set" });
        }
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(payload),
          });
          logDispatch({ ...base, forwarded: res.ok, status: res.status });
          return Response.json({ requestId, forwarded: res.ok, status: res.status });
        } catch (e) {
          logDispatch({ ...base, forwarded: false });
          return Response.json({ requestId, forwarded: false, reason: e instanceof Error ? e.message : "Dispatch failed" }, { status: 502 });
        }
      },
    },
  },
});
