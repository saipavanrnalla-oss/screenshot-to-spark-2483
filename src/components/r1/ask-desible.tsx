import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { QUESTIONS, answer, match, type Answer, type QId } from "@/components/r1/ask-data";
import { NAV } from "@/components/shell/nav";
import { userById, type RoleId } from "@/config/users";
import { useScopedPolicies } from "@/hooks/use-shell";
import { useSession } from "@/store/session";
import { useAsk } from "@/store/ask";

/**
 * Ask Desible: the data assistant that floats over every page for the roles that see the whole book.
 * A launcher sits at the bottom right; ⌘J or Ctrl+J opens and closes it. The conversation stays as the
 * user moves between pages. Answers come from the same policy book as the dashboards.
 */

const ROLES: RoleId[] = ["head", "ops", "gm"];

const FALLBACK = "In this version I answer the four questions below. Pick one, or ask in those words.";

/** The page the user is on, named as the sidebar names it. */
function usePageName(): string | null {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hit = NAV.filter((n) => path === n.route || path.startsWith(n.route + "/")).sort((a, b) => b.route.length - a.route.length)[0];
  return hit?.label ?? null;
}

/** Reveals text a few words at a time, the way an assistant writes. */
function Typed({ text, onDone }: { text: string; onDone?: () => void }) {
  const words = useMemo(() => text.split(" "), [text]);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= words.length) { onDone?.(); return; }
    const t = window.setTimeout(() => setN((x) => Math.min(words.length, x + 2)), 28);
    return () => window.clearTimeout(t);
  }, [n, words.length, onDone]);
  return <>{words.slice(0, n).join(" ")}</>;
}

/** A row value such as "82.8%" or "37%" also gets a small bar, so the answer reads at a glance. */
function pctOf(v: string): number | null {
  const m = /^(\d+(?:\.\d+)?)%$/.exec(v.trim());
  return m ? Math.min(100, Number(m[1])) : null;
}

