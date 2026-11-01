import { createFileRoute } from "@tanstack/react-router";
import { DataTable, PageHeader } from "@/components/ds/primitives";
import { AGENTS, type AgentStatus } from "@/data/persistency";
import { gate } from "@/lib/gate";
import { cn } from "@/lib/utils";
import { usePersistencyStore } from "@/store/persistency";

export const Route = createFileRoute("/persistency/agents")({
  beforeLoad: ({ search }) => gate("agents", search),
  head: () => ({
    meta: [
      { title: "Agents · Persistency · desible.ai" },
      { name: "description", content: "Agents that send messages, make renewal calls, classify reasons, assist payments, summarise handoffs and check quality." },
      { property: "og:title", content: "Agents · Persistency · desible.ai" },
      { property: "og:description", content: "Agents that send messages, make renewal calls, classify reasons, assist payments, summarise handoffs and check quality." },
    ],
  }),
  component: AgentsPage,
});

const DOT: Record<AgentStatus, string> = { Active: "bg-healthy", Paused: "bg-failed", "Not enabled": "bg-simulated" };

function StatusChip({ status }: { status: AgentStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-foreground">
      <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden />
      {status}
    </span>
  );
}

function AgentsPage() {
  const killed = usePersistencyStore((s) => s.killedWorkflows);
  const active = AGENTS.filter((a) => a.status === "Active").length;
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader title="Agents" meta={`${active} active · ${AGENTS.length - active} not enabled`} />
      <DataTable head={["Name", "Type", "Status", "Version", "Workflows served", "What it does"]} minWidth={900}>
        {AGENTS.map((a) => (
          <tr key={a.id} className={a.status === "Not enabled" ? "text-muted-foreground" : ""}>
            <td className="whitespace-nowrap font-medium text-foreground">{a.name}</td>
            <td className="whitespace-nowrap">{a.type}</td>
            <td>
              <StatusChip status={a.status} />
            </td>
            <td className="tabular">v{a.version}</td>
            <td className="whitespace-nowrap tabular">
              {a.workflows.length === 0
                ? "None"
                : a.workflows.map((w) => (
                    <span key={w} className={cn("mr-1.5", killed.includes(w) && "text-failed")}>
                      {w}
                    </span>
                  ))}
            </td>
            <td className="text-subtle">{a.does}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
