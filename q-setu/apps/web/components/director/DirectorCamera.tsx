"use client";

/**
 * The director's camera (inside a drei View). Between shots it flies on a gentle arc, not a straight
 * line, over 0.7–1.0 s with the motion token easing, and settles with a 1–2° roll. While a shot is held
 * it drifts slowly (2–3% of the distance over 8 s), so the scene never looks frozen.
 * Reduced motion: cuts straight to the shot, no drift.
 *
 * Optional `orbit`: the viewer can drag to orbit and scroll to zoom around the shot's subject, damped
 * and within limits; a double-click (or the next shot) eases back to the director's framing.
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
  range = [0.7, 1.0],
  orbit,
  zoom = true,
}: {
  state: DirectorState;
  onSettled: () => void;
  drift?: number;
  /** Optional moving subject: while it returns a point, the camera looks at it and slides along. */
  track?: () => THREE.Vector3 | null;
  /** Move duration range in seconds (shorter for short hops). */
  range?: [number, number];
  /** The element whose drags orbit the camera (and wheel zooms); omit for a directed-only camera. */
  orbit?: () => HTMLElement | null;
  /** Let the wheel zoom (off where the page itself must scroll). */
  zoom?: boolean;
}) {
  // The viewer's orbit offsets (yaw, pitch in radians; zoom as a distance factor) and their targets.
  const user = useRef({ yaw: 0, pitch: 0, zoom: 1, ty: 0, tp: 0, tz: 1 });
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
    // Each move takes between range[0] and range[1] seconds, longer for longer hops.
    const duration = Math.min(range[1], Math.max(range[0], range[0] + dist * 0.05));
    // A new shot re-frames: the viewer's orbit eases back to zero.
    Object.assign(user.current, { ty: 0, tp: 0, tz: 1 });
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

  // Drag to orbit, wheel to zoom, double-click to re-frame (all damped and limited).
  useEffect(() => {
    if (!orbit || state.reduce) return;
    const el = orbit();
    if (!el) return;
    let drag: { x: number; y: number } | null = null;
    const u = user.current;
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest("button, a, input")) return;
      drag = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      u.ty = Math.max(-1.0, Math.min(1.0, u.ty - (e.clientX - drag.x) * 0.006));
      u.tp = Math.max(-0.45, Math.min(0.5, u.tp + (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => (drag = null);
    const wheel = (e: WheelEvent) => {
      if (!zoom) return;
      e.preventDefault();
      u.tz = Math.max(0.6, Math.min(1.6, u.tz * Math.exp(e.deltaY * 0.001)));
    };
    const dbl = () => Object.assign(u, { ty: 0, tp: 0, tz: 1 });
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("dblclick", dbl);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("dblclick", dbl);
    };
  }, [orbit, zoom, state.reduce]);

  const off = useRef(new THREE.Vector3());
  const axis = useRef(new THREE.Vector3());
  useFrame(({ clock }, dt) => {
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
    // The viewer's orbit: rotate the camera's offset from its subject, then scale it.
    const u = user.current;
    const k = 1 - Math.exp(-8 * Math.min(dt, 0.1));
    u.yaw += (u.ty - u.yaw) * k;
    u.pitch += (u.tp - u.pitch) * k;
    u.zoom += (u.tz - u.zoom) * k;
    if (Math.abs(u.yaw) + Math.abs(u.pitch) + Math.abs(u.zoom - 1) > 1e-4) {
      const o = off.current.copy(c.position).sub(look.current);
      o.applyAxisAngle(THREE.Object3D.DEFAULT_UP, u.yaw);
      axis.current.crossVectors(THREE.Object3D.DEFAULT_UP, o).normalize();
      o.applyAxisAngle(axis.current, u.pitch).multiplyScalar(u.zoom);
      c.position.copy(look.current).add(o);
    }
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
