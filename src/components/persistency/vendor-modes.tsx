import { useMemo } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ds/primitives";
import { VENDORS, VENDOR_MODES, type Policy, type VendorMode } from "@/data/persistency";
import { cohortLabel } from "@/engine/persistency";
import { usePersistencyStore } from "@/store/persistency";
import { num } from "@/lib/format";

const HIGH = new Set(["A4", "A5", "High", "Band 4", "Band 5"]);
const ACTIVE = new Set(["Renewal window", "Early lapse", "Late lapse"]);

export function vendorChange(name: string, mode: VendorMode, n: number, slice: number, payout: string): string {
  if (name === "Desible") {
    if (mode === "Observe") return "Decisions are shown and logged only. No action leaves Desible; vendors run as today.";
    if (mode === "Direct") return "Desible sends each vendor its daily list and order. Desible itself makes no calls or messages.";
    return `Desible voice and WhatsApp act in the agreed slices (${num(slice)} high-risk policies in grace or early lapse now). Everything else stays with vendors.`;
  }
  if (mode === "Observe") return `Desible suggests a next action for ${num(n)} of ${name.endsWith("s") ? `${name}'` : `${name}'s`} policies in a daily file. ${name} keeps its own list and dialling; nothing it does changes.`;
  if (mode === "Direct") return `Desible sends ${name} the daily list and call order for ${num(n)} policies. ${name} still does the work and is paid as today (${payout.toLowerCase()}).`;
  return `Desible takes one agreed slice: ${num(slice)} high-risk policies in grace or early lapse. ${name} keeps the other ${num(Math.max(0, n - slice))}. Payout for the slice moves to Desible.`;
}

export function VendorCoexistenceTable({ policies }: { policies: Policy[] }) {
  const modes = usePersistencyStore((s) => s.vendorModes);
  const setMode = usePersistencyStore((s) => s.setVendorMode);
  const activeCohortSet = usePersistencyStore((s) => s.activeCohortSet);
  const counts = useMemo(() => {
    const out: Record<string, { n: number; slice: number }> = {};
    for (const v of VENDORS) out[v.name] = { n: 0, slice: 0 };
    let desibleSlice = 0;
    for (const p of policies) {
      if (!ACTIVE.has(p.lifecycleStage)) continue;
      const highSlice = HIGH.has(cohortLabel(p, activeCohortSet[p.product])) && (p.state === "Grace" || p.state === "Lapsed early");
      if (highSlice) desibleSlice++;
      const c = out[p.assignedVendor];
      if (!c) continue;
      c.n++;
      if (highSlice) c.slice++;
    }
    out["Desible"] = { n: out["Desible"]?.n ?? 0, slice: desibleSlice };
    return out;
  }, [policies, activeCohortSet]);

  return (
    <DataTable head={["Vendor", "What they do today", "Payout", "Mode", "What changes in the next 30 days"]} minWidth={980}>
      {VENDORS.map((v) => {
        const mode = modes[v.id] ?? v.defaultMode;
        const c = counts[v.name] ?? { n: 0, slice: 0 };
        return (
          <tr key={v.id} className="align-top">
            <td className="font-semibold text-foreground">{v.name}</td>
            <td className="text-subtle">{v.does}</td>
            <td className="text-subtle">{v.payout}</td>
            <td>
              <Select
                value={mode}
                onValueChange={(m) => {
                  setMode(v.id, m as VendorMode);
                  toast(`${v.name} set to ${m}`, { description: vendorChange(v.name, m as VendorMode, c.n, c.slice, v.payout) });
                }}
              >
                <SelectTrigger aria-label={`Mode for ${v.name}`} className="h-8 w-40 rounded-input border-border bg-surface-translucent text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {VENDOR_MODES.map((m) => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </td>
            <td className="max-w-[420px] text-foreground">{vendorChange(v.name, mode, c.n, c.slice, v.payout)}</td>
          </tr>
        );
      })}
    </DataTable>
  );
}
