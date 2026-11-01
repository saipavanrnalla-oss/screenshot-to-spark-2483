import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ChevronRight, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { PERSONAS } from "@/config/personas";
import { userById } from "@/config/users";
import { INSURER_NAME, PRODUCT_FILTERS } from "@/data/persistency";
import { useChrome, useModulesOverride } from "@/hooks/use-chrome";
import { useShell } from "@/hooks/use-shell";
import { navVisible } from "@/lib/gate";
import { usePersistencyStore } from "@/store/persistency";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";
import { NAV, navForPath } from "./nav";
import { Wordmark } from "./wordmark";
import { GlobalSearch } from "./global-search";
import { HelpMenu, NotificationBell, UserMenu } from "./top-menus";

const BANNER_KEY = "pct-demo-banner-dismissed";
const SIDEBAR_KEY = "pct-sidebar-collapsed";

function readStorage(store: "local" | "session", key: string): string | null {
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(store: "local" | "session", key: string, value: string) {
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** Old first-brief banner. Hidden unless CHROME.showDemoBanner. */
function DemoBanner() {
  const show = useChrome("showDemoBanner");
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (readStorage("session", BANNER_KEY) === "1") setHidden(true);
  }, []);
  if (!show || hidden) return null;
  return (
    <div className="flex items-center justify-center gap-3 border-b border-border bg-surface px-4 py-1.5 text-[12px] text-subtle">
      <span>Demo data. Policies are synthetic. Payments, mandates and bureau responses are simulated.</span>
      <button
        type="button"
        onClick={() => {
          writeStorage("session", BANNER_KEY, "1");
          setHidden(true);
        }}
        className="cursor-pointer rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss banner for this session"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function PauseBanner() {
  const on = usePersistencyStore((s) => s.killSwitchGlobal);
  if (!on) return null;
  return (
    <div role="alert" className="border-b border-failed/50 bg-failed/15 px-4 py-2 text-center text-[13px] font-semibold text-failed">
      All outreach is paused. Decisions are recorded and nothing is sent.
    </div>
  );
}

/** Old persona switcher, product switch and insurer chip. Hidden unless CHROME.showPersonaBar. */
function PersonaBar() {
  const show = useChrome("showPersonaBar");
  const { persona, product, setProduct } = useShell();
  const navigate = useNavigate();
  const enabled = usePersistencyStore((s) => s.enabledPersonas);
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-2">
      <TierBadge tiers={["live-engine", "live-channels", "simulated"]} />
      <Select
        value={persona.id}
        onValueChange={(id) => {
          if (id === "head") navigate({ to: "/persistency", search: (prev) => ({ ...prev, as: id }) });
          else navigate({ to: "/persistency/work/$persona", params: { persona: id }, search: (prev) => ({ ...prev, as: id }) });
        }}
      >
        <SelectTrigger aria-label="Viewing as persona" className="h-8 w-[210px] rounded-input border-border bg-surface-translucent text-xs font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-input border-border bg-card">
          {PERSONAS.map((p, i) => ({ p, i })).filter(({ p }) => enabled.includes(p.id) || p.id === persona.id).map(({ p, i }) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              <span className="mr-1.5 text-dim tabular">{String(i + 1).padStart(2, "0")}</span>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SegmentedControl label="Product" value={product} options={PRODUCT_FILTERS} onChange={setProduct} />
      <Link
        to="/persistency/admin"
        className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1 text-xs font-semibold text-subtle hover:text-foreground"
      >
        <Building2 className="size-3.5" aria-hidden />
        {INSURER_NAME}
      </Link>
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-5">
        <div className="flex shrink-0 items-center gap-2">
          <Wordmark />
          <span className="text-[13px] text-muted-foreground">Persistency</span>
        </div>
        <GlobalSearch />
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <HelpMenu />
          <UserMenu />
        </div>
      </div>
      <PersonaBar />
    </header>
  );
}

function Breadcrumb() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const override = useModulesOverride();
  const user = userById(useSession((s) => s.userId));
  const entry = navForPath(pathname);
  if (!entry || !navVisible(entry.key, user, override)) return null;
  const deeper = pathname.replace(/\/$/, "") !== entry.route;
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-[12px] text-muted-foreground">
      <span>Persistency</span>
      <ChevronRight className="size-3.5 text-dim" aria-hidden />
      {deeper ? (
        <Link to={entry.route as "/persistency/stages"} className="hover:text-foreground">
          {entry.label}
        </Link>
      ) : (
        <span className="text-subtle">{entry.label}</span>
      )}
    </nav>
  );
}

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const override = useModulesOverride();
  const user = userById(useSession((s) => s.userId));
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (readStorage("local", SIDEBAR_KEY) === "1") setCollapsed(true);
  }, []);
  const items = NAV.filter((n) => navVisible(n.key, user, override));
  const current = navForPath(pathname);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
      aria-label="Persistency navigation"
    >
      <div className={cn("flex h-14 items-center border-b border-sidebar-border px-4", collapsed ? "justify-center" : "justify-end")}>
        <button
          type="button"
          onClick={() => {
            setCollapsed((c) => {
              writeStorage("local", SIDEBAR_KEY, c ? "0" : "1");
              return !c;
            });
          }}
          className="cursor-pointer rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      <nav className="scrollbar-prism flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {items.map((item) => {
            const active = current?.key === item.key;
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  to={item.route as "/persistency/stages"}
                  className={cn(
                    "flex items-center gap-3 rounded-md py-2 text-[13px] font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "px-3",
                    active ? "bg-brand-tint text-primary" : "text-sidebar-foreground hover:bg-surface-translucent hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {!collapsed && <div className="border-t border-sidebar-border px-4 py-3 text-[12px] text-muted-foreground">Sample data</div>}
    </aside>
  );
}

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <PauseBanner />
        <TopBar />
        <main className="flex-1 px-6 py-5 xl:px-8">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
