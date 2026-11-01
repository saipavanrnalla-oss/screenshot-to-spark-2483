import {
  LayoutDashboard,
  Waypoints,
  Layers,
  Workflow,
  SlidersHorizontal,
  ListChecks,
  Flame,
  Network,
  Database,
  ShieldCheck,
  LineChart,
  Settings2,
  FileText,
  CheckSquare,
  Bot,
} from "lucide-react";
import { MODULES, type ModuleId } from "@/config/modules";
import type { NavKey } from "@/config/users";

export interface NavEntry {
  key: NavKey;
  /** Module this entry belongs to; null for shared pages (Approvals). */
  module: ModuleId | null;
  label: string;
  route: string;
  icon: typeof LayoutDashboard;
}

const m = (id: ModuleId) => ({ module: id, label: MODULES[id].label, route: MODULES[id].route });

/** Sidebar order. Labels and routes of modules come from the registry. */
export const NAV: NavEntry[] = [
  { key: "overview", ...m("overview"), icon: LayoutDashboard },
  { key: "stages", ...m("journeys"), icon: Waypoints },
  { key: "policies", module: "journeys", label: "Policies", route: "/persistency/policies", icon: FileText },
  { key: "approvals", module: null, label: "Approvals", route: "/persistency/approvals", icon: CheckSquare },
  { key: "cohorts", ...m("cohorts"), icon: Layers },
  { key: "rules", ...m("rules"), icon: SlidersHorizontal },
  { key: "workflows", ...m("workflows"), icon: Workflow },
  { key: "agents", ...m("agents"), icon: Bot },
  { key: "work", ...m("roles"), icon: ListChecks },
  { key: "collections", ...m("collections"), icon: Flame },
  { key: "data", ...m("data"), icon: Database },
  { key: "contact-policy", ...m("guardrails"), icon: ShieldCheck },
  { key: "reports", ...m("measurement"), icon: LineChart },
  { key: "admin", ...m("admin"), icon: Settings2 },
  { key: "positioning", ...m("positioning"), icon: Network },
];

export const NAV_BY_KEY = Object.fromEntries(NAV.map((n) => [n.key, n])) as Record<NavKey, NavEntry>;

/** The sidebar entry a path belongs to (longest matching route wins). */
export function navForPath(pathname: string): NavEntry | undefined {
  const path = pathname.replace(/\/$/, "") || "/";
  let best: NavEntry | undefined;
  for (const n of NAV) {
    const hit = n.route === "/persistency" ? path === "/persistency" : path === n.route || path.startsWith(n.route + "/");
    if (hit && (!best || n.route.length > best.route.length)) best = n;
  }
  return best;
}
