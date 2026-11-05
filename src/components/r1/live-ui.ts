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
