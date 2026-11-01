# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

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
