/**
 * In-memory store for the live demo: results the voice and WhatsApp platform sends back, and payments
 * made on the demo payment page. One server process holds them (see docs/dispatch-contract.md, Hosting).
 * Results older than a day are dropped.
 */
import type { ChannelResult } from "@/engine/live-run";

interface Store {
  results: ChannelResult[];
  dispatched: { requestId: string; policy: string; step: string; channel: string; at: string; forwarded: boolean; status?: number | undefined }[];
}

const g = globalThis as unknown as { __pctLive?: Store };
const store: Store = (g.__pctLive ??= { results: [], dispatched: [] });

const DAY = 86_400_000;

export function addResult(r: ChannelResult): void {
  const cutoff = Date.now() - DAY;
  store.results = [...store.results.filter((x) => Date.parse(x.at) > cutoff), r];
}

export function resultsSince(since: string | null, policy: string | null): ChannelResult[] {
  const t = since ? Date.parse(since) : 0;
  return store.results.filter((r) => Date.parse(r.at) > t && (!policy || r.policy === policy));
}

export function logDispatch(d: Store["dispatched"][number]): void {
  store.dispatched = [...store.dispatched.slice(-199), d];
}

export function dispatchLog(): Store["dispatched"] {
  return store.dispatched;
}

/** Server-side settings. DISPATCH_URL receives each call or WhatsApp; DISPATCH_TOKEN is sent as a bearer token. */
export function liveConfig(): { url: string; token: string } {
  const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return { url: env["DISPATCH_URL"] ?? "", token: env["DISPATCH_TOKEN"] ?? "" };
}
