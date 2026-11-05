import type { Tone } from "@/components/r1/status-chip";
import type { RunState } from "@/engine/live-run";

export const WF_NAME = { R1: "13th Month Persistency", R8: "25th Month Persistency" } as const;

export function stageTone(s: string): Tone {
  if (s === "Renewal window" || s === "Before the window") return "ok";
  if (s === "Grace Period") return "risk";
  if (s === "Early lapse" || s === "Late lapse") return "off";
  return "neutral";
}

export function runStatus(r: RunState): { word: string; tone: Tone } {
  if (r.done) return { word: r.endState ?? "Ended", tone: r.endState?.startsWith("Renewed") || r.endState === "Revived" ? "ok" : "off" };
  if (r.waitingCase) return { word: `With ${r.waitingCase.team}`, tone: "risk" };
  return { word: "Running", tone: "accent" };
}

export type Channel = "Call" | "WhatsApp" | "Brief" | "Score" | "Vendor" | "Wait" | "Person" | "Step";

/** The channel a workflow step uses, in the words shown on the board. */
export function channelOf(type: string, label: string): Channel {
  if (type === "agent.voice" || (type === "agent.payment" && /call/i.test(label))) return "Call";
  if (type === "agent.message" || type === "agent.payment") return "WhatsApp";
  if (type === "agent.summariser") return "Brief";
  if (type === "agent.score") return "Score";
  if (type.startsWith("vendor.")) return "Vendor";
  if (type.startsWith("wait.")) return "Wait";
  if (type.startsWith("people.")) return "Person";
  return "Step";
}

export const CHANNEL_TONE: Record<Channel, Tone> = { Call: "accent", WhatsApp: "ok", Brief: "neutral", Score: "risk", Vendor: "off", Wait: "neutral", Person: "risk", Step: "neutral" };
