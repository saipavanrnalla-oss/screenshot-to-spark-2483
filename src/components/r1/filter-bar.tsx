import { useMemo, useState } from "react";
import { Bookmark, ChevronDown, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWork } from "@/store/work";
import { date } from "@/lib/format";

export interface FilterField {
  id: string;
  label: string;
  options?: readonly string[];
  /** "range" uses two dates stored as from..to. */
  type?: "select" | "range";
}

export type Filters = Record<string, string | undefined>;

export function rangeOf(v: string | undefined): [string, string] {
  const [a, b] = (v ?? "").split("..");
  return [a ?? "", b ?? ""];
}

/** Filter bar with removable chips and saved views. Values live with the page (usually in the URL). */
export function FilterBar({ page, fields, values: raw, onChange }: { page: string; fields: FilterField[]; values: object; onChange: (v: Filters) => void }) {
  const values = raw as Filters;
  const allViews = useWork((s) => s.savedViews);
  const views = useMemo(() => allViews.filter((v) => v.page === page), [allViews, page]);
  const saveView = useWork((s) => s.saveView);
  const deleteView = useWork((s) => s.deleteView);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const active = fields.filter((f) => values[f.id]);
  const set = (id: string, v: string | undefined) => onChange({ ...values, [id]: v || undefined });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {fields.map((f) =>
          f.type === "range" ? (
            <div key={f.id} className="flex items-center gap-1 rounded-input border border-border bg-surface-translucent px-2">
              <span className="text-[12px] text-muted-foreground">{f.label}</span>
              <input
                type="date"
                aria-label={`${f.label} from`}
                value={rangeOf(values[f.id])[0]}
                onChange={(e) => set(f.id, `${e.target.value}..${rangeOf(values[f.id])[1]}`.replace(/^\.\.$/, ""))}
                className="h-8 bg-transparent text-[12px] text-foreground"
              />
              <span className="text-[12px] text-muted-foreground">to</span>
              <input
                type="date"
                aria-label={`${f.label} to`}
                value={rangeOf(values[f.id])[1]}
                onChange={(e) => set(f.id, `${rangeOf(values[f.id])[0]}..${e.target.value}`.replace(/^\.\.$/, ""))}
                className="h-8 bg-transparent text-[12px] text-foreground"
              />
            </div>
          ) : (
            <select
              key={f.id}
              aria-label={f.label}
              value={values[f.id] ?? ""}
              onChange={(e) => set(f.id, e.target.value)}
              className={`h-8 rounded-input border bg-surface-translucent px-2 text-[13px] ${values[f.id] ? "border-primary text-foreground" : "border-border text-subtle"}`}
            >
              <option value="">{f.label}: all</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ),
        )}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Bookmark /> Saved views <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-card border-border bg-popover">
              <DropdownMenuItem onSelect={() => (setName(""), setNaming(true))} disabled={active.length === 0}>
                Save current filters
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[12px] text-muted-foreground">{views.length ? "Saved views" : "No saved views"}</DropdownMenuLabel>
              {views.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => onChange(v.filters)} className="flex items-center justify-between">
                  <span>{v.name}</span>
                  <button
                    type="button"
                    aria-label={`Delete view ${v.name}`}
                    className="text-muted-foreground hover:text-failed"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteView(v.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1 rounded-pill border border-primary/60 px-2 py-0.5 text-[12px] text-foreground">
              <span className="text-muted-foreground">{f.label}:</span>
              {f.type === "range" ? rangeOf(values[f.id]).map((d) => (d ? date(d) : "any")).join(" to ") : values[f.id]}
              <button type="button" aria-label={`Remove ${f.label} filter`} onClick={() => set(f.id, undefined)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange(Object.fromEntries(fields.map((f) => [f.id, undefined])))} className="text-[12px] text-primary hover:underline">
            Clear all
          </button>
        </div>
      )}
      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent className="max-w-sm rounded-card border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold">Save view</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="View name" aria-label="View name" className="h-8 text-[13px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNaming(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                saveView({ page, name: name.trim(), filters: Object.fromEntries(Object.entries(values).filter(([, v]) => v)) as Record<string, string> });
                toast.success(`View saved: ${name.trim()}`);
                setNaming(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
