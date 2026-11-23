// Renders the voice agent prompt for each live use case call into docs/voice-agent-prompts.md.
// Run: bun scripts/render-agent-prompts.ts
import { writeFileSync } from "node:fs";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { prepare } from "@/components/r1/wf-model";
import { agentPromptFor, parseDueFile, SAMPLE_FILE, stagePolicy, startRun } from "@/engine/live-run";
import { buildAgentPrompt } from "@/data/persistency/r1/agent-prompt";

const graph = prepare(SEED_GRAPHS["R1"]!);
const rows = parseDueFile(SAMPLE_FILE).rows;
const calls = [
  { uc: "1 and 2a, first call", policy: "SLI02409101", node: "early" },
  { uc: "2a, explanation call", policy: "SLI02409102", node: "explain1" },
  { uc: "2b, reminder call after WhatsApp", policy: "SLI02409103", node: "call15" },
];
const T = (k: string) => `{${k}}`;
const template = buildAgentPrompt("preDue", {
  agent: T("agent_name"), name: T("policyholder_name"), first: T("first_name"), policy: T("policy_number"), plan: T("plan_name"),
  product: T("product_type"), premium: T("amount_to_pay"), due: T("due_date"), graceEnd: T("grace_end"), sumAssured: T("sum_assured"),
  mode: T("payment_mode"), language: "English", helpline: T("helpline"), propensity: T("propensity_band"), stepLabel: T("step_label"),
  scriptId: T("script_id"), renewal: T("renewal"), premiumsPaid: T("premiums_paid"), issueDate: T("issue_date"), autopay: "None",
  lastYear: T("last_year_payment"), ppt: T("ppt"), pt: T("policy_term"), status: T("policy_status"), channel: T("channel"), branch: T("branch"),
});
let out = `# Voice agent prompts for the live use cases

Generated from \`src/data/persistency/r1/agent-prompt.ts\`. **Every value in a prompt comes from the row of the uploaded due list for the policy being called**, so the prompt is different on every call. The prototype builds it when the call is placed and sends it as \`agentPrompt\`. Load that field as the voice agent's system prompt for that call. Never hardcode the examples below.

What changes with the upload:

- Every detail in CURRENT CONTEXT: name, policy number, plan, premium, due date, grace end, sum assured, mode, terms, status, branch, propensity band. Blank columns are left out.
- The amount to pay: when the file has a suspense balance, the agent says how much is already held and asks only for the rest.
- Auto-debit: when the policy already has auto-debit, the agent doesn't offer to set it up.
- Life insured: when it is someone other than the policyholder, the cover is described on their life.
- The script: picked by propensity band, product and language, so the facts and the explanation points change too.
- The language the call starts in.

## Template (pre-due call, placeholders in braces)

\`\`\`text
${template}\`\`\`

## Filled examples from the booth sample file
`;
for (const c of calls) {
  const row = rows.find((r) => r.policy === c.policy)!;
  const run = startRun(row, stagePolicy(row), "booth-use-cases.csv")!;
  const node = graph.nodes.find((n) => n.id === c.node)!;
  const p = agentPromptFor({ ...run, nodeId: node.id }, node);
  if (!p) throw new Error(`no prompt for ${c.policy} ${c.node}`);
  out += `\n### Use case ${c.uc}: ${row.name}, ${node.label}\n\n\`\`\`text\n${p}\`\`\`\n`;
}
writeFileSync("docs/voice-agent-prompts.md", out);
console.log("wrote docs/voice-agent-prompts.md");
