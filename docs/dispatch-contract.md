# Live demo contract: the prototype and the voice and WhatsApp platform

The prototype runs the 13th and 25th month journeys step by step. For the three live use cases (1, 2a, 2b) it places a real call or sends a real WhatsApp through the platform, waits for the result, and moves the policy to the next step on that result. Everything else on screen stays simulated.

```
Board (browser)  --POST /api/live/dispatch-->  Prototype server  --POST DISPATCH_URL-->  Voice / WhatsApp platform
                                                                                              |
Board polls GET /api/live/result  <--  Prototype server  <--POST callbackUrl (/api/live/result)--+
Visitor's phone: WhatsApp link -> /pay/<policy> -> POST /api/live/result (paid)
```

## 1. Settings (server environment)

| Variable | Meaning |
| --- | --- |
| `DISPATCH_URL` | Platform endpoint that receives each call or WhatsApp request. Unset = everything simulated |
| `DISPATCH_TOKEN` | Optional. Sent as `Authorization: Bearer <token>` |
| `PORT` | Port for the Node server build (default 3000) |

## 2. Request: prototype to platform

`POST {DISPATCH_URL}` with `Content-Type: application/json`, one request per call or message. Reply `2xx` to accept; the result comes later on the callback.

```json
{
  "requestId": "SLI02409101-early-m3k2x1",
  "policy": "SLI02409101",
  "customer": "Sunil Kapoor",
  "phone": "+919800000001",
  "language": "English",
  "channel": "Voice",
  "step": "early",
  "stepLabel": "Pre-due renewal call (T-90)",
  "scriptId": "early-low-en",
  "scriptName": "Pre-due renewal call (Low propensity)",
  "text": "Good morning, this is Asha calling on behalf of Sample Life Insurance. May I speak to Sunil Kapoor? ...",
  "payLink": "https://<app host>/pay/SLI02409101?amount=36%2C000&plan=Assured%20Savings%20Plan&name=Sunil%20Kapoor",
  "premium": 36000,
  "dueDate": "2027-01-16",
  "plan": "Assured Savings Plan",
  "propensity": "Low",
  "workflow": "R1",
  "callbackUrl": "https://<app host>/api/live/result"
}
```

| Field | Use |
| --- | --- |
| `channel` | `Voice`: place an outbound call with the voice agent. `WhatsApp`: send a message from the approved template |
| `scriptId`, `text` | The approved script for this customer, already chosen by propensity, product and language, with the customer's details filled in. Voice: the agent's opening and the facts it must say. WhatsApp: the message body |
| `payLink` | The link to put in the WhatsApp message. It opens the demo payment page |
| `callbackUrl` | Where to post the result. Echo `requestId` |

## 3. Callback: platform to prototype

`POST {callbackUrl}` (`/api/live/result`) once the call ends. CORS is open.

```json
{
  "requestId": "SLI02409101-early-m3k2x1",
  "policy": "SLI02409101",
  "step": "early",
  "channel": "Voice",
  "disposition": "Promise To Pay",
  "subDisposition": "Will pay by own",
  "transcript": [
    { "who": "Agent", "text": "Good morning, this is Asha calling on behalf of Sample Life Insurance..." },
    { "who": "Customer", "text": "Yes, I will pay. Please send me the link." }
  ],
  "recordingUrl": "https://platform.example.com/recordings/abc.mp3"
}
```

Required: `policy`, `channel`. Send `requestId` so a late result for an earlier call is ignored. `transcript` and `recordingUrl` are shown on the policy trail.

### Disposition codes and the branch each one takes

The codes are the insurer's own disposition table. The prototype reads `disposition` and `subDisposition` together.

| Disposition | Sub-disposition examples | Workflow branch |
| --- | --- | --- |
| Promise To Pay | Will pay by own; Agreed to represent Direct Debit | Will pay: payment link on WhatsApp |
| Follow-up | Not convinced | Not convinced: product explanation call |
| Pay upon resolution | Require notice or receipt; Want to meet agent | Not convinced: product explanation call |
| No Intention To Pay | Misselling; Financial problem; Service related issue; Already taken another policy | Refused: reason classified, brief to sales |
| Do Not Call | Do not want to be reminded | A person takes over |
| NON CONTACT | Ringing or busy; Switched off; Not reachable; Invalid number | Not reached: retry |
| (any) with `paid: true` | Paid on the call | Paid |

### WhatsApp results

The payment page reports the payment itself, so the platform only needs to send the WhatsApp. If the platform tracks delivery, it may post `{ "policy", "channel": "WhatsApp", "step", "delivered": true, "read": true }`; the board shows it but waits for a payment. On the board the operator presses **No payment yet: move on** to show the "no payment in 2 days" branch.

## 4. The three live use cases

| # | Policy | Steps that go out live | Platform result the demo expects |
| --- | --- | --- | --- |
| 1 | SLI02409101, Low propensity | Call `early` (script `early-low-en`), then WhatsApp `elink` (`elink-en`) | Call: Promise To Pay. Then the visitor pays on the link |
| 2a | SLI02409102, Low propensity | Call `early` (`early-low-en`), call `explain1` (`explain-trad`), WhatsApp `elink` (`elink-en`) | First call: Follow-up, Not convinced. Explanation call: Promise To Pay. Then the visitor pays |
| 2b | SLI02409103, Medium propensity | WhatsApp `link15` (`link15-med-en`), WhatsApp `link15b` (`link2-med-en`), call `call15` (`call15-med-en`), WhatsApp `ptp2` (`link15-med-en` resent) | No payment twice (operator moves on), call: Promise To Pay, then the visitor pays |

The voice agent says the script; the visitor answers as they like. The disposition the platform returns decides the branch, so a visitor who says "I will pay" on use case 2a takes the happy path. That is fine.

## 5. Fallbacks on the day

- **No result after a minute:** press **Use the scenario answer** on the card. The step completes with the scripted answer and the demo carries on.
- **Platform down:** untick **Place real calls and messages**; every step is simulated.
- **Wrong number typed:** edit the number on the card before the first step.

## 6. Testing without the platform

`node scripts/mock-platform.mjs` listens on `http://localhost:8787/dispatch`, logs each request, and posts the scripted disposition for each live use case three seconds after a call request.

## 7. Hosting

Results are kept in the server's memory, so run one Node process: `NITRO_PRESET=node-server npm run build`, then `node .output/server/index.mjs`. The app needs a public HTTPS address so the visitor's phone can open the payment page and the platform can reach the callback.
