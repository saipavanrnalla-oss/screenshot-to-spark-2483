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

Sign in as the Ops lead, open **Load the due list**, press **Four booth scenarios**, then **Check and stage** and **Start**. Each card plays its story when you press Run:

| Scenario | Customer | What it shows |
| --- | --- | --- |
| A | Sunil Kapoor, P2, Hindi, T-80 | Voice call, disposition read from the call, the payment link on WhatsApp as the next step, paid |
| B | Meera Iyer, P8, T-14 | WhatsApp first, no payment in 2 days, a second WhatsApp on the same channel, paid |
| C | Farhan Ali, P4, T-13 | Two WhatsApp messages unpaid, the channel switches to a call, an explanation call, paid on the link |
| D | Kiran Rao, P1, Grace day 4 | Two refusals; the Worth Pursuing Model drops below 25% and hands the case to the variable-payout vendor |

The staging table and the "Same step, different words" table show which approved script each customer gets and why. On a workflow page, **Show highlights** pins the six steps worth pointing at.

## Placing real calls and WhatsApp messages

By default every call and message is simulated in the browser. To send them for real, set an address in a `.env.local` file at the project root:

```
VITE_DISPATCH_URL=http://localhost:8787/dispatch
```

Each call or message step then POSTs one JSON action to that address. The payload and the result the platform sends back are in `docs/dispatch-contract.md`.

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
