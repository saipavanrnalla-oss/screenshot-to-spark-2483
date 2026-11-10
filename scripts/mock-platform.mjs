// Mock voice and WhatsApp platform for testing the live demo loop without real calls.
// Run: node scripts/mock-platform.mjs   (listens on http://localhost:8787/dispatch)
// Then start the app with DISPATCH_URL=http://localhost:8787/dispatch.
// For a Voice request it waits 3 seconds and posts a disposition and transcript to callbackUrl.
// The disposition follows the demo use case for the policy; set MOCK_DISPOSITION to force one.
// WhatsApp requests are only logged: the payment comes from the demo payment page (/pay/<policy>).
import http from "node:http";

const PORT = Number(process.env.PORT ?? 8787);
const FORCE = process.env.MOCK_DISPOSITION;

// What the customer says on each live use case, step by step (policy -> step -> disposition).
const SCRIPTED = {
  SLI02409101: { early: ["Promise To Pay", "Will pay by own"] },
  SLI02409102: { early: ["Follow-up", "Not convinced"], explain1: ["Promise To Pay", "Will pay by own"] },
  SLI02409103: { call15: ["Promise To Pay", "Will pay by own"] },
};

const lines = {
  "Promise To Pay": ["Yes, I will pay. Please send me the link.", "Thank you. I am sending the secure payment link to your WhatsApp now."],
  "Follow-up": ["I am not convinced. I was told I only had to pay once.", "I understand. A colleague will call you in a few minutes to take you through the benefits."],
  "No Intention To Pay": ["I don't want to continue this policy.", "I understand. May I ask the reason?"],
};

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith("/dispatch")) {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const d = JSON.parse(body || "{}");
    console.log(`[${new Date().toISOString()}] ${d.channel} ${d.policy} step=${d.step} to ${d.phone} script=${d.scriptId}`);
    res.writeHead(202, { "Content-Type": "application/json" }).end(JSON.stringify({ accepted: true, requestId: d.requestId }));
    if (d.channel !== "Voice") return;
    const [disposition, subDisposition] = FORCE ? [FORCE, undefined] : SCRIPTED[d.policy]?.[d.step] ?? ["Promise To Pay", "Will pay by own"];
    const [cust, agent] = lines[disposition] ?? lines["Promise To Pay"];
    setTimeout(() => {
      fetch(d.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: d.requestId, policy: d.policy, step: d.step, channel: "Voice", disposition, subDisposition,
          transcript: [{ who: "Agent", text: d.text }, { who: "Customer", text: cust }, { who: "Agent", text: agent }],
        }),
      }).then((r) => console.log(`  result posted: ${disposition} (${r.status})`)).catch((e) => console.error("  callback failed", e.message));
    }, 3000);
  });
});

server.listen(PORT, () => console.log(`Mock platform on http://localhost:${PORT}/dispatch`));
