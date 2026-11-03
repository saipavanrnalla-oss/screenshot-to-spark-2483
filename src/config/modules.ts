/**
 * Release 1 visibility. The single source of what the user sees.
 * A module with `enabled: false` stays in the code and keeps compiling; it only
 * disappears from the sidebar, search, breadcrumb and links, and its route
 * redirects to the user's landing page. `?modules=all` shows everything.
 */
export type ModuleId =
  | "journeys"
  | "cohorts"
  | "rules"
  | "workflows"
  | "agents"
  | "roles"
  | "collections"
  | "data"
  | "guardrails"
  | "measurement"
  | "admin"
  | "overview"
  | "positioning"
  | "performance"
  | "launch";

export const MODULES: Record<ModuleId, { n: number | null; label: string; route: string; enabled: boolean }> = {
  journeys:    { n: 1,  label: "Policy stages",    route: "/persistency/stages",     enabled: true  },
  cohorts:     { n: 2,  label: "Cohorts",          route: "/persistency/cohorts",    enabled: false },
  rules:       { n: 3,  label: "Rules",            route: "/persistency/rules",      enabled: false },
  workflows:   { n: 4,  label: "Workflows",        route: "/persistency/workflows",  enabled: true  },
  agents:      { n: 5,  label: "Agents",           route: "/persistency/agents",     enabled: true  },
  roles:       { n: 6,  label: "Work queues",      route: "/persistency/work",       enabled: false },
  collections: { n: 7,  label: "Collections",      route: "/persistency/collections",enabled: false },
  data:        { n: 8,  label: "Data files",       route: "/persistency/data",       enabled: false },
  guardrails:  { n: 9,  label: "Contact policy and audit", route: "/persistency/contact-policy", enabled: false },
  measurement: { n: 10, label: "Reports",          route: "/persistency/reports",    enabled: true  },
  admin:       { n: 11, label: "Administration",   route: "/persistency/admin",      enabled: false },
  overview:    { n: null, label: "Overview",       route: "/persistency",            enabled: false },
  positioning: { n: null, label: "Where Desible sits", route: "/persistency/where-desible-sits", enabled: false },
  performance: { n: null, label: "Workflow performance", route: "/persistency/performance", enabled: true  },
  launch:      { n: null, label: "Run a workflow",   route: "/persistency/launch",     enabled: true  },
};

export const CHROME = {
  showDemoBanner: false,
  showTierBadges: false,
  showTicker: false,
  showPersonaBar: false,
  showSpinePanel: false,
  showHowAStepRuns: false,
  showTaglines: false,
};

export type ChromeFlag = keyof typeof CHROME;

/** True when the developer override `?modules=all` is on the current URL. */
export function overrideFromSearch(search: unknown): boolean {
  return !!search && typeof search === "object" && (search as { modules?: unknown }).modules === "all";
}

export function moduleVisible(id: ModuleId, override: boolean): boolean {
  return override || MODULES[id].enabled;
}

export function chromeVisible(flag: ChromeFlag, override: boolean): boolean {
  return override || CHROME[flag];
}
