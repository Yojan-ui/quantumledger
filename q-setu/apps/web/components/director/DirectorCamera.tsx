"use client";

/**
 * The director's camera (inside a drei View). Between shots it flies on a gentle arc, not a straight
 * line, over 0.7–1.0 s with the motion token easing, and settles with a 1–2° roll. While a shot is held
 * it drifts slowly (2–3% of the distance over 8 s), so the scene never looks frozen.
 * Reduced motion: cuts straight to the shot, no drift.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import type { DirectorState } from "./types";

const v = (a: [number, number, number]) => new THREE.Vector3(...a);

export function DirectorCamera({
  state,
  onSettled,
  drift = 0.025,
  track,
}: {
  state: DirectorState;
  onSettled: () => void;
  drift?: number;
  /** Optional moving subject: while it returns a point, the camera looks at it and slides along. */
  track?: () => THREE.Vector3 | null;
}) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const look = useRef(v(state.shot.camera.target));
  const base = useRef(v(state.shot.camera.position));
  const roll = useRef(0);
  const settled = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const c = cam.current;
    if (!c) return;
    const to = v(state.shot.camera.position);
    const toLook = v(state.shot.camera.target);
    const toFov = state.shot.camera.fov ?? 40;
    settled.current = false;
    if (state.reduce || first.current) {
      first.current = false;
      base.current.copy(to);
      look.current.copy(toLook);
      c.fov = toFov;
      c.updateProjectionMatrix();
      settled.current = true;
      onSettled();
      return;
    }
    const from = base.current.clone();
    const fromLook = look.current.clone();
    const fromFov = c.fov;
    // Arc: lift the midpoint up and out, proportional to the distance travelled.
    const dist = from.distanceTo(to);
    const mid = from.clone().lerp(to, 0.5);
    const out = mid
      .clone()
      .sub(toLook)
      .normalize()
      .multiplyScalar(dist * 0.18);
    const ctrl = mid.add(out).add(new THREE.Vector3(0, dist * 0.12, 0));
    const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
    // Snappy: every camera move takes 0.7–1.0 s.
    const duration = Math.min(1.0, Math.max(0.7, 0.7 + dist * 0.05));
    const p = { t: 0 };
    const side = Math.sign(to.x - from.x || 1);
    const tl = gsap.timeline({
      onComplete: () => {
        settled.current = true;
        onSettled();
      },
    });
    tl.to(p, {
      t: 1,
      duration,
      ease: easeToken,
      onUpdate: () => {
        curve.getPoint(p.t, base.current);
        look.current.lerpVectors(fromLook, toLook, p.t);
        c.fov = fromFov + (toFov - fromFov) * p.t;
        c.updateProjectionMatrix();
        // Roll in during the move, settle to level at the end (max ~1.5°).
        roll.current = side * 0.026 * Math.sin(Math.PI * p.t);
      },
    });
    return () => void tl.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, state.take, state.reduce]);

  useFrame(({ clock }) => {
    const c = cam.current;
    if (!c) return;
    const d = base.current.length();
    const sway =
      settled.current && !state.reduce
        ? new THREE.Vector3(
            Math.sin((clock.elapsedTime * 2 * Math.PI) / 8) * drift * d,
            Math.sin((clock.elapsedTime * 2 * Math.PI) / 11) * drift * d * 0.5,
            0,
          )
        : new THREE.Vector3();
    c.position.copy(base.current).add(sway);
    const subject = track?.();
    if (subject && settled.current) {
      look.current.lerp(subject, 0.12);
      c.position.x += (subject.x - c.position.x) * 0.6;
    }
    c.up.set(Math.sin(roll.current), Math.cos(roll.current), 0);
    c.lookAt(look.current);
  });

  return (
    <PerspectiveCamera
      ref={cam}
      makeDefault
      fov={state.shot.camera.fov ?? 40}
      near={0.05}
      far={60}
    />
  );
}
