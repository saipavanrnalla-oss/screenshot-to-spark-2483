import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, type ComponentProps } from "react";

const WfCanvas = lazy(() => import("./wf-canvas"));

/** The workflow canvas, loaded in the browser only. */
export function CanvasBox(props: ComponentProps<typeof WfCanvas>) {
  const h = props.height ?? 560;
  return (
    <ClientOnly fallback={<div className="rounded-card border border-border" style={{ height: h }} />}>
      <Suspense fallback={<div className="rounded-card border border-border" style={{ height: h }} />}>
        <WfCanvas {...props} />
      </Suspense>
    </ClientOnly>
  );
}
