import { useMemo } from "react";
import { NOW, DAY_MS } from "@/data/persistency";
import type { NavKey } from "@/config/users";
import { ADAPTERS } from "@/data/persistency/r1/files";
import { TASKS, agentName } from "@/data/persistency/r1/tasks";
import { useModulesOverride } from "@/hooks/use-chrome";
import { useUser } from "@/hooks/use-user";
import { navVisible } from "@/lib/gate";
import { usePersistencyStore } from "@/store/persistency";
import { useQueue, useWork } from "@/store/work";

export interface Notice {
  id: string;
  text: string;
  to: string;
  params?: Record<string, string> | undefined;
  search?: Record<string, string> | undefined;
  needs: NavKey;
  tone: "off" | "risk" | "neutral";
}

const BREACHES = TASKS.filter((t) => t.agentId === "quality" && t.conduct.some((c) => !c.pass) && NOW.getTime() - new Date(t.at).getTime() < 2 * DAY_MS).length;

/** Bell items: approvals, returns, late files, paused agents, overdue tasks, breaches, finished experiments. */
export function useNotices(): Notice[] {
  const user = useUser();
  const override = useModulesOverride();
  const approvals = useWork((s) => s.approvals);
  const pauses = useWork((s) => s.agentPause);
  const imported = useWork((s) => s.imported);
  const experiments = useWork((s) => s.experiments);
  const pausedAll = usePersistencyStore((s) => s.killSwitchGlobal);
  const queue = useQueue();
  return useMemo(() => {
    const out: Notice[] = [];
    const role = user?.id;
    const mine = approvals.filter((a) => a.status === "waiting" && role && a.needs.includes(role) && !a.signoffs.some((x) => x.role === role));
    if (mine.length) out.push({ id: "approvals", text: `${mine.length} approval${mine.length > 1 ? "s" : ""} waiting for you`, to: "/persistency/approvals", needs: "approvals", tone: "neutral" });
    for (const a of approvals.filter((x) => x.status === "returned" && x.requestedBy === user?.name).slice(0, 3)) {
      out.push({ id: `ret-${a.id}`, text: `Version returned: ${a.objectName}`, to: "/persistency/approvals", search: { tab: "history", open: a.id }, needs: "approvals", tone: "risk" });
    }
    for (const f of ADAPTERS.filter((x) => x.overdue && !(x.id === "bounce" && imported["bounce"]))) {
      out.push({ id: `file-${f.id}`, text: `${f.name} overdue`, to: "/persistency/data/files/$id", params: { id: f.id }, needs: "data", tone: "risk" });
    }
    if (pausedAll) out.push({ id: "pause-all", text: "All outreach is paused", to: "/persistency/agents", search: { tab: "settings" }, needs: "agents", tone: "off" });
    for (const id of Object.keys(pauses)) out.push({ id: `agent-${id}`, text: `${agentName(id)} paused`, to: "/persistency/agents/$id", params: { id }, needs: "agents", tone: "off" });
    const overdue = queue.filter((q) => q.status === "Overdue" && !q.closed).length;
    if (overdue) out.push({ id: "overdue", text: `${overdue} tasks overdue`, to: "/persistency/agents", search: { tab: "queue", status: "Overdue" }, needs: "agents", tone: "risk" });
    if (BREACHES) out.push({ id: "breach", text: `${BREACHES} contact-rule breach${BREACHES > 1 ? "es" : ""} flagged by the quality agent`, to: "/persistency/agents/$id", params: { id: "quality" }, search: { tab: "tasks", result: "Handed off" }, needs: "agents", tone: "off" });
    const ready = experiments.filter((e) => e.status === "Finished");
    if (ready.length) out.push({ id: "exp", text: `Experiment results ready: ${ready.map((e) => e.id).join(", ")}`, to: "/persistency/reports", search: { tab: "experiments" }, needs: "reports", tone: "neutral" });
    return out.filter((n) => navVisible(n.needs, user, override));
  }, [user, override, approvals, pauses, imported, experiments, pausedAll, queue]);
}