function AnswerCard({ a, onFollow }: { a: Answer; onFollow?: () => void }) {
  const [shown, setShown] = useState(false);
  // Bars only when the rows are shares of one whole; rates side by side read better as numbers.
  const barRows = new Set<number>();
  let total = 0;
  for (const [i, r] of (a.rows ?? []).entries()) {
    const v = pctOf(r.value);
    if (v === null || total + v > 101) break;
    total += v;
    barRows.add(i);
  }
  if (barRows.size < 2 || total < 90) barRows.clear();
  return (
    <div className="space-y-2.5 rounded-card border border-border bg-card p-3 text-[13px] shadow-sm">
      <p className="text-foreground"><Typed text={a.lead} onDone={() => setShown(true)} /></p>
      {shown && a.rows && (
        <ul className="space-y-1.5 animate-in fade-in duration-300">
          {a.rows.map((r, i) => {
            const p = barRows.has(i) ? pctOf(r.value) : null;
            return (
              <li key={r.label} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-foreground">{r.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{r.value}</span>
                </div>
                {p !== null && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${p}%` }} />
                  </div>
                )}
                {r.note && <p className="text-[12px] text-muted-foreground">{r.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {shown && a.link && (
        <Link to={a.link.to as never} onClick={onFollow} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
          {a.link.label} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground" aria-live="polite">
      <span className="flex gap-1" aria-hidden>
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-primary" />
      </span>
      Reading the policy book
    </div>
  );
}

export function AskDesible() {
  const user = userById(useSession((s) => s.userId));
  const { open, turns, setOpen, toggle, ask, clear } = useAsk();
  const { scoped } = useScopedPolicies();
  const page = usePageName();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cache = useMemo(() => new Map<QId, Answer>(), [scoped]);
  const busy = turns.some((t) => !t.ready);
  const allowed = !!user && ROLES.includes(user.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); toggle(); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, setOpen]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [turns]);

  if (!allowed) return null;

  const get = (id: QId) => {
    const hit = cache.get(id);
    if (hit) return hit;
    const a = answer(id, scoped);
    cache.set(id, a);
    return a;
  };
  const send = (q: string, id?: QId) => {
    if (!q.trim() || busy) return;
    ask(q.trim(), id ?? match(q));
    setText("");
  };
  const asked = new Set(turns.map((t) => t.qid));
  const nextUp = QUESTIONS.filter((q) => !asked.has(q.id)).slice(0, 2);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F26A1B] to-[#C2410C] py-3 pl-4 pr-5 text-[14px] font-semibold text-white shadow-lg shadow-orange-900/20 transition-transform hover:-translate-y-0.5"
          aria-label="Ask Desible about your persistency"
        >
          <span className="relative flex size-6 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/30" aria-hidden />
            <Sparkles className="relative size-4" aria-hidden />
          </span>
          Ask Desible
          <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-medium md:inline">⌘J</kbd>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Ask Desible"
          className="fixed bottom-6 right-6 z-50 flex h-[min(680px,calc(100vh-96px))] w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-orange-900/20 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <header className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-[#FFF4E2] to-background px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#F26A1B] to-[#C2410C] text-white"><Sparkles className="size-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-foreground">Ask Desible</p>
              <p className="truncate text-[12px] text-muted-foreground">From your policy book{page ? ` · ${page}` : ""}</p>
            </div>
            {turns.length > 0 && (
              <button type="button" onClick={clear} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Start a new conversation"><RotateCcw className="size-4" /></button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close"><X className="size-4" /></button>
          </header>

          <ol ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <li className="space-y-3">
                <p className="text-[13px] text-foreground">Ask about persistency in plain words: the level, where it is falling, why customers are not paying, or what to do this month.</p>
                <div className="flex flex-col gap-1.5">
                  {QUESTIONS.map((q) => (
                    <button key={q.id} type="button" onClick={() => send(q.text, q.id)} className="rounded-card border border-border px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:border-primary hover:bg-primary/5">{q.text}</button>
                  ))}
                </div>
              </li>
            )}
            {turns.map((t) => (
              <li key={t.id} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-[13px] text-primary-foreground">{t.q}</p>
                {!t.ready ? <Thinking /> : t.qid ? <AnswerCard a={get(t.qid as QId)} /> : <p className="rounded-card border border-border bg-card p-3 text-[13px] text-muted-foreground">{FALLBACK}</p>}
              </li>
            ))}
            {turns.length > 0 && !busy && nextUp.length > 0 && (
              <li className="flex flex-wrap gap-1.5">
                {nextUp.map((q) => (
                  <button key={q.id} type="button" onClick={() => send(q.text, q.id)} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:border-primary hover:text-primary">{q.text}</button>
                ))}
              </li>
            )}
          </ol>

          <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask about persistency, where it is falling, or why"
              aria-label="Your question"
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary"
            />
            <button type="submit" disabled={!text.trim() || busy} className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send"><Send className="size-4" /></button>
          </form>
        </section>
      )}
    </>
  );
}

/** A slim prompt on the Executive dashboard that opens the assistant with the question. */
export function AskBar() {
  const { ask } = useAsk();
  const [text, setText] = useState("");
  return (
    <section className="panel flex flex-col gap-3 p-4 md:flex-row md:items-center" aria-label="Ask Desible">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#F26A1B] to-[#C2410C] text-white"><Sparkles className="size-3.5" aria-hidden /></span>
        <p className="text-[14px] font-semibold text-foreground">Ask Desible</p>
      </div>
      <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { ask(text.trim(), match(text)); setText(""); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Where is 13th month persistency falling?" aria-label="Ask Desible" className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary" />
        <button type="submit" disabled={!text.trim()} className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground disabled:opacity-40"><Send className="size-4" /> Ask</button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {QUESTIONS.slice(1, 3).map((q) => (
          <button key={q.id} type="button" onClick={() => ask(q.text, q.id)} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:border-primary hover:text-primary">{q.text}</button>
        ))}
      </div>
    </section>
  );
}
