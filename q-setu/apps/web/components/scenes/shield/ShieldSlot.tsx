"use client";

/**
 * "Shield plugs in" in a scroll-driven slot (the homepage's Deploy anywhere section): the recorded
 * real run, scrubbed by the section's scroll (`focus.v`, 0 – `steps`, written by its ScrollTrigger),
 * with the camera moving beat to beat. The same scene, model and labels as Demo 2.
 */
import { useEffect, useMemo, useState } from "react";
import { useDirector } from "@/components/director/useDirector";
import { useReducedMotion } from "@/lib/client/motion";
import ShieldPlugIn from "./ShieldPlugIn";
import { shieldShots } from "./ShieldDive";
import { useShieldStory } from "./useShieldStory";

export default function ShieldSlot({
  focus,
  steps,
  active,
}: {
  focus: { v: number };
  /** The scroll range of `focus.v`. */
  steps: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);
  // focus.v is written by the section's ScrollTrigger (no React state): read it once a frame.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = Math.max(0, Math.min(1, focus.v / steps));
      if (Math.abs(p - last) > 1e-4) setProgress((last = p));
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, focus, steps]);
  const story = useShieldStory({ drive: "scroll", progress, reduce });
  const { v } = story;
  const shots = useMemo(() => shieldShots(v), [v]);
  const director = useDirector(shots);
  useEffect(() => {
    if (director.state.index !== v.beat) director.go(v.beat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.beat]);
  return (
    <ShieldPlugIn
      state={director.state}
      onSettled={director.onSettled}
      v={v}
      bt={story.beatSeconds}
      active={active}
      reduce={reduce}
      // The section's heading sits top left and its cards along the bottom: no labels here, and the
      // bench shifted right and up into the free corner.
      labels={false}
      shift={[0.2, 0.14]}
      wider={0.25}
    />
  );
}
