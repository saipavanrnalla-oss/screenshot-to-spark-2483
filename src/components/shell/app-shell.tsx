import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ChevronRight, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { PERSONAS } from "@/config/personas";
import { INSURER_NAME, PRODUCT_FILTERS } from "@/data/persistency";
import { useShell } from "@/hooks/use-shell";
import { usePersistencyStore } from "@/store/persistency";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, pageLabelForPath } from "./nav";
import { Wordmark } from "./wordmark";

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

function DemoBanner() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (readStorage("session", BANNER_KEY) === "1") setHidden(true);
  }, []);
  if (hidden) return null;
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
        aria-label="Dismiss demo banner for this session"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function KillSwitchBanner() {
  const on = usePersistencyStore((s) => s.killSwitchGlobal);
  if (!on) return null;
  return (
    <div role="alert" className="border-b border-failed/50 bg-failed/15 px-4 py-2 text-center text-[13px] font-semibold text-failed">
      Kill switch is on. The engine has stopped acting on every workflow. Decisions are logged but not sent.
    </div>
  );
}

function PersonaSwitcher() {
  const { persona } = useShell();
  const navigate = useNavigate();
  const enabled = usePersistencyStore((s) => s.enabledPersonas);
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[11px] text-muted-foreground xl:inline">Viewing as</span>
      <Select
        value={persona.id}
        onValueChange={(id) => {
          if (id === "head") navigate({ to: "/persistency", search: (prev) => ({ as: id, product: prev.product }) });
          else navigate({ to: "/persistency/work/$persona", params: { persona: id }, search: (prev) => ({ as: id, product: prev.product }) });
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
    </div>
  );
}

function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const page = pageLabelForPath(pathname);
  const { product, setProduct } = useShell();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
        <Wordmark />
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
          <ChevronRight className="size-3.5 text-dim" aria-hidden />
          <span>Insurance</span>
          <ChevronRight className="size-3.5 text-dim" aria-hidden />
          <Link to="/persistency" className="hover:text-foreground">Persistency</Link>
          {page && page !== "Control Tower" && (
            <>
              <ChevronRight className="size-3.5 text-dim" aria-hidden />
              <span className="text-subtle">{page}</span>
            </>
          )}
        </nav>
        <TierBadge tiers={["live-engine", "live-channels", "simulated"]} className="hidden 2xl:inline-flex" />
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <PersonaSwitcher />
          <SegmentedControl label="Product" value={product} options={PRODUCT_FILTERS} onChange={setProduct} />
          <Link
            to="/persistency/admin"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1 text-xs font-semibold text-subtle hover:border-brand-tint-border hover:text-foreground"
          >
            <Building2 className="size-3.5" aria-hidden />
            {INSURER_NAME}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { persona } = useShell();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (readStorage("local", SIDEBAR_KEY) === "1") setCollapsed(true);
  }, []);
  const items = NAV_ITEMS.filter((n) => persona.nav.includes(n.key));

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
      aria-label="Persistency navigation"
    >
      <div className={cn("flex h-[53px] items-center border-b border-sidebar-border px-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && <span className="eyebrow">Persistency</span>}
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
      <nav className="scrollbar-prism flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              item.key === "control-tower"
                ? pathname === "/persistency" || pathname === "/persistency/"
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            const cls = cn(
              "flex items-center gap-3 border-l-[3px] py-2 text-[13px] font-semibold transition-colors",
              collapsed ? "justify-center px-0" : "px-4",
              active
                ? "border-primary bg-brand-tint text-foreground"
                : "border-transparent text-sidebar-foreground hover:bg-surface-translucent hover:text-foreground",
            );
            return (
              <li key={item.key}>
                {item.key === "queues" ? (
                  <Link to="/persistency/work/$persona" params={{ persona: persona.id }} className={cls} title={collapsed ? item.label : undefined}>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {!collapsed && item.label}
                  </Link>
                ) : (
                  <Link to={item.to as "/persistency"} className={cls} title={collapsed ? item.label : undefined}>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {!collapsed && item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {!collapsed && (
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-dim">
          Viewing as <span className="font-semibold text-subtle">{persona.label}</span>
          <br />
          Today: 28 Oct 2026
        </div>
      )}
    </aside>
  );
}

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <KillSwitchBanner />
        <TopBar />
        <main className="flex-1 px-6 py-6 xl:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
