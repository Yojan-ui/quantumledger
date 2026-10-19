"use client";

/**
 * "Shield plugs in" inside Demo 2's globe slot: what the camera dives into when a system is picked.
 * The scene's dots re-form from the globe's (they assemble from a scatter as the dive lands), and Back
 * scatters them again before the camera flies out. One model drives the 3D, the caption (the films'
 * HUD), the counters on the anchored labels and the console lines (pushed to the page's live console
 * as they appear), so they always agree. Live: a real run of the bundled bank on this server's
 * loopback; where that can't start, the recorded run, and the note says so.
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { DirectorHUD } from "@/components/director/HUD";
import type { Shot, Step } from "@/components/director/types";
import { useDirector } from "@/components/director/useDirector";
import { LazyView } from "@/components/scenes/LazyView";
import { Button } from "@/components/ui";
import { pushLocal } from "@/lib/client/live";
import { useReducedMotion } from "@/lib/client/motion";
import type { Op } from "@/lib/live/types";
import { BEATS, type InstallMode, type View } from "./model";
import { shotCamera } from "./ShieldPlugIn";
import { useShieldStory } from "./useShieldStory";

const ShieldPlugIn = dynamic(() => import("./ShieldPlugIn").catch(() => import("./ShieldPlugIn")), {
  ssr: false,
});

const MODES: { id: InstallMode; label: string }[] = [
  { id: "dns", label: "DNS" },
  { id: "container", label: "Container" },
  { id: "code", label: "One line of code" },
];

export const SHIELD_STEPS: Step[] = [
  { label: "Scan", role: "danger" },
  { label: "Install", role: "kem" },
  { label: "Handshake", role: "kem" },
  { label: "Recorder", role: "warn" },
  { label: "Fix", role: "ok" },
  { label: "Verify", role: "sig" },
  { label: "Attack", role: "danger" },
];

/** One shot per beat; the current beat carries the model's caption. */
export function shieldShots(v: View): Shot[] {
  return BEATS.map((b, i) => ({
    id: b,
    step: i,
    camera: { ...shotCamera(i, v.mode), fov: 38 },
    caption: i === v.beat ? v.caption : "",
  }));
}

const OPS: Record<string, Op> = {
  SCAN: "SCAN",
  RESCAN: "SCAN",
  RECORDED: "HANDSHAKE",
  SEALED: "SEAL",
  HANDSHAKE: "HANDSHAKE",
  INSTALL: "POLICY",
  FIXED: "POLICY",
  PARTIAL: "POLICY",
  OPEN: "POLICY",
  SIGNED: "SIGN",
  ATTACK: "REJECT",
};

export function ShieldDive({
  site,
  open,
  onBack,
}: {
  /** The system dived into (its id tags the console lines). */
  site: { id: string; label: string; sector: string };
  open: boolean;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const story = useShieldStory({ drive: "live", reduce });
  const { v } = story;
  const shots = useMemo(() => shieldShots(v), [v]);
  const director = useDirector(shots);
  const [formAt, setFormAt] = useState(0);
  const [leaveAt, setLeaveAt] = useState(0);

  // The dive has landed: the dots re-form here, and a real run starts (DNS first).
  useEffect(() => {
    if (!open) return;
    setLeaveAt(0);
    setFormAt(performance.now());
    void story.run("dns");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const stop = story.stop;
  useEffect(() => () => stop(), [stop]);

  // The camera follows the story's beat.
  useEffect(() => {
    if (director.state.index !== v.beat) director.go(v.beat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.beat]);

  // The console: each of the model's lines once, as it appears.
  const pushed = useRef(0);
  const runKey = `${v.mode}:${story.events[0] ? JSON.stringify(story.events[0]).length : 0}:${story.events.length > 0}`;
  useEffect(() => {
    pushed.current = 0;
  }, [runKey]);
  useEffect(() => {
    for (const l of v.log.slice(pushed.current))
      pushLocal({
        op: OPS[l.verb] ?? "POLICY",
        alg: /X25519MLKEM768/.test(l.text)
          ? "x25519mlkem768"
          : l.verb === "SIGNED"
            ? "ml-dsa-65"
            : "tls",
        ms: Number.parseFloat(l.ms) || 0,
        ok: l.tone !== "exposed",
        site: site.id,
        sector: site.sector,
        source: "shield",
        detail: `${l.verb} · ${l.text}`,
      });
    pushed.current = v.log.length;
  }, [v.log, site.id, site.sector]);

  function back() {
    story.stop();
    setLeaveAt(performance.now());
    setTimeout(onBack, reduce ? 0 : 650);
  }

  if (!open) return null;
  return (
    <div className="absolute inset-0">
      <LazyView className="h-full w-full" label={`Shield plugs into ${site.label}. ${v.caption}`}>
        {(on) => (
          <ShieldPlugIn
            state={director.state}
            onSettled={director.onSettled}
            v={v}
            bt={story.beatSeconds}
            active={on}
            reduce={reduce}
            formAt={formAt}
            leaveAt={leaveAt}
          />
        )}
      </LazyView>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 md:p-6">
        <div
          className="pointer-events-auto flex flex-wrap gap-2"
          role="group"
          aria-label="How Shield is installed"
        >
          {MODES.map((m) => (
            <Button
              key={m.id}
              variant={v.mode === m.id && story.started ? "primary" : "secondary"}
              aria-pressed={v.mode === m.id}
              disabled={story.busy !== null}
              onClick={() => void story.run(m.id)}
            >
              {m.label}
            </Button>
          ))}
          {v.beat >= 5 && v.mode !== "code" && (
            <Button onClick={() => void story.runAttack()} disabled={story.busy !== null}>
              {story.busy === "attack" ? "Attacking…" : "Attack it"}
            </Button>
          )}
        </div>
        <Button className="pointer-events-auto" onClick={back}>
          ← Back to the map
        </Button>
      </div>
      {story.note && (
        <p
          className="absolute left-4 top-16 max-w-text text-small text-warn md:left-6"
          role="status"
        >
          {story.note}
        </p>
      )}
      <DirectorHUD
        director={director}
        steps={SHIELD_STEPS}
        playing={story.busy === "run"}
        busy={false}
        onToggle={() => void story.run(v.mode)}
        onNext={() => story.step(1)}
        onPrev={() => story.step(-1)}
        onReplay={() => void story.run(v.mode)}
      />
    </div>
  );
}
