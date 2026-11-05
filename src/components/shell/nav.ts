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
  Play,
  Activity,
  Radio,
  Gauge,
  Inbox,
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
  /** Sidebar section heading. */
  group: string;
}

const m = (id: ModuleId) => ({ module: id, label: MODULES[id].label, route: MODULES[id].route });

/** Sidebar order. Labels and routes of modules come from the registry. */
export const NAV: NavEntry[] = [
  { key: "executive", ...m("executive"), icon: Gauge, group: "Analytics" },
  { key: "overview", ...m("overview"), icon: LayoutDashboard, group: "Analytics" },
  { key: "reports", ...m("measurement"), icon: LineChart, group: "Analytics" },
  { key: "cohorts", ...m("cohorts"), icon: Layers, group: "Analytics" },
  { key: "agents", ...m("agents"), icon: Bot, group: "Orchestration" },
  { key: "workflows", ...m("workflows"), icon: Workflow, group: "Orchestration" },
  { key: "launch", ...m("launch"), icon: Play, group: "Orchestration" },
  { key: "performance", ...m("performance"), icon: Activity, group: "Observability" },
  { key: "activity", ...m("activity"), icon: Radio, group: "Observability" },
  { key: "rules", ...m("rules"), icon: SlidersHorizontal, group: "Orchestration" },
  { key: "stages", ...m("journeys"), icon: Waypoints, group: "Operations" },
  { key: "policies", module: "journeys", label: "Policies", route: "/persistency/policies", icon: FileText, group: "Operations" },
  { key: "queue", module: null, label: "People queue", route: "/persistency/queue", icon: Inbox, group: "Operations" },
  { key: "approvals", module: null, label: "Approvals", route: "/persistency/approvals", icon: CheckSquare, group: "Operations" },
  { key: "work", ...m("roles"), icon: ListChecks, group: "Operations" },
  { key: "collections", ...m("collections"), icon: Flame, group: "Operations" },
  { key: "data", ...m("data"), icon: Database, group: "Operations" },
  { key: "contact-policy", ...m("guardrails"), icon: ShieldCheck, group: "Compliance" },
  { key: "admin", ...m("admin"), icon: Settings2, group: "Settings" },
  { key: "positioning", ...m("positioning"), icon: Network, group: "Settings" },
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
