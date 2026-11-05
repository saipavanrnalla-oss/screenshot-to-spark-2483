import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ds/primitives";
import { StatusChip } from "@/components/r1/status-chip";
import { selectCls } from "@/components/r1/tabs";
import { SCRIPT_LIBRARY, type Approval, type ScriptVariant } from "@/data/persistency/r1/scripts-lib";
import { SEED_GRAPHS } from "@/data/persistency/r1/wf";
import { gate } from "@/lib/gate";
import { useUser } from "@/hooks/use-user";

export const Route = createFileRoute("/persistency/scripts")({
  beforeLoad: ({ search }) => gate("scripts", search),
  head: () => ({ meta: [{ title: "Scripts and templates · Persistency · desible.ai" }] }),
  component: ScriptsPage,
});

type Team = "marketing" | "compliance" | "legal";
const TEAMS: Team[] = ["marketing", "compliance", "legal"];

const useSignoffs = create<{ s: Record<string, Partial<Record<Team, Approval>>>; set: (id: string, t: Team, a: Approval) => void }>()(
  persist((set, get) => ({ s: {}, set: (id, t, a) => set({ s: { ...get().s, [id]: { ...get().s[id], [t]: a } } }) }), { name: "pct-script-signoffs-v1", storage: createJSONStorage(() => localStorage) }),
);

const STEP_NAMES: Record<string, string> = Object.fromEntries(
  ["R1", "R8"].flatMap((g) => SEED_GRAPHS[g]!.nodes.map((n) => [n.id, n.label] as const)).concat([["explain", "Product explanation, when the customer asks"]]),
);

function ScriptsPage() {
  const user = useUser();
  const { s: signoffs, set } = useSignoffs();
  const [channel, setChannel] = useState("All");
  const [status, setStatus] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const canSign = user?.id === "head" || user?.id === "compliance";
  const rows = useMemo(() => SCRIPT_LIBRARY.map((v) => ({ v, a: { ...v.approvals, ...signoffs[v.id] } })), [signoffs]);
  const live = (a: ScriptVariant["approvals"]) => TEAMS.every((t) => a[t] === "Approved");
  const shown = rows.filter(({ v, a }) => (channel === "All" || v.channel === channel) && (status === "All" || (status === "Live" ? live(a) : !live(a))));
  const pending = rows.filter(({ a }) => !live(a)).length;

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <PageHeader title="Scripts and templates" meta={`${SCRIPT_LIBRARY.length} items · ${pending} waiting for sign-off · each step picks the variant that fits the customer`} />
      <div className="flex flex-wrap gap-2">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectCls} aria-label="Channel">{["All", "Voice", "WhatsApp", "Brief"].map((x) => <option key={x}>{x}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label="Sign-off">{["All", "Live", "Waiting for sign-off"].map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <div className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="text-[12px] text-muted-foreground">
            <tr>{["Name", "Channel", "For", "Language", "Used at", "Marketing", "Compliance", "Legal", "Version"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map(({ v, a }) => (
              <Fragment key={v.id}>
                <tr className="cursor-pointer border-t border-border hover:bg-surface-translucent" onClick={() => setOpen(open === v.id ? null : v.id)}>
                  <td className="px-3 py-2 text-foreground">{v.name}</td>
                  <td className="px-3 py-2">{v.channel}</td>
                  <td className="px-3 py-2">{v.when.length ? v.when.map((w) => (w === "Low propensity" ? "P1 to P5" : w === "High propensity" ? "P6 to P10" : w)).join(", ") : "Everyone"}</td>
                  <td className="px-3 py-2">{v.language}</td>
                  <td className="px-3 py-2 text-[12px] text-subtle">{v.nodes.map((n) => STEP_NAMES[n] ?? n).join("; ")}</td>
                  {TEAMS.map((t) => <td key={t} className="px-3 py-2"><StatusChip tone={a[t] === "Approved" ? "ok" : a[t] === "In review" ? "risk" : "neutral"}>{a[t]}</StatusChip></td>)}
                  <td className="px-3 py-2">v{v.version}</td>
                </tr>
                {open === v.id && (
                  <tr key={`${v.id}-x`} className="border-t border-border bg-surface-translucent">
                    <td colSpan={9} className="px-3 py-3">
                      <p className="whitespace-pre-wrap text-[13px] text-foreground">{v.text}</p>
                      <p className="mt-2 text-[12px] text-muted-foreground">Words in braces are filled from the policy at send time. A step uses this text only when all three teams have approved it; until then the previous version runs.</p>
                      {canSign && !live(a) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {TEAMS.filter((t) => a[t] !== "Approved").map((t) => (
                            <Button key={t} size="sm" onClick={(e) => { e.stopPropagation(); set(v.id, t, "Approved"); toast.success(`${v.name}: ${t} approved`); }}>Approve for {t}</Button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
