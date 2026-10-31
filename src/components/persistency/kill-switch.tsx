import { useState } from "react";
import { toast } from "sonner";
import { Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusPill } from "@/components/ds/primitives";
import { WORKFLOWS } from "@/data/persistency";
import { usePersistencyStore } from "@/store/persistency";
import { cn } from "@/lib/utils";

type Pending = { scope: "global" } | { scope: "workflow"; id: string; name: string } | null;

export function KillSwitchControls({ showWorkflows = true }: { showWorkflows?: boolean }) {
  const global = usePersistencyStore((s) => s.killSwitchGlobal);
  const killed = usePersistencyStore((s) => s.killedWorkflows);
  const setGlobal = usePersistencyStore((s) => s.setKillSwitch);
  const setWorkflow = usePersistencyStore((s) => s.setWorkflowKilled);
  const [pending, setPending] = useState<Pending>(null);

  const turningOn = pending?.scope === "global" ? !global : pending?.scope === "workflow" ? !killed.includes(pending.id) : false;

  return (
    <div className="space-y-4">
      <div className={cn("flex items-center justify-between gap-3 rounded-input border p-3", global ? "border-failed/60 bg-failed/10" : "border-border bg-surface-translucent")}>
        <div className="flex items-center gap-3">
          <Power className={cn("size-5", global ? "text-failed" : "text-muted-foreground")} aria-hidden />
          <div>
            <p className="text-[13px] font-bold text-foreground">Global kill switch</p>
            <p className="text-xs text-subtle">Stops every action on every workflow. Decisions are still logged.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {global ? <StatusPill status="failed">On</StatusPill> : <StatusPill status="healthy">Off</StatusPill>}
          <Switch aria-label="Global kill switch" checked={global} onCheckedChange={() => setPending({ scope: "global" })} />
        </div>
      </div>

      {showWorkflows && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {WORKFLOWS.map((w) => {
            const on = killed.includes(w.id);
            return (
              <li key={w.id} className="flex items-center justify-between gap-2 rounded-input border border-border px-3 py-1.5">
                <span className="min-w-0 truncate text-xs text-foreground">
                  <span className="mr-1.5 font-bold text-primary">{w.id}</span>{w.name}
                </span>
                <span className="flex items-center gap-2">
                  {on && <StatusPill status="failed">Paused</StatusPill>}
                  <Switch aria-label={`Pause ${w.id} ${w.name}`} checked={on} onCheckedChange={() => setPending({ scope: "workflow", id: w.id, name: w.name })} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.scope === "global" ? (turningOn ? "Turn on the global kill switch?" : "Turn off the global kill switch?") : pending ? `${turningOn ? "Pause" : "Resume"} ${pending.id} ${pending.name}?` : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {turningOn
                ? "The engine stops sending actions immediately. Decisions keep being logged so you can see what would have happened. This is recorded in the audit log."
                : "Actions resume from the next decision. This is recorded in the audit log."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={turningOn ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (!pending) return;
                if (pending.scope === "global") {
                  setGlobal(turningOn);
                  toast(turningOn ? "Global kill switch on" : "Global kill switch off");
                } else {
                  setWorkflow(pending.id, turningOn);
                  toast(`${pending.id} ${turningOn ? "paused" : "resumed"}`);
                }
                setPending(null);
              }}
            >
              {turningOn ? "Yes, stop actions" : "Yes, resume"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
