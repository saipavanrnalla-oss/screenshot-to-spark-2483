# Persistency roadmap

## Release 1 (current brief)

Source: uploaded "Persistency release 1: modules, depth and hidden pages" (1 Nov 2026). It replaces the earlier brief where they differ. The brief asks to stop after each step; on 2 Nov 2026 the user asked to complete every remaining step in one go.

- [x] 1. Module registry and flags, wording and look, five test users, shell and sidebar by role
- [x] 2. Policy stages, Policies, Policy page with Activity, Stage settings
- [x] 3. Approvals and the shared version model
- [x] 4. Rules
- [x] 5. Workflows, canvases, Builder, Prompt builder, Simulation, Versions
- [x] 6. Agents, Configure, Versions, Tasks, Test, Handoffs, Task queue, Orchestration settings
- [x] 7. Data files, import wizard, Outbound lists, Executors, Paid since the list
- [x] 8. Reports
- [x] 9. Pass over copy, layout and flags

## Earlier build (first brief, done)

Steps 0 to 10 of "Persistency Control Tower: Lovable Build Prompt" are built. Pages that release 1 hides stay in the code behind the module registry.

## Demo build (2 Nov 2026)

Source: call with Anurag, 2 Nov 2026. Two personas only (Operations lead, Head of Persistency).

- [x] Two users in `config/users.ts`; the five release 1 users stay in `USERS_HIDDEN`. Rules and Data files hidden in `config/modules.ts`.
- [x] Workflow library renamed with insurance names (13th Month Persistency, Grace-Period Recovery, Lapse Revival Campaign, ULIP Surrender Prevention). Full canvases for R1, L1, L3 as well as R2, R4, W1.
- [x] Workflow performance (`/persistency/performance`): policy count on every step and edge, period selector, side panel by cohort.
- [x] Run a workflow (`/persistency/launch`): CSV import, routing by renewal propensity, posts the list to an address set under Connection, follows each policy.
- [x] Cohorts A1 to A5 renamed Highest to Lowest propensity.
- [x] Reason classifier and Handoff summariser: sample run on the agent page.

## Demo build, round 2 (3 Nov 2026)
- Agents renamed in insurance terms (Renewal Reminder Agent, Premium Renewal Voice Agent, Lapse Reason Classifier, Payment Link Dispatcher, Advisor Callback Brief Agent, Compliance Guard) and four new "not enabled" agents added.
- New Agent activity page under Observability (running now, 24-hour activity, task history).
- Full canvases for R1, R2, R3, R4, W1, W3, S2, L1, L2, L3, X1, all sharing one skeleton: guards, route by propensity, channel, response branches, promise tracking, escalation, exit.
- Workflow performance rebuilt: portfolio grouped by lifecycle, per-workflow Flow, Agents, History and Outcomes by reason.
- Executive dashboard: decisions first, India state heat map, top at-risk districts, glossary terms (13M/25M/61M Persistency, RYP at risk, Grace Period, Product Mix, Channel Mix). State and district are derived from city, so seeded numbers did not change.
- Not done: Lapse cohort analytics page; 49M Persistency and Policy Persistency (not in the seeded series).
