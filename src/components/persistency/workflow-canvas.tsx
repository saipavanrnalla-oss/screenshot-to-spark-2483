import { useMemo } from "react";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowNodeDef, WorkflowGraph } from "@/data/persistency";
import { cn } from "@/lib/utils";
import { NodeChip } from "./node-chip";

type StepNode = Node<{ def: FlowNodeDef; selected: boolean }, "step">;

function StepNodeView({ data }: NodeProps<StepNode>) {
  const { def, selected } = data;
  return (
    <div
      className={cn(
        "w-[210px] cursor-pointer rounded-input border bg-card px-3 py-2 text-left shadow-none transition-colors",
        selected ? "border-primary bg-brand-tint" : def.kind === "Stub" ? "border-dashed border-simulated" : "border-border hover:border-brand-tint-border",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-border" />
      <NodeChip kind={def.kind} />
      <p className="mt-1 text-[12px] font-semibold leading-snug text-foreground">{def.label}</p>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-border" />
    </div>
  );
}

const nodeTypes = { step: StepNodeView };

export default function WorkflowCanvas({ graph, selectedId, onSelect }: { graph: WorkflowGraph; selectedId: string | null; onSelect: (id: string) => void }) {
  const nodes: StepNode[] = useMemo(
    () => graph.nodes.map((d) => ({ id: d.id, type: "step" as const, position: { x: d.x, y: d.y }, data: { def: d, selected: d.id === selectedId }, draggable: false })),
    [graph, selectedId],
  );
  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e, i) => ({
        id: `e${i}`,
        source: e.from,
        target: e.to,
        ...(e.label ? { label: e.label } : {}),
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-foreground)" },
        style: { stroke: "var(--muted-foreground)", strokeWidth: 1.25 },
        labelStyle: { fill: "var(--text-secondary)", fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: "var(--card)" },
        labelBgPadding: [4, 2] as [number, number],
      })),
    [graph],
  );
  return (
    <div className="prism-flow h-[520px] w-full overflow-hidden rounded-card border border-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => onSelect(n.id)}
        minZoom={0.3}
      >
        <Background color="var(--border)" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
