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
} from "lucide-react";
import type { NavKey } from "@/config/personas";

export interface NavItem {
  key: NavKey;
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "control-tower", label: "Control Tower", to: "/persistency", icon: LayoutDashboard },
  { key: "lifecycle", label: "Lifecycle", to: "/persistency/stages", icon: Waypoints },
  { key: "cohorts", label: "Cohorts", to: "/persistency/cohorts", icon: Layers },
  { key: "workflows", label: "Workflows", to: "/persistency/workflows", icon: Workflow },
  { key: "configuration", label: "Configuration", to: "/persistency/rules", icon: SlidersHorizontal },
  { key: "queues", label: "Work queues", to: "/persistency/work", icon: ListChecks },
  { key: "war-room", label: "Month-end war room", to: "/persistency/collections", icon: Flame },
  { key: "where-we-sit", label: "Where Desible sits", to: "/persistency/where-desible-sits", icon: Network },
  { key: "data", label: "Data and integrations", to: "/persistency/data", icon: Database },
  { key: "guardrails", label: "Guardrails", to: "/persistency/contact-policy", icon: ShieldCheck },
  { key: "measurement", label: "Measurement", to: "/persistency/reports", icon: LineChart },
  { key: "setup", label: "Setup", to: "/persistency/admin", icon: Settings2 },
];

export function pageLabelForPath(pathname: string): string | null {
  if (pathname === "/persistency" || pathname === "/persistency/") return "Control Tower";
  if (pathname.startsWith("/persistency/work")) return "Work queues";
  if (pathname.startsWith("/persistency/workflows")) return "Workflows";
  const hit = NAV_ITEMS.find((n) => n.to !== "/persistency" && pathname.startsWith(n.to));
  return hit?.label ?? null;
}
