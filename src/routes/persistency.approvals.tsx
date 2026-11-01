import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, EmptyState, PageHeader, PillTabs } from "@/components/ds/primitives";
import { can, userById } from "@/config/users";
import { NOW_ISO } from "@/data/persistency";
import { policyDimensions, ruleMatches } from "@/engine/persistency";
import { gate } from "@/lib/gate";
import { dateTime, num } from "@/lib/format";
import { useEngineContext, usePersistencyStore, usePolicies, type PendingChange } from "@/store/persistency";
import { useSession } from "@/store/session";

export const Route = createFileRoute("/persistency/approvals")({
  beforeLoad: ({ search }) => gate("approvals", search),
  head: () => ({
    meta: [
      { title: "Approvals · Persistency · desible.ai" },
      { name: "description", content: "Rule, workflow, agent and stage setting changes waiting for approval, and decided items." },
      { property: "og:title", content: "Approvals · Persistency · desible.ai" },
      { property: "og:description", content: "Rule, workflow, agent and stage setting changes waiting for approval, and decided items." },
    ],
  }),
  component: ApprovalsPage,
});

const TYPE_LABEL: Record<PendingChange["source"], string> = {
  "Rule edit": "Rule change",
  "Product matrix": "Rule change",
  "War-room recommendation": "Rule change",
  "Learn step": "Proposed change",
};

function ageLabel(at: string): string {
  const hours = Math.max(0, Math.round((new Date(NOW_ISO).getTime() - new Date(at).getTime()) / 3_600_000));
  return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}

function ApprovalsPage() {
  const user = userById(useSession((s) => s.userId));
  const pending = usePersistencyStore((s) => s.pending);
  const audit = usePersistencyStore((s) => s.audit);
  const approve = usePersistencyStore((s) => s.approve);
  const reject = usePersistencyStore((s) => s.reject);
  const policies = usePolicies();
  const ctx = useEngineContext();
  const [tab, setTab] = useState<"waiting" | "history">("waiting");
  const [approving, setApproving] = useState<PendingChange | null>(null);
  const [returning, setReturning] = useState<PendingChange | null>(null);
  const [effective, setEffective] = useState("");
  const [reason, setReason] = useState("");
  const mayApprove = can(user, "rules.approve");

  const reach = useMemo(() => {
    const dims = policies.map((p) => policyDimensions(p, ctx));
    return new Map(pending.map((c) => [c.id, dims.filter((d) => ruleMatches(c.rule, d)).length]));
  }, [pending, policies, ctx]);

  const history = useMemo(() => audit.filter((a) => /^(Approved|Returned|Rejected):/.test(a.detail)), [audit]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader title="Approvals" meta={`${pending.length} waiting`} />
      <PillTabs
        label="Approvals"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "waiting", label: `Waiting (${pending.length})` },
          { id: "history", label: "History" },
        ]}
      />

      {tab === "waiting" &&
        (pending.length === 0 ? (
          <EmptyState title="Nothing is waiting for approval." />
        ) : (
          <DataTable head={["Type", "Object", "Requested by", "What changes", "Reach (policies)", "Age", ""]} minWidth={880}>
            {pending.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap">{TYPE_LABEL[c.source]}</td>
                <td className="font-medium text-foreground">{c.title}</td>
                <td className="whitespace-nowrap text-subtle">{c.proposedBy}</td>
                <td className="text-subtle">{c.effect ?? c.rule.then.action}</td>
                <td className="text-right tabular">{num(reach.get(c.id) ?? 0)}</td>
                <td className="whitespace-nowrap tabular">{ageLabel(c.at)}</td>
                <td className="whitespace-nowrap text-right">
                  {mayApprove && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => (setReturning(c), setReason(""))}>
                        Return
                      </Button>
                      <Button size="sm" onClick={() => (setApproving(c), setEffective(c.rule.effectiveFrom))}>
                        Approve
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        ))}

      {tab === "history" &&
        (history.length === 0 ? (
          <EmptyState title="No decided items yet." />
        ) : (
          <DataTable head={["Time", "Decision", "By"]} minWidth={760}>
            {history.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap tabular">{dateTime(a.at)}</td>
                <td className="text-foreground">{a.detail.replace(/^Rejected:/, "Returned:")}</td>
                <td className="whitespace-nowrap text-subtle">{a.actor}</td>
              </tr>
            ))}
          </DataTable>
        ))}

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="max-w-md rounded-card border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold">Approve change</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-subtle">{approving?.title}</p>
          <label className="block text-[12px] font-medium text-muted-foreground">
            Effective from
            <input
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
              className="mt-1 block h-8 w-full rounded-input border border-border bg-surface-translucent px-2 text-[13px] text-foreground"
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button
              disabled={!effective}
              onClick={() => {
                if (!approving) return;
                approve(approving.id, user?.name, effective);
                toast.success(`Approved: ${approving.title}`);
                setApproving(null);
              }}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!returning} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent className="max-w-md rounded-card border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold">Return change</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-subtle">{returning?.title}</p>
          <label className="block text-[12px] font-medium text-muted-foreground">
            Reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-input border border-border bg-surface-translucent px-2 py-1.5 text-[13px] text-foreground"
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                if (!returning) return;
                reject(returning.id, user?.name, reason.trim());
                toast.success(`Returned: ${returning.title}`);
                setReturning(null);
              }}
            >
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
