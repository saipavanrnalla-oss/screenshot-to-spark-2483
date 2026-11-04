import { useEffect, useMemo, type DragEvent } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, ShieldCheck } from "lucide-react";
import { PALETTE_BY_TYPE, type WfGraph, type WfNode } from "@/data/persistency/r1/wf";
import { isOutreach } from "@/engine/workflow";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";

export type Mark = "added" | "removed" | "changed" | "path";

interface NodeData extends Record<string, unknown> {
  node: WfNode;
  selected: boolean;
  active: boolean;
  mark?: Mark | undefined;
  count?: number | undefined;
  funnel?: boolean | undefined;
  vertical?: boolean | undefined;
  total?: number | undefined;
  paused?: boolean | undefined;
}

type FlowNode = Node<NodeData, "wf">;

function NodeView({ data }: NodeProps<FlowNode>) {
  const { node, selected, active, mark, count, paused, funnel, total, vertical } = data;
  const item = PALETTE_BY_TYPE[node.type];
  const outreach = isOutreach(node);
  return (
    <div
      className={cn(
        "w-[220px] rounded-input border bg-card px-3 py-2 text-left transition-colors",
        active ? "border-primary ring-2 ring-primary" : selected ? "border-primary bg-brand-tint" : "border-border hover:border-brand-tint-border",
        mark === "added" && "border-ok ring-1 ring-ok",
        mark === "removed" && "border-destructive opacity-70 ring-1 ring-destructive",
        mark === "changed" && "border-attention ring-1 ring-attention",
        mark === "path" && "border-primary bg-brand-tint ring-1 ring-primary",
        paused && "border-destructive",
      )}
    >
      <Handle type="target" position={vertical ? Position.Top : Position.Left} className="!size-2.5 !border !border-border !bg-card" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{item?.group ?? "Step"}</span>
        {!funnel && count !== undefined && count > 0 && <span className="rounded-pill bg-brand-tint px-1.5 text-[10px] font-semibold text-primary tabular">{count}</span>}
      </div>
      <p className="mt-0.5 text-[12px] font-semibold leading-snug text-foreground">{node.label}</p>
      {node.config.executor && <p className="truncate text-[11px] text-subtle">{node.config.executor}</p>}
      {funnel && count !== undefined && (
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[18px] font-semibold leading-none text-primary tabular">{count.toLocaleString("en-IN")}</span>
          <span className="text-[10px] text-muted-foreground">policies{total ? ` · ${Math.round((count / total) * 100)}%` : ""}</span>
        </p>
      )}
      {paused && <p className="text-[10px] font-semibold text-destructive">Agent paused</p>}
      {outreach && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground" title="Paid since the list, On hold and Contact policy run before this step and cannot be removed">
          <ShieldCheck className="size-3 text-ok" aria-hidden /> Paid · Hold · Contact
        </p>
      )}
      {mark && mark !== "path" && <p className="mt-1 text-[10px] font-semibold uppercase">{mark}</p>}
      <Handle type="source" position={vertical ? Position.Bottom : Position.Right} className="!size-2.5 !border !border-border !bg-primary" />
    </div>
  );
}

interface EdgeData extends Record<string, unknown> {
  editable: boolean;
  onInsert?: ((id: string) => void) | undefined;
  selected: boolean;
  count?: number | undefined;
}

function EdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, markerEnd, data }: EdgeProps<Edge<EdgeData>>) {
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} {...(markerEnd ? { markerEnd } : {})} style={{ stroke: data?.selected ? "var(--primary)" : "var(--muted-foreground)", strokeWidth: data?.selected ? 2 : 1.25 }} />
      <EdgeLabelRenderer>
        <div className="group nodrag nopan pointer-events-auto absolute flex items-center gap-1" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}>
          {(label || data?.count !== undefined) && (
            <span className="rounded-sm bg-card px-1 text-[10px] font-semibold text-subtle">
              {label}
              {data?.count !== undefined && <span className="ml-1 text-primary tabular">{data.count.toLocaleString("en-IN")}</span>}
            </span>
          )}
          {data?.editable && (
            <button type="button" aria-label="Insert a step here" onClick={() => data.onInsert?.(id)} className="flex size-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity hover:border-primary hover:text-primary group-hover:opacity-100 focus:opacity-100">
              <Plus className="size-3" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { wf: NodeView };
const edgeTypes = { wf: EdgeView };

export interface WfCanvasProps {
  graph: WfGraph;
  editable?: boolean | undefined;
  selectedId?: string | null | undefined;
  selectedEdge?: string | null | undefined;
  activeId?: string | null | undefined;
  marks?: Record<string, Mark> | undefined;
  counts?: Record<string, number> | undefined;
  /** Funnel mode: big counts on nodes, counts on edges. */
  funnel?: { total: number; edges: Record<string, number>; vertical?: boolean } | undefined;
  pausedExecutors?: string[] | undefined;
  height?: number | string | undefined;
  onSelectNode?: ((id: string | null) => void) | undefined;
  onSelectEdge?: ((id: string) => void) | undefined;
  onMove?: ((id: string, x: number, y: number) => void) | undefined;
  onConnect?: ((from: string, to: string) => void) | undefined;
  onInsert?: ((edgeId: string) => void) | undefined;
  onDropType?: ((type: string, x: number, y: number) => void) | undefined;
}

function Inner(p: WfCanvasProps) {
  const theme = useSession((s) => s.theme);
  const rf = useReactFlow();
  const nodes: FlowNode[] = useMemo(
    () =>
      p.graph.nodes.map((n) => ({
        id: n.id,
        type: "wf" as const,
        position: { x: n.x, y: n.y },
        data: { node: n, selected: n.id === p.selectedId, active: n.id === p.activeId, mark: p.marks?.[n.id], count: p.counts?.[n.id], funnel: !!p.funnel, vertical: !!p.funnel?.vertical, total: p.funnel?.total, paused: !!n.config.executor && !!p.pausedExecutors?.includes(n.config.executor) },
        draggable: !!p.editable,
      })),
    [p.graph, p.selectedId, p.activeId, p.marks, p.counts, p.funnel, p.editable, p.pausedExecutors],
  );
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<FlowNode>(nodes);
  useEffect(() => setRfNodes(nodes), [nodes, setRfNodes]);
  const edges: Edge<EdgeData>[] = useMemo(
    () =>
      p.graph.edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        type: "wf",
        ...(e.label ? { label: e.label } : {}),
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-foreground)" },
        data: { editable: !!p.editable, onInsert: p.onInsert, selected: e.id === p.selectedEdge, count: p.funnel?.edges[e.id] },
      })),
    [p.graph, p.editable, p.onInsert, p.selectedEdge, p.funnel],
  );
  // Follow the step being played so a large journey stays readable.
  useEffect(() => {
    if (!p.activeId) return;
    const n = p.graph.nodes.find((x) => x.id === p.activeId);
    if (n) rf.setCenter(n.x + 110, n.y + 40, { zoom: Math.max(rf.getZoom(), 0.85), duration: 350 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.activeId]);
  const onDrop = (e: DragEvent) => {
    const type = e.dataTransfer.getData("application/wf-node");
    if (!type || !p.onDropType) return;
    e.preventDefault();
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    p.onDropType(type, pos.x - 110, pos.y - 38);
  };
  return (
    <div className="prism-flow w-full overflow-hidden rounded-card border border-border" style={{ height: p.height ?? 560 }} onDragOver={(e) => p.editable && e.preventDefault()} onDrop={onDrop}>
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={theme === "light" ? "light" : "dark"}
        fitView
        fitViewOptions={{ padding: 0.08, minZoom: 0.3, maxZoom: 1 }}
        minZoom={0.2}
        nodesConnectable={!!p.editable}
        nodesDraggable={!!p.editable}
        elementsSelectable
        deleteKeyCode={null}
        onNodeClick={(_, n) => p.onSelectNode?.(n.id)}
        onEdgeClick={(_, e) => p.onSelectEdge?.(e.id)}
        onPaneClick={() => p.onSelectNode?.(null)}
        onNodeDragStop={(_, n) => p.onMove?.(n.id, n.position.x, n.position.y)}
        onNodesChange={onNodesChange}
        onConnect={(c) => c.source && c.target && p.onConnect?.(c.source, c.target)}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function WfCanvas(p: WfCanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner {...p} />
    </ReactFlowProvider>
  );
}
