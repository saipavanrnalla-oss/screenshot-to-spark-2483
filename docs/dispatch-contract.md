# Dispatch contract: the prototype to the voice and WhatsApp platform

The prototype runs the 13th and 25th month workflows step by step in the browser. Every step that contacts a customer is listed as an action. With `VITE_DISPATCH_URL` set, each action is POSTed to that address as it runs. Nothing else needs a backend.

## When an action is sent

When the operator presses **Run** (or **Run next step for all**) on **Load the due list**, the step runs and each new action is POSTed once. A call step that turns into a product explanation sends two actions: the call and the explanation call.

## Request

`POST {VITE_DISPATCH_URL}` with `Content-Type: application/json`

```json
{
  "policy": "SLI02409101",
  "customer": "Sunil Kapoor",
  "phone": "+919800000001",
  "language": "Hindi",
  "step": "early",
  "channel": "Voice",
  "action": "Place a call with script early-p13-hi, return disposition and transcript",
  "scriptId": "early-p13-hi",
  "text": "Namaste, main Asha, Sample Life Insurance se ...",
  "callback": "/api/runs/SLI02409101/result"
}
```

| Field | Meaning |
| --- | --- |
| `channel` | `Voice`, `WhatsApp`, `Brief` (advisor or branch digest) or `Vendor` |
| `step` | Workflow step id, as on the canvas |
| `scriptId` | Approved variant from the scripts library, already chosen for the customer's band, language and product |
| `text` | The words filled in for this customer. For WhatsApp this is the message body; for Voice it is the opening the agent uses |
| `callback` | Where the result goes once the platform has it |

The prototype does not wait for the response. A failed POST does not stop the demo.

## What the platform does

| Channel | Action |
| --- | --- |
| Voice | Place the call with the voice agent using `text` as the opening and `scriptId` for the rest of the script |
| WhatsApp | Send `text` through the WhatsApp Business API from the approved template matching `scriptId` |
| Brief | Send the digest to the advisor or branch |
| Vendor | Add the policy to the vendor's work list |

A shell script or a small service that reads the JSON and calls the two APIs is enough for the booth.

## Result back (next phase)

Today the customer's answer comes from the scenario or the operator's pick. To let a real call drive the next step, the platform sends the result to `callback`:

```json
{
  "policy": "SLI02409101",
  "step": "early",
  "channel": "Voice",
  "disposition": "Promise to pay",
  "transcript": [{ "who": "Agent", "text": "..." }, { "who": "Customer", "text": "..." }],
  "delivered": true,
  "read": true,
  "paid": false
}
```

Dispositions the workflow branches on: `Promise to pay`, `Explained, will pay`, `Paid on the call`, `Not reached`, `No intention to pay`, `Asked for a person`. For WhatsApp, `paid: true` moves the policy to Renewed.

To build: an endpoint at `callback` that stores the result, and a change in `src/store/live.ts` so `step()` uses the stored result in place of the simulated one. `runStep` in `src/engine/live-run.ts` already takes the customer's answer as its third argument.
