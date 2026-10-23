"use client";

/**
 * The director's camera (inside a drei View). Between shots it flies a spline (lib/motion/camera): a
 * dolly when the subject stays put, a crane over the midpoint when it moves, an orbit when the view
 * swings round. A big move eases back for 120 ms first (anticipation); the move takes 1.2–1.8 s
 * (longer for longer moves) with zero velocity at both ends, the look-at point leads slightly, and it
 * arrives with a small settle and a 1–2° roll that levels out. It never cuts. While a shot is held it
 * drifts slowly (2–3% of the distance over 8 s), so the scene never looks frozen.
 * Reduced motion: cuts straight to the shot, no drift.
 *
 * Optional `orbit`: the viewer can drag (and fling) to orbit and scroll to zoom around the shot's subject;
 * 3 s after the last touch it springs back to the shot's framing. Damped
 * and within limits; a double-click (or the next shot) eases back to the director's framing.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { planMove, sampleMove, travelled, type CameraMove } from "@/lib/motion";
import type { DirectorState } from "./types";

const v = (a: [number, number, number]) => new THREE.Vector3(...a);

export function DirectorCamera({
  state,
  onSettled,
  drift = 0.025,
  track,
  range = [1.2, 1.8],
  orbit,
  zoom = true,
  shiftX = 0,
  shiftY = 0,
  pull,
  autoYaw,
}: {
  state: DirectorState;
  onSettled: () => void;
  drift?: number;
  /** Optional moving subject: while it returns a point, the camera looks at it and slides along. */
  track?: () => THREE.Vector3 | null;
  /** Move duration range in seconds, within 1.2–1.8 (longer moves take longer). */
  range?: [number, number];
  /** The element whose drags orbit the camera (and wheel zooms); omit for a directed-only camera. */
  orbit?: () => HTMLElement | null;
  /** Let the wheel zoom (off where the page itself must scroll). */
  zoom?: boolean;
  /**
   * Moves the framed subject right by this fraction of the view's width (a lens shift, not a camera
   * move), leaving the left side free for text laid over the 3D.
   */
  shiftX?: number;
  /** Moves the framed subject up by this fraction of the view's height (text below it). */
  shiftY?: number;
  /** A dolly-out factor (0 = none): the camera backs away from its subject by up to 3.5× its distance. */
  pull?: () => number;
  /** A directed orbit (radians of yaw, added to the viewer's), for hero moments. */
  autoYaw?: () => number;
}) {
  // The viewer's orbit offsets (yaw, pitch in radians; zoom as a distance factor) and their targets.
  // vy/vp: fling velocity (rad/s) after a release; at: the last drag or zoom (3 s idle springs back).
  const user = useRef({
    yaw: 0,
    pitch: 0,
    zoom: 1,
    ty: 0,
    tp: 0,
    tz: 1,
    vy: 0,
    vp: 0,
    at: 0,
    held: false,
  });
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const look = useRef(v(state.shot.camera.target));
  const base = useRef(v(state.shot.camera.position));
  const roll = useRef(0);
  const settled = useRef(false);
  const first = useRef(true);
  /** The move in flight: its spline, start time (s), fov and roll side. */
  const move = useRef<{
    m: CameraMove;
    start: number;
    fromFov: number;
    toFov: number;
    side: number;
  } | null>(null);

  useEffect(() => {
    const c = cam.current;
    if (!c) return;
    const to = v(state.shot.camera.position);
    const toLook = v(state.shot.camera.target);
    const toFov = state.shot.camera.fov ?? 40;
    settled.current = false;
    if (state.reduce || first.current) {
      first.current = false;
      move.current = null;
      base.current.copy(to);
      look.current.copy(toLook);
      c.fov = toFov;
      c.updateProjectionMatrix();
      settled.current = true;
      onSettled();
      return;
    }
    // A new shot re-frames: the viewer's orbit eases back to zero.
    Object.assign(user.current, { ty: 0, tp: 0, tz: 1 });
    // The move starts from wherever the camera is now (mid-move included), so it never jumps.
    const m = planMove(
      { pos: base.current.clone(), look: look.current.clone() },
      { pos: to, look: toLook },
    );
    const lo = Math.max(1.2, range[0]);
    const hi = Math.min(1.8, Math.max(lo, range[1]));
    m.duration = Math.min(hi, Math.max(lo, m.duration));
    move.current = {
      m,
      start: performance.now() / 1000,
      fromFov: c.fov,
      toFov,
      side: Math.sign(to.x - base.current.x || 1),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, state.take, state.reduce]);

  // Drag to orbit, wheel to zoom, double-click to re-frame (all damped and limited).
  useEffect(() => {
    if (!orbit || state.reduce) return;
    const el = orbit();
    if (!el) return;
    let drag: { x: number; y: number; t: number } | null = null;
    const u = user.current;
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest("button, a, input")) return;
      drag = { x: e.clientX, y: e.clientY, t: performance.now() };
      Object.assign(u, { vy: 0, vp: 0, held: true, at: drag.t });
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const now = performance.now();
      const dy = -(e.clientX - drag.x) * 0.006;
      const dp = (e.clientY - drag.y) * 0.004;
      u.ty = Math.max(-1.0, Math.min(1.0, u.ty + dy));
      u.tp = Math.max(-0.45, Math.min(0.5, u.tp + dp));
      // Fling: the pointer's own angular speed, carried on after release.
      const s = Math.max(8, now - drag.t) / 1000;
      u.vy = Math.max(-4, Math.min(4, dy / s));
      u.vp = Math.max(-3, Math.min(3, dp / s));
      drag = { x: e.clientX, y: e.clientY, t: now };
      u.at = now;
    };
    const up = () => {
      if (drag && performance.now() - drag.t > 80) u.vy = u.vp = 0; // held still: no fling
      drag = null;
      u.held = false;
    };
    const wheel = (e: WheelEvent) => {
      if (!zoom) return;
      e.preventDefault();
      u.tz = Math.max(0.6, Math.min(1.6, u.tz * Math.exp(e.deltaY * 0.001)));
      u.at = performance.now();
    };
    const dbl = () => Object.assign(u, { ty: 0, tp: 0, tz: 1, vy: 0, vp: 0 });
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

  const size = useThree((st) => st.size);
  useEffect(() => {
    const c = cam.current;
    if (!c) return;
    if (shiftX || shiftY)
      c.setViewOffset(
        size.width,
        size.height,
        -shiftX * size.width,
        shiftY * size.height,
        size.width,
        size.height,
      );
    else c.clearViewOffset();
  }, [shiftX, shiftY, size.width, size.height]);
  const off = useRef(new THREE.Vector3());
  const swayV = useRef(new THREE.Vector3());
  const axis = useRef(new THREE.Vector3());
  useFrame(({ clock }, dt) => {
    const c = cam.current;
    if (!c) return;
    const mv = move.current;
    if (mv) {
      const t = performance.now() / 1000 - mv.start;
      const done = sampleMove(mv.m, t, base.current, look.current);
      const k = travelled(mv.m, t);
      c.fov = mv.fromFov + (mv.toFov - mv.fromFov) * k;
      c.updateProjectionMatrix();
      // Roll in during the move, level at the end (max ~1.5°).
      roll.current = mv.side * 0.026 * Math.sin(Math.PI * k);
      // Settled on arrival (the effects of the shot start); the settle itself runs on.
      if (k >= 1 && !settled.current) {
        settled.current = true;
        onSettled();
      }
      if (done) move.current = null;
    }
    const d = base.current.length();
    // The hold drift (no allocation per frame: one reused vector).
    const sway = swayV.current;
    if (settled.current && !state.reduce)
      sway.set(
        Math.sin((clock.elapsedTime * 2 * Math.PI) / 8) * drift * d,
        Math.sin((clock.elapsedTime * 2 * Math.PI) / 11) * drift * d * 0.5,
        0,
      );
    else sway.set(0, 0, 0);
    c.position.copy(base.current).add(sway);
    // The viewer's orbit: rotate the camera's offset from its subject, then scale it.
    const u = user.current;
    const fdt = Math.min(dt, 0.1);
    if (!u.held) {
      // Inertia after a fling, then (3 s after the last drag or zoom) a spring back to the shot.
      u.ty = Math.max(-1.0, Math.min(1.0, u.ty + u.vy * fdt));
      u.tp = Math.max(-0.45, Math.min(0.5, u.tp + u.vp * fdt));
      const decay = Math.exp(-3 * fdt);
      u.vy *= decay;
      u.vp *= decay;
      if (u.at && performance.now() - u.at > 3000) {
        const back = 1 - Math.exp(-2 * fdt);
        u.ty -= u.ty * back;
        u.tp -= u.tp * back;
        u.tz += (1 - u.tz) * back;
      }
    }
    const k = 1 - Math.exp(-8 * fdt);
    u.yaw += (u.ty - u.yaw) * k;
    u.pitch += (u.tp - u.pitch) * k;
    u.zoom += (u.tz - u.zoom) * k;
    const ay = autoYaw?.() ?? 0;
    if (Math.abs(u.yaw + ay) + Math.abs(u.pitch) + Math.abs(u.zoom - 1) > 1e-4) {
      const o = off.current.copy(c.position).sub(look.current);
      o.applyAxisAngle(THREE.Object3D.DEFAULT_UP, u.yaw + ay);
      axis.current.crossVectors(THREE.Object3D.DEFAULT_UP, o).normalize();
      o.applyAxisAngle(axis.current, u.pitch).multiplyScalar(u.zoom);
      c.position.copy(look.current).add(o);
    }
    const out = pull?.() ?? 0;
    if (out > 0)
      c.position
        .sub(look.current)
        .multiplyScalar(1 + 3.5 * out)
        .add(look.current);
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
