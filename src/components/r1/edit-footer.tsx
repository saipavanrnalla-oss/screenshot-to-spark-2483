import type { ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

/** Asks before leaving a page with unsaved changes. */
export function LeaveGuard({ dirty }: { dirty: boolean }) {
  const { proceed, reset, status } = useBlocker({ shouldBlockFn: () => dirty, withResolver: true, enableBeforeUnload: dirty });
  return (
    <AlertDialog open={status === "blocked"} onOpenChange={(o) => !o && reset?.()}>
      <AlertDialogContent className="rounded-card border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[14px] font-semibold">Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px]">Your changes on this page are not saved.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => reset?.()}>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={() => proceed?.()}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Sticky footer on edit screens: Save draft, Discard, Submit for review. */
export function EditFooter({
  dirty,
  onSave,
  onDiscard,
  onSubmit,
  submitDisabled,
  status,
  extra,
}: {
  dirty: boolean;
  onSave?: (() => void) | undefined;
  onDiscard?: (() => void) | undefined;
  onSubmit?: (() => void) | undefined;
  submitDisabled?: boolean | undefined;
  status?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-6 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur xl:-mx-8 xl:px-8">
      <div className="text-[12px] text-muted-foreground">{status ?? (dirty ? "Unsaved changes" : "No unsaved changes")}</div>
      <div className="flex items-center gap-2">
        {extra}
        {onDiscard && (
          <Button variant="ghost" onClick={onDiscard} disabled={!dirty}>
            Discard
          </Button>
        )}
        {onSave && (
          <Button variant="outline" onClick={onSave} disabled={!dirty}>
            Save draft
          </Button>
        )}
        {onSubmit && (
          <Button onClick={onSubmit} disabled={submitDisabled}>
            Submit for review
          </Button>
        )}
      </div>
      <LeaveGuard dirty={dirty} />
    </div>
  );
}
