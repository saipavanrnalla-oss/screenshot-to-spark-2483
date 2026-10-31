import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/ds/primitives";
import { TierBadge } from "@/components/ds/tier-badge";
import { usePersistencyStore } from "@/store/persistency";

function mask(n: string): string {
  const digits = n.replace(/\D/g, "");
  return digits.length > 4 ? `${"•".repeat(digits.length - 4)}${digits.slice(-4)}` : n;
}

/** Live channels: test sends only go to a registered test number, and never show delivered or answered. */
export function SendTestButton({ what, size = "sm" }: { what: string; size?: "sm" | "default" }) {
  const testNumber = usePersistencyStore((s) => s.testNumber);
  const log = usePersistencyStore((s) => s.log);
  const [open, setOpen] = useState(false);
  const [queued, setQueued] = useState(false);

  return (
    <>
      <Button variant="outline" size={size} onClick={() => { setQueued(false); setOpen(true); }}>
        <Send /> Send test
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send a test</DialogTitle>
            <DialogDescription>{what}</DialogDescription>
          </DialogHeader>
          {!testNumber ? (
            <div className="space-y-3">
              <StatusPill status="attention">Needs a registered test number</StatusPill>
              <p className="text-sm text-subtle">Test sends only go to a number registered in Setup. Customers are never contacted from a test.</p>
              <Link to="/persistency/setup" className="text-xs font-semibold text-primary hover:underline">Register a test number in Setup</Link>
            </div>
          ) : queued ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status="simulated">Queued (simulated in this build)</StatusPill>
                <TierBadge tiers={["simulated"]} />
              </div>
              <p className="text-sm text-subtle">Queued for {mask(testNumber)}. This build does not send, so there is no delivered or answered state.</p>
            </div>
          ) : (
            <p className="text-sm text-subtle">This will queue a test to your registered number {mask(testNumber)}.</p>
          )}
          <DialogFooter>
            {testNumber && !queued && (
              <Button
                onClick={() => {
                  setQueued(true);
                  log({ actor: "Test send", kind: "setting", detail: `Test queued (simulated): ${what}` });
                }}
              >
                Queue test
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
