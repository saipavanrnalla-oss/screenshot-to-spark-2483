import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ds/primitives";
import { downloadCsv } from "@/lib/csv";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  label: string;
  /** Value used for sorting and CSV export. */
  value: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  align?: "right" | "left";
  /** Hidden until switched on in the column chooser. */
  hidden?: boolean;
  sortable?: boolean;
  className?: string;
}

export function DataGrid<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  activeKey,
  selectable,
  bulkActions,
  pageSize = 25,
  csvName,
  toolbar,
  emptyText = "No rows match these filters.",
  emptyAction,
  maxHeight = 640,
  defaultSort,
  rowClassName,
  label,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: ((row: T) => void) | undefined;
  activeKey?: string | null | undefined;
  selectable?: boolean | undefined;
  bulkActions?: ((keys: string[], clear: () => void) => ReactNode) | undefined;
  pageSize?: number;
  csvName?: string | undefined;
  toolbar?: ReactNode;
  emptyText?: string;
  emptyAction?: ReactNode;
  maxHeight?: number;
  defaultSort?: { id: string; dir: "asc" | "desc" } | undefined;
  rowClassName?: ((row: T) => string | undefined) | undefined;
  label?: string | undefined;
}) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Set<string>>(() => new Set(columns.filter((c) => !c.hidden).map((c) => c.id)));

  useEffect(() => setPage(0), [rows.length]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = col.value(a);
      const y = col.value(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const pageRows = sorted.slice(current * pageSize, current * pageSize + pageSize);
  const shown = columns.filter((c) => visible.has(c.id));
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(rowKey(r)));
  const clear = () => setSelected(new Set());

  const exportCsv = () => {
    if (!csvName) return;
    const list = selected.size ? sorted.filter((r) => selected.has(rowKey(r))) : sorted;
    downloadCsv(csvName, shown.map((c) => c.label), list.map((r) => shown.map((c) => c.value(r))));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8" aria-label="Choose columns">
                <Columns3 /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-card border-border bg-popover">
              <DropdownMenuLabel className="text-[12px] text-muted-foreground">Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={visible.has(c.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) =>
                    setVisible((v) => {
                      const n = new Set(v);
                      if (on) n.add(c.id);
                      else if (n.size > 1) n.delete(c.id);
                      return n;
                    })
                  }
                  className="text-[13px]"
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {csvName && (
            <Button variant="outline" size="sm" className="h-8" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {selectable && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-primary/50 bg-card px-3 py-2 text-[13px]" role="region" aria-label="Bulk actions">
          <span className="font-medium text-foreground tabular">{num(selected.size)} selected</span>
          <span className="text-border">|</span>
          {bulkActions?.([...selected], clear)}
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={clear}>
            Clear selection
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title={emptyText} action={emptyAction} />
      ) : (
        <div className="overflow-hidden rounded-card border border-border">
          <div className="scrollbar-prism overflow-auto" style={{ maxHeight }}>
            <table className="w-full border-collapse text-[13px]" aria-label={label}>
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  {selectable && (
                    <th className="w-9 border-b border-border px-3 py-2">
                      <Checkbox
                        aria-label="Select all on this page"
                        checked={allOnPage}
                        onCheckedChange={(on) =>
                          setSelected((s) => {
                            const n = new Set(s);
                            for (const r of pageRows) on ? n.add(rowKey(r)) : n.delete(rowKey(r));
                            return n;
                          })
                        }
                      />
                    </th>
                  )}
                  {shown.map((c) => {
                    const active = sort?.id === c.id;
                    return (
                      <th key={c.id} scope="col" className={cn("whitespace-nowrap border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground", c.align === "right" ? "text-right" : "text-left")}>
                        {c.sortable === false ? (
                          c.label
                        ) : (
                          <button
                            type="button"
                            className={cn("inline-flex cursor-pointer items-center gap-1 uppercase hover:text-foreground", active && "text-foreground")}
                            onClick={() => setSort((s) => (s?.id === c.id ? (s.dir === "asc" ? { id: c.id, dir: "desc" } : null) : { id: c.id, dir: "asc" }))}
                          >
                            {c.label}
                            {active && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const k = rowKey(r);
                  return (
                    <tr
                      key={k}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={onRowClick ? () => onRowClick(r) : undefined}
                      onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r) : undefined}
                      className={cn(
                        "border-b border-border/60 transition-colors hover:bg-surface-translucent",
                        onRowClick && "cursor-pointer focus:bg-surface-translucent focus:outline-none",
                        activeKey === k && "bg-brand-tint",
                        rowClassName?.(r),
                      )}
                    >
                      {selectable && (
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label={`Select ${k}`}
                            checked={selected.has(k)}
                            onCheckedChange={(on) =>
                              setSelected((s) => {
                                const n = new Set(s);
                                on ? n.add(k) : n.delete(k);
                                return n;
                              })
                            }
                          />
                        </td>
                      )}
                      {shown.map((c) => (
                        <td key={c.id} className={cn("px-3 py-2 align-top", c.align === "right" ? "text-right tabular" : "", c.className)}>
                          {c.render ? c.render(r) : (c.value(r) ?? "")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
            <span className="tabular">
              {num(current * pageSize + 1)} to {num(Math.min(sorted.length, current * pageSize + pageSize))} of {num(sorted.length)}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-7" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <span className="tabular">
                Page {current + 1} of {pages}
              </span>
              <Button variant="ghost" size="icon" className="size-7" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
