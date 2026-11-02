import { AGENTS } from "@/data/persistency";
import type { AgentConfig } from "@/data/persistency/r1/agents";
import type { Version } from "@/data/persistency/r1/types";
import { seedVersions } from "@/store/work";

export function agentVersions(saved: Record<string, Version<unknown>[]>, id: string): Version<AgentConfig>[] {
  return (saved[`agent:${id}`] ?? seedVersions(`agent:${id}`)) as Version<AgentConfig>[];
}

export function agentDef(id: string) {
  return AGENTS.find((a) => a.id === id);
}

/** Plain-language list of what changed between two agent configurations. */
export function agentDiff(a: AgentConfig | undefined, b: AgentConfig): string[] {
  if (!a) return ["First version"];
  const out: string[] = [];
  if (a.instructions !== b.instructions) out.push("Instructions changed");
  for (const sb of b.scripts) {
    const sa = a.scripts.find((x) => x.product === sb.product && x.language === sb.language);
    if (!sa) {
      out.push(`Script added: ${sb.product} ${sb.language}`);
      continue;
    }
    for (const f of ["opening", "identity", "body", "closing"] as const) if (sa[f] !== sb[f]) out.push(`Script ${sb.product} ${sb.language}: ${f} line changed`);
    for (const ob of sb.objections) {
      const oa = sa.objections.find((x) => x.q === ob.q);
      if (!oa) out.push(`Script ${sb.product} ${sb.language}: objection added "${ob.q}"`);
      else if (oa.a !== ob.a) out.push(`Script ${sb.product} ${sb.language}: response to "${ob.q}" changed`);
    }
    for (const oa of sa.objections) if (!sb.objections.some((x) => x.q === oa.q)) out.push(`Script ${sb.product} ${sb.language}: objection removed "${oa.q}"`);
  }
  for (const tb of b.templates) {
    const ta = a.templates.find((x) => x.id === tb.id);
    if (!ta) out.push(`Template added: ${tb.name} (${tb.language})`);
    else if (ta.text !== tb.text) out.push(`Template "${tb.name}" (${tb.language}) text changed`);
  }
  for (const k of Object.keys(b.tools) as (keyof AgentConfig["tools"])[]) if (a.tools[k] !== b.tools[k]) out.push(`Tool ${k}: ${b.tools[k] ? "on" : "off"}`);
  const offA = a.offers.map((o) => `${o.name}${o.needsApproval ? " (needs approval)" : ""}`).join(", ");
  const offB = b.offers.map((o) => `${o.name}${o.needsApproval ? " (needs approval)" : ""}`).join(", ");
  if (offA !== offB) out.push(`Offers: ${offA} → ${offB}`);
  if (a.languages.join() !== b.languages.join()) out.push(`Languages: ${b.languages.join(", ")}`);
  if (a.transferLanguage !== b.transferLanguage) out.push(`Transfer language: ${a.transferLanguage} → ${b.transferLanguage}`);
  if (a.windowStart !== b.windowStart || a.windowEnd !== b.windowEnd) out.push(`Window: ${a.windowStart}-${a.windowEnd} → ${b.windowStart}-${b.windowEnd}`);
  for (const k of ["window", "grace", "lapse"] as const) if (a.attempts[k] !== b.attempts[k]) out.push(`Attempts in ${k}: ${a.attempts[k]} → ${b.attempts[k]}`);
  if (a.gapDays !== b.gapDays) out.push(`Gap between attempts: ${a.gapDays} → ${b.gapDays} days`);
  for (const k of Object.keys(b.routes) as (keyof AgentConfig["routes"])[]) if (a.routes[k] !== b.routes[k]) out.push(`Route for "${k}": ${a.routes[k]} → ${b.routes[k]}`);
  if (a.thresholds.classifier !== b.thresholds.classifier) out.push(`Classifier threshold: ${a.thresholds.classifier} → ${b.thresholds.classifier}`);
  if (a.thresholds.voice !== b.thresholds.voice) out.push(`Voice outcome threshold: ${a.thresholds.voice} → ${b.thresholds.voice}`);
  for (const k of ["tasks", "retries", "cost"] as const) if (a.limits[k] !== b.limits[k]) out.push(`Limit ${k} per policy per month: ${a.limits[k]} → ${b.limits[k]}`);
  if (a.conduct.join() !== b.conduct.join()) out.push("Conduct checks changed");
  return out.length ? out : ["No changes"];
}

/** Workflows a route change touches: the agent's workflows plus any workflow code named in the route. */
export function routeAffects(agentWorkflows: string[], route: string): string[] {
  const named = route.match(/\b([SWRLX]\d)\b/g) ?? [];
  return [...new Set([...agentWorkflows, ...named])];
}
