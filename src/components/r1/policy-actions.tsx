import { useState } from "react";
import { toast } from "sonner";
import { Send, ShieldAlert, ShieldCheck, UserPlus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/r1/confirm";
import { HOLD_REASONS, type HoldReason } from "@/data/persistency/r1/common";
import { EXECUTORS } from "@/data/persistency/r1/executors";
import type { Policy } from "@/data/persistency";
import { useCan, useUser } from "@/hooks/use-user";
import { useWork } from "@/store/work";
import { isOnHold } from "./policy-model";
import { NOW_ISO } from "@/data/persistency";

export const OWNER_OPTIONS = [...EXECUTORS.map((e) => e.name), "Telecaller", "Team lead"];

/** Role-aware actions for one policy. Buttons a role may not use are hidden. */
export function PolicyActions({ policy, size = "sm" }: { policy: Policy; size?: "sm" | "default" }) {
  const user = useUser();
  const mayAct = useCan("policies.act");
  const mayHold = useCan("policies.hold");
  const mayList = useCan("lists.create") || mayAct;
  const work = useWork();
  const [dialog, setDialog] = useState<"link" | "hold" | "release" | "owner" | "visit" | null>(null);
  const held = isOnHold(policy);
  const by = user?.name ?? "User";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mayAct && !held && (
        <Button size={size} onClick={() => setDialog("link")}>
          <Send /> Send payment link
        </Button>
      )}
      {mayHold && !held && (
        <Button size={size} variant="outline" onClick={() => setDialog("hold")}>
          <ShieldAlert /> Place on hold
        </Button>
      )}
      {mayHold && held && (
        <Button size={size} variant="outline" onClick={() => setDialog("release")}>
          <ShieldCheck /> Release hold
        </Button>
      )}
      {mayAct && (
        <Button size={size} variant="outline" onClick={() => setDialog("owner")}>
          <UserPlus /> Assign owner
        </Button>
      )}
      {mayList && (
        <Button size={size} variant="outline" onClick={() => setDialog("visit")}>
          <MapPin /> Add to visit list
        </Button>
      )}

      <ConfirmDialog
        open={dialog === "link"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Send payment link"
        body={`A payment link for ${policy.policyId} goes to the registered WhatsApp number. The contact counts toward the contact limit.`}
        confirmLabel="Send"
        onConfirm={() => {
          work.sendPaymentLink(policy.policyId, by);
          toast.success(`Payment link sent for ${policy.policyId}`);
        }}
      />
      <ConfirmDialog
        open={dialog === "hold"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Place ${policy.policyId} on hold`}
        body="All outreach stops and open tasks for this policy are cancelled."
        confirmLabel="Place on hold"
        choices={HOLD_REASONS}
        reason="optional"
        reasonLabel="Note"
        destructive
        onConfirm={(r) => {
          const n = work.placeHold(policy.policyId, r.choice as HoldReason, r.reason, by);
          toast.success(`${policy.policyId} is on hold`, { description: n ? `${n} open task${n > 1 ? "s" : ""} cancelled` : "No open tasks to cancel" });
        }}
      />
      <ConfirmDialog
        open={dialog === "release"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Release hold on ${policy.policyId}`}
        confirmLabel="Release hold"
        reason="required"
        onConfirm={(r) => {
          work.releaseHold(policy.policyId, r.reason, by);
          toast.success(`Hold released on ${policy.policyId}`);
        }}
      />
      <ConfirmDialog
        open={dialog === "owner"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Assign owner"
        choices={OWNER_OPTIONS}
        choiceLabel="Owner executor"
        confirmLabel="Assign"
        onConfirm={(r) => {
          work.assignOwner([policy.policyId], r.choice, by);
          toast.success(`Owner set to ${r.choice}`);
        }}
      />
      <ConfirmDialog
        open={dialog === "visit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Add to visit list"
        body="The policy joins today's visit list for the sales officer. You can download it in Data files."
        confirmLabel="Add"
        onConfirm={() => {
          addToVisitList([policy.policyId], by, `Policy ${policy.policyId}`);
          toast.success("Added to visit list");
        }}
      />
    </div>
  );
}

export function addToVisitList(ids: string[], by: string, source: string) {
  const w = useWork.getState();
  const id = w.createList({ kind: "Visit list", to: "Sales officer", workflow: "R5", date: NOW_ISO, policyIds: ids, removedPaid: 0, removedChecks: 0, createdBy: by, source });
  for (const pid of ids) w.addActivity({ policyId: pid, step: "Added to visit list", executor: by, executorKind: "person", result: `List ${id}`, channel: "Visit" });
  return id;
}
