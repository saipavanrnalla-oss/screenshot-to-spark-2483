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

- The build follows the uploaded brief in steps; `roadmap.md` tracks them. Pause for the user after each step. Why: the user asked to review each step.
- All demo data comes from the seeded generator in `src/data/persistency/` (fixed seed, fixed "now" in `dates.ts`). Every figure on screen is computed from it, never hard-coded. Why: every page must tell the same story and nothing may claim unprovable numbers.
- Decisions come only from `src/engine/persistency.ts` (`evaluate`, `applyEvent`); pages never decide actions themselves. Why: the rule that fired must always be visible and consistent.
- In-session edits (event simulations, approvals, kill switch, cohort set per product) live in the zustand store `src/store/persistency.ts`; there is no backend. Why: the brief forbids backend calls.
- Persona (`?as=`) and product (`?product=`) are optional search params on the `/persistency` layout, carried forward by its search middleware; personas are data in `src/config/personas.ts`. Why: adding a persona must be config, not code.
- Dates are handled and formatted in UTC (shown as IST in `lib/format.ts`) and numbers with manual Indian grouping. Why: avoids SSR/client hydration mismatches.
- Colours and fonts are only the PRISM tokens in `src/styles.css` (hex values kept as given). Why: the brief fixes exact values.
