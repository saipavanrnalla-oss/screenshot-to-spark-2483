// Renders the voice agent prompt for each live use case call into docs/voice-agent-prompts.md.
// Run: bun scripts/render-agent-prompts.ts
import { writeFileSync } from "node:fs";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { prepare } from "@/components/r1/wf-model";
import { agentPromptFor, parseDueFile, SAMPLE_FILE, stagePolicy, startRun } from "@/engine/live-run";

const graph = prepare(SEED_GRAPHS["R1"]!);
const rows = parseDueFile(SAMPLE_FILE).rows;
const calls = [
  { uc: "1 and 2a, first call", policy: "SLI02409101", node: "early" },
  { uc: "2a, explanation call", policy: "SLI02409102", node: "explain1" },
  { uc: "2b, reminder call after WhatsApp", policy: "SLI02409103", node: "call15" },
];
let out = "# Voice agent prompts for the live use cases\n\nGenerated from `src/data/persistency/r1/agent-prompt.ts` with the booth sample policies. The prototype sends the same text, filled for whichever policy is called, as `agentPrompt` with every live call. Load it as the voice agent's system prompt for that call.\n";
for (const c of calls) {
  const row = rows.find((r) => r.policy === c.policy)!;
  const run = startRun(row, stagePolicy(row), "booth-use-cases.csv")!;
  const node = graph.nodes.find((n) => n.id === c.node)!;
  const p = agentPromptFor({ ...run, nodeId: node.id }, node);
  if (!p) throw new Error(`no prompt for ${c.policy} ${c.node}`);
  out += `\n## Use case ${c.uc}: ${row.name}, ${node.label}\n\n\`\`\`text\n${p}\`\`\`\n`;
}
writeFileSync("docs/voice-agent-prompts.md", out);
console.log("wrote docs/voice-agent-prompts.md");
