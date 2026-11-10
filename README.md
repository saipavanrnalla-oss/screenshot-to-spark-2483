# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Run it on your computer

You need Node.js 20 or newer. Bun is optional but faster; the repo ships a `bun.lock`.

### Mac or Linux

```sh
git clone -b demo-two-personas https://github.com/saipavanrnalla-oss/screenshot-to-spark-2483.git persistency-demo
cd persistency-demo
npm install        # or: bun install
npm run dev        # or: bun run dev
```

### Windows (PowerShell)

1. Install Node.js LTS from nodejs.org (tick "Add to PATH"), then open a new PowerShell window.
2. Unzip the folder, or clone it with Git for Windows:

```powershell
git clone -b demo-two-personas https://github.com/saipavanrnalla-oss/screenshot-to-spark-2483.git persistency-demo
cd persistency-demo
npm install
npm run dev
```

If PowerShell refuses to run `npm` scripts, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt instead.

Open the address it prints (usually http://localhost:5173), pick a role on the sign-in page and press Sign in. Runs, approvals and reviews are kept in that browser; use one browser for a demo and switch roles from the role switcher. To start fresh, clear the site data for localhost.

For a faster build to demo from: `npm run build` then `npm run preview`.

## The booth demo

Sign in as the Ops lead, open **Import due list**, press **Booth use cases**, then **Check and stage** and **Start**.

| # | Customer | Propensity | What it shows | Live |
| --- | --- | --- | --- | --- |
| 1 | Sunil Kapoor, T-80 | Low | Renewal call, the customer promises, the disposition is read from the call, the payment link goes on WhatsApp, paid | Yes |
| 2a | Farhan Ali, T-76 | Low | Renewal call, the customer is not convinced, a product explanation call follows, the customer agrees, link on WhatsApp, paid | Yes |
| 2b | Meera Iyer, T-14 | Medium | WhatsApp with the link, no payment in 2 days, a second WhatsApp, still unpaid so a reminder call, promise, link resent, paid | Yes |
| 3 | Arjun Nair, T-13 | High | Digital only: WhatsApp, a second WhatsApp, paid with no call | No |
| 4 | Kiran Rao, Grace day 4 | Low | Two refusals; the Worth Pursuing Model drops below 25% and hands the case to the variable-payout vendor | No |

The staging table and the "Same step, different words" table show which approved script each customer gets and why. On a workflow page, **Show highlights** pins the steps worth pointing at. Signed in as the Head of Persistency, the Executive dashboard has **Ask the data** (four set questions answered from the policy book) and **Monthly review** has the leadership pack.

## Live calls and WhatsApp

By default every step is simulated. To place real calls and messages for use cases 1, 2a and 2b, start the app with the address of the voice and WhatsApp platform:

```sh
DISPATCH_URL=https://platform.example.com/demo/dispatch DISPATCH_TOKEN=secret npm run dev
```

On Windows PowerShell: `$env:DISPATCH_URL="https://..."; npm run dev`.

The board then shows **Live**. Type the visitor's phone number on the card, press **Place the call**, and the server forwards the request to `DISPATCH_URL`. The platform calls back `/api/live/result` with the disposition and transcript, and the workflow moves to the next step on its own. The WhatsApp link opens a demo payment page (`/pay/<policy>`); pressing Pay there moves the policy to Renewed. No money is taken.

To try the loop without the real platform, run the mock in a second terminal:

```sh
node scripts/mock-platform.mjs
DISPATCH_URL=http://localhost:8787/dispatch npm run dev
```

The full contract (request, callback, disposition codes) is in `docs/dispatch-contract.md`.

### Hosting the live demo

The live loop keeps results in the server's memory, so it needs one long-running Node process:

```sh
NITRO_PRESET=node-server npm run build
DISPATCH_URL=... node .output/server/index.mjs     # serves on port 3000; set PORT to change
```

The phone that receives the WhatsApp must be able to open the app's address, so host it on a public URL (any VM, Render, Railway or Fly.io).

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Release 1 visibility

What the app shows is set in `src/config/modules.ts`, in two blocks:

- `MODULES` lists every module with its number, label, route and an `enabled` flag. Release 1 enables Policy stages, Rules, Workflows, Agents, Data files and Reports. Cohorts, Work queues, Collections, Contact policy and audit, Administration, Overview and Where Desible sits are disabled. A disabled module disappears from the sidebar, search, breadcrumb and links, and its route sends the user to their landing page. Its page, data and components stay in the code.
- `CHROME` holds flags for the old demo banner, tier badges, decisions ticker, persona bar, spine panel, "how a step runs" legend and page taglines. All are `false` in release 1.

Which sidebar items each test user sees, where they land and which buttons they may use is set in `src/config/users.ts`.

## Unhiding modules

- To unhide a module for everyone, set its `enabled` to `true` in `MODULES`. Roles that list it in `src/config/users.ts` then see it.
- To bring back an old banner or badge, set the matching `CHROME` flag to `true`.
- To see every page and every banner without changing code, add `?modules=all` to any Persistency address, for example `/persistency/stages?modules=all`. The value is carried on every link until you remove it. It appears in no menu.
