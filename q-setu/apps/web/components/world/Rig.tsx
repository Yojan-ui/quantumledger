"use client";

/**
 * Camera and globe choreography. Each frame: find the page's visible globe area, ask the director
 * for the pose, ease towards it (critically damped, never bouncy), add slow auto-rotation (faster
 * while the page scrolls), a drag fling with inertia and a slight cursor tilt, and frame the globe inside that area.
 * After 3 s without a drag the globe springs back to the shot's framing; a double-click re-frames at once.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { direct } from "./director";
import { facing } from "./geo";
import { world } from "./store";

const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The [data-world-focus] element with the largest visible area. */
function bestFocus(h: number): DOMRect | null {
  let best: DOMRect | null = null;
  let area = 0;
  document.querySelectorAll("[data-world-focus]").forEach((el) => {
    const r = el.getBoundingClientRect();
    const vis = Math.max(0, Math.min(r.bottom, h) - Math.max(r.top, 56)) * r.width;
    if (vis > area) {
      area = vis;
      best = r;
    }
  });
  return area > 2000 ? best : null;
}

export function Rig({ globe }: { globe: React.RefObject<THREE.Group | null> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const st = useRef({
    dist: 5,
    rx: 0.3,
    ry: -2.7,
    spin: 0,
    drag: 0,
    dragV: 0,
    tiltX: 0,
    tiltY: 0,
    offX: 0,
    offY: 0,
    tilt: 0,
    yaw: 0,
  });
  const ptr = useRef({ x: 0, y: 0, down: false, lastX: 0, lastT: 0, upAt: 0, reframeAt: 0 });
  /** Scroll velocity (px/s), smoothed; the globe spins faster while the page scrolls. */
  const scroll = useRef({ y: 0, t: 0, v: 0, boost: 0 });
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = (e: PointerEvent) => {
      ptr.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (ptr.current.down) {
        const dx = e.clientX - ptr.current.lastX;
        const now = performance.now();
        const dtMs = Math.max(8, now - ptr.current.lastT);
        ptr.current.lastX = e.clientX;
        ptr.current.lastT = now;
        st.current.drag += dx * 0.006;
        // Fling: radians per second from the pointer's own speed, released with inertia.
        st.current.dragV = Math.max(-6, Math.min(6, ((dx * 0.006) / dtMs) * 1000));
      }
    };
    const down = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-world-drag]")) return;
      ptr.current.down = true;
      ptr.current.lastX = e.clientX;
      ptr.current.lastT = performance.now();
      st.current.dragV = 0;
    };
    const up = () => {
      if (ptr.current.down) ptr.current.upAt = performance.now();
      ptr.current.down = false;
    };
    const dbl = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.("[data-world-drag]")) return;
      st.current.dragV = 0;
      ptr.current.reframeAt = performance.now();
    };
    const onScroll = () => {
      const now = performance.now();
      const sc = scroll.current;
      const dtS = Math.max(0.008, (now - sc.t) / 1000);
      sc.v = Math.abs(window.scrollY - sc.y) / dtS;
      sc.y = window.scrollY;
      sc.t = now;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("dblclick", dbl);
    return () => {
      window.removeEventListener("dblclick", dbl);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const p = direct();
    const s = st.current;
    const r = bestFocus(size.height);
    world.focusRect = r && {
      left: r.left,
      top: Math.max(r.top, 56),
      width: r.width,
      height: Math.min(r.bottom, size.height) - Math.max(r.top, 56),
    };
    if (!r) return;

    // Frame the globe inside its area: the centre goes to the area's centre, and the pose distance
    // is scaled so that, unzoomed, the globe fits the area's shorter side.
    const k = reduce.current ? 50 : 3;
    s.offX = damp(s.offX, size.width / 2 - (r.left + r.width / 2), k, dt);
    s.offY = damp(s.offY, size.height / 2 - (r.top + r.height / 2), k, dt);
    camera.setViewOffset(size.width, size.height, s.offX, s.offY, size.width, size.height);
    // Distance at which the globe's diameter is 85% of the area's shorter side (fov 36°: tan 18° ≈ 0.3249).
    const fitDist = size.height / (0.85 * Math.max(160, Math.min(r.width, r.height)) * 0.3249);
    // A directed shot (Demo 2) is already eased by its tween: follow it closely.
    const shot = world.mode === "deploy" && !!world.shot;
    s.dist = damp(s.dist, (p.dist / 3) * fitDist, reduce.current ? 50 : shot ? 12 : 2.2, dt);
    // Tilt and yaw: the camera orbits a point on the globe's near surface (the shot's lat/lon, which
    // the globe turns to face the camera), so a pitched shot reads as a low angle over the land with
    // a level horizon, not a tilted globe. Head-on shots (tilt 0) look at the centre as before.
    const kt = reduce.current ? 50 : shot ? 12 : 2;
    s.tilt = damp(s.tilt, p.tilt, kt, dt);
    s.yaw = damp(s.yaw, p.yaw, kt, dt);
    const T = (s.tilt * Math.PI) / 180;
    const Y = (s.yaw * Math.PI) / 180;
    const pz = Math.min(1, s.tilt / 35);
    const d = Math.max(0.15, s.dist - pz);
    const sT = Math.sin(T);
    const cT = Math.cos(T);
    const sY = Math.sin(Y);
    const cY = Math.cos(Y);
    camera.position.set(sT * sY * d, -sT * cY * d, pz + cT * d);
    camera.up.set(-cT * sY, cT * cY, sT);
    camera.lookAt(0, 0, pz);

    // Scroll velocity spins the globe faster (up to +0.9 rad/s), then it eases back.
    const sc = scroll.current;
    if (performance.now() - sc.t > 120) sc.v = 0;
    sc.boost = damp(
      sc.boost,
      reduce.current ? 0 : Math.min(0.9, sc.v / 2500),
      sc.v > 0 ? 6 : 1.5,
      dt,
    );
    if (!reduce.current && p.spin > 0.005) s.spin = wrap(s.spin + (p.spin + sc.boost) * dt);
    else s.spin = damp(s.spin, 0, 1.6, dt);
    if (!ptr.current.down) {
      s.drag += s.dragV * dt;
      s.dragV = damp(s.dragV, 0, 1.6, dt);
      const now = performance.now();
      const reframing = now - ptr.current.reframeAt < 1200;
      if (reframing || p.spin <= 0.005 || now - ptr.current.upAt > 3000)
        s.drag = damp(wrap(s.drag), 0, reframing ? 6 : 1.2, dt);
    }
    s.tiltX = damp(s.tiltX, ptr.current.y * 0.04, 2, dt);
    s.tiltY = damp(s.tiltY, ptr.current.x * 0.06, 2, dt);
    const f = facing(p.lat, p.lon);
    const follow = shot ? 12 : 2;
    s.rx = damp(s.rx, f.x, follow, dt);
    s.ry = s.ry + wrap(f.y + s.spin + s.drag - s.ry) * (1 - Math.exp(-follow * dt));
    const g = globe.current;
    if (g) {
      g.rotation.set(s.rx + s.tiltX, s.ry + s.tiltY, 0);
      g.updateMatrixWorld();
    }
  });
  return null;
}
