"use client";

/**
 * The diagnostics experience: the HUD around the 3D pipeline stage. `?domain=` starts the real
 * pipeline for that domain (shareable). Without one, the labelled cached example (a public TLS test
 * site) plays in autoplay. Autoplay starts once the stage is on screen, once per page view.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { LazyView } from "@/components/scenes/LazyView";
import { actions, autoplay, EXAMPLE_DOMAIN, getPipeline, usePipeline } from "@/lib/client/pipeline";
import { HudShell } from "./HudShell";

const PipelineStage = dynamic(() => import("@/components/scenes/PipelineStage"), { ssr: false });

function Stage() {
  const s = usePipeline((x) => x);
  return (
    <LazyView
      className="h-full w-full"
      label={`The diagnostics stage: ${s.domain || "awaiting a target"}`}
    >
      {(on) => <PipelineStage state={s} active={on} />}
    </LazyView>
  );
}

function waitForCanvas(ms = 5000): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (document.querySelector("canvas:not([aria-hidden])") || performance.now() - t0 > ms)
        resolve();
      else setTimeout(check, 100);
    };
    check();
  });
}

export function DiagnosticsApp({
  compact = false,
  autostart = true,
}: {
  compact?: boolean;
  autostart?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autostart) return;
    const domain = new URLSearchParams(location.search).get("domain")?.trim();
    let started = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting || started) return;
        started = true;
        io.disconnect();
        const s = getPipeline();
        if (s.stage >= 0 || s.autoplay) return; // already running (navigated back)
        actions.setDomain(domain || "");
        // Wait (up to 5 s) for the 3D canvas, so the first stage plays on screen, not before it.
        void waitForCanvas()
          .then(() =>
            domain ? actions.detect(domain, false) : actions.detect(EXAMPLE_DOMAIN, true),
          )
          .then(() => autoplay())
          .catch(() => {});
      },
      { threshold: 0.4 },
    );
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, [autostart]);
  return (
    <div ref={box} className="h-full">
      <HudShell stage={<Stage />} compact={compact} className="h-full" />
    </div>
  );
}
