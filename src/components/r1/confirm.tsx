import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NOW_ISO } from "@/data/persistency";

export interface ConfirmResult {
  reason: string;
  date: string;
  choice: string;
}

/** Confirm dialog with an optional required reason, date and choice. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  reason,
  reasonLabel = "Reason",
  date,
  dateLabel = "Effective from",
  choices,
  choiceLabel = "Reason",
  destructive,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  /** "required" shows a reason box that must be filled. */
  reason?: "required" | "optional" | undefined;
  reasonLabel?: string;
  date?: boolean | undefined;
  dateLabel?: string;
  choices?: readonly string[] | undefined;
  choiceLabel?: string;
  destructive?: boolean | undefined;
  onConfirm: (r: ConfirmResult) => void;
  children?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [day, setDay] = useState("2026-11-01");
  const [choice, setChoice] = useState(choices?.[0] ?? "");
  useEffect(() => {
    if (open) {
      setText("");
      setDay(NOW_ISO < "2026-11-01" ? "2026-11-01" : NOW_ISO);
      setChoice(choices?.[0] ?? "");
    }
  }, [open, choices]);
  const blocked = reason === "required" && !text.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-card border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold">{title}</DialogTitle>
          {body && <DialogDescription className="text-[13px] text-subtle">{body}</DialogDescription>}
        </DialogHeader>
        {children}
        {choices && (
          <label className="block text-[12px] font-medium text-muted-foreground">
            {choiceLabel}
            <select value={choice} onChange={(e) => setChoice(e.target.value)} className="mt-1 block h-8 w-full rounded-input border border-border bg-surface-translucent px-2 text-[13px] text-foreground">
              {choices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        {date && (
          <label className="block text-[12px] font-medium text-muted-foreground">
            {dateLabel}
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 block h-8 w-full rounded-input border border-border bg-surface-translucent px-2 text-[13px] text-foreground" />
          </label>
        )}
        {reason && (
          <label className="block text-[12px] font-medium text-muted-foreground">
            {reasonLabel}
            {reason === "required" && <span className="text-failed"> *</span>}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-1 block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px] text-foreground" />
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={blocked || (date && !day)}
            onClick={() => {
              onConfirm({ reason: text.trim(), date: day, choice });
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
