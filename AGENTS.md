<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- The build follows the latest uploaded brief's numbered steps (release 1 brief now); `roadmap.md` tracks them. Why: keeps scope traceable to the brief.
- Visibility comes only from `src/config/modules.ts` (`MODULES`, `CHROME`); routes call `gate(navKey, search)` from `lib/gate.ts` in `beforeLoad`, and old banners/badges read `useChrome`. Hidden pages are never deleted. Why: a later version unhides by changing one value.
- Test users, role sidebars, landing pages and permissions are data in `src/config/users.ts`; buttons check `can(user, permission)` and are hidden when not allowed. Why: roles change without code edits.
- The `/persistency` layout is `ssr: false`; the session (`store/session.ts`) and saved work (`store/persistency.ts`, key `STORE_KEY`) persist in localStorage. Bump the key version when the saved shape changes. Why: work must survive reload with no backend, without hydration mismatches.
- Old addresses (`/persistency/lifecycle`, `/configuration`, `/measurement`, etc.) stay as redirect-only route files. Why: no old link breaks.
- All demo data comes from the seeded generator in `src/data/persistency/` (fixed seed, fixed "now" in `dates.ts`). Every figure on screen is computed from it, never hard-coded. Why: every page must tell the same story and nothing may claim unprovable numbers.
- Decisions come only from `src/engine/persistency.ts` (`evaluate`, `applyEvent`); pages never decide actions themselves. Why: the rule that fired must always be visible and consistent.
- In-session edits (event simulations, approvals, kill switch, cohort set per product) live in the zustand store `src/store/persistency.ts`; there is no backend. Why: the brief forbids backend calls.
- Persona (`?as=`), product (`?product=`) and the `?modules=all` override are optional search params on the `/persistency` layout, carried forward by its search middleware; personas (used by hidden work-queue pages) are data in `src/config/personas.ts`. Why: adding a persona must be config, not code.
- Dates are handled and formatted in UTC (shown as IST in `lib/format.ts`) and numbers with manual Indian grouping. Why: avoids SSR/client hydration mismatches.
- Colours and fonts are only the tokens in `src/styles.css`, dark in `:root` and light in `html.light` (hex values kept as given). Why: the brief fixes exact values.
- Every rule change (rule editor, product matrix, war-room recommendation, learn step) becomes a `PendingChange` via the store's `propose`; only `approve`/`applyNow` touch `rules`. Why: nothing changes until a named person approves it.
- Persona homes are one `PersonaHome` rendering panel ids from `src/config/panels.ts` through the registry in `components/persistency/persona-panels.tsx`. Why: a new persona is a config entry, a new panel is one registry entry.
- Month-end numbers (plan, run-rate, required rate, daily series) come only from `useMonth` in `components/persistency/month.tsx`. Why: war room, CXO, regional and measurement must agree.
- Versioned objects (rules, workflows, agents, stage settings) share one Draft, In review, Active, Retired lifecycle in `store/work.ts` (`saveDraft`, `submit`, `approve`); seeded history comes from `seedVersions`. Why: one approval queue and one diff model for every module.
- Workflow graphs are `WfGraph` data edited with the pure helpers in `components/r1/wf-model.ts` and checked and played by `engine/workflow.ts`; the canvas loads through `CanvasBox`. Why: builder, compare and simulation stay consistent and testable.
- File imports go through `checkFile` and `applyImport` (`components/r1/data-model.ts`), which write to both stores. Why: an import changes the counts on every screen it feeds.

