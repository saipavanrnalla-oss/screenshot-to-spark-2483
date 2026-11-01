import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import { userById } from "@/config/users";
import { useModulesOverride } from "@/hooks/use-chrome";
import { navVisible } from "@/lib/gate";
import { usePolicies } from "@/store/persistency";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

type Result = { kind: "policy"; id: string; label: string; sub: string } | { kind: "page"; id: string; label: string; route: string };

/** Policy number search. Press / anywhere to focus. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const policies = usePolicies();
  const override = useModulesOverride();
  const user = userById(useSession((s) => s.userId));
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const canSeePolicies = navVisible("policies", user, override);
  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const pages: Result[] = NAV.filter((n) => navVisible(n.key, user, override) && n.label.toLowerCase().includes(term)).map((n) => ({
      kind: "page",
      id: n.key,
      label: n.label,
      route: n.route,
    }));
    const found: Result[] = [];
    if (canSeePolicies) {
      for (const p of policies) {
        if (p.policyId.toLowerCase().includes(term) || p.customerName.toLowerCase().includes(term)) {
          found.push({ kind: "policy", id: p.policyId, label: p.policyId, sub: `${p.customerName} · ${p.product}` });
          if (found.length >= 8) break;
        }
      }
    }
    return [...found, ...pages];
  }, [q, policies, user, override, canSeePolicies]);

  const choose = (r: Result) => {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    if (r.kind === "policy") navigate({ to: "/persistency/policies", search: ((prev: Record<string, unknown>) => ({ ...prev, policy: r.id })) as never });
    else navigate({ to: r.route as "/persistency/stages" });
  };

  return (
    <div className="relative w-full max-w-[420px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          else if (e.key === "Enter" && results[active]) (e.preventDefault(), choose(results[active]!));
          else if (e.key === "Escape") (setOpen(false), inputRef.current?.blur());
        }}
        placeholder={canSeePolicies ? "Search policy number or page" : "Search pages"}
        aria-label="Search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-results"
        className="h-9 w-full rounded-input border border-border bg-surface-translucent pl-9 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 text-[11px] text-muted-foreground">/</kbd>
      {open && q.trim().length >= 2 && (
        <ul id="global-search-results" role="listbox" className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-card border border-border bg-popover py-1 shadow-lg">
          {results.length === 0 && <li className="px-3 py-2 text-[13px] text-muted-foreground">No match for "{q.trim()}".</li>}
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[13px]", i === active ? "bg-brand-tint" : "")}
              >
                {r.kind === "policy" ? (
                  <>
                    <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                    <span className="font-medium text-foreground tabular">{r.label}</span>
                    <span className="truncate text-muted-foreground">{r.sub}</span>
                  </>
                ) : (
                  <>
                    <Search className="size-3.5 text-muted-foreground" aria-hidden />
                    <span className="text-foreground">{r.label}</span>
                    <span className="text-muted-foreground">Page</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
