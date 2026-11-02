import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, type ComponentProps } from "react";
import { AGENTS } from "@/data/persistency";
import { useWork } from "@/store/work";

const WfCanvas = lazy(() => import("./wf-canvas"));

/** The workflow canvas, loaded in the browser only. */
export function CanvasBox(props: ComponentProps<typeof WfCanvas>) {
  const h = props.height ?? 560;
  const pauses = useWork((s) => s.agentPause);
  const paused = useMemo(() => AGENTS.filter((a) => pauses[a.id]).map((a) => a.name), [pauses]);
  return (
    <ClientOnly fallback={<div className="rounded-card border border-border" style={{ height: h }} />}>
      <Suspense fallback={<div className="rounded-card border border-border" style={{ height: h }} />}>
        <WfCanvas pausedExecutors={paused} {...props} />
      </Suspense>
    </ClientOnly>
  );
}
