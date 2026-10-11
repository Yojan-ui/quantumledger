"use client";

/**
 * Camera and globe choreography. Each frame: find the page's visible globe area, ask the director
 * for the pose, ease towards it (critically damped, never bouncy), add slow auto-rotation, drag
 * inertia and a slight cursor tilt, and frame the globe inside that area.
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
  });
  const ptr = useRef({ x: 0, y: 0, down: false, lastX: 0 });
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = (e: PointerEvent) => {
      ptr.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (ptr.current.down) {
        const dx = e.clientX - ptr.current.lastX;
        ptr.current.lastX = e.clientX;
        st.current.drag += dx * 0.006;
        st.current.dragV = dx * 0.36;
      }
    };
    const down = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-world-drag]")) return;
      ptr.current.down = true;
      ptr.current.lastX = e.clientX;
    };
    const up = () => (ptr.current.down = false);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
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
    s.dist = damp(s.dist, (p.dist / 3) * fitDist, reduce.current ? 50 : 2.2, dt);
    camera.position.set(0, 0, s.dist);
    camera.lookAt(0, 0, 0);

    if (!reduce.current && p.spin > 0.005) s.spin = wrap(s.spin + p.spin * dt);
    else s.spin = damp(s.spin, 0, 1.6, dt);
    if (!ptr.current.down) {
      s.drag += s.dragV * dt * 0.016;
      s.dragV = damp(s.dragV, 0, 2.5, dt);
      if (p.spin <= 0.005) s.drag = damp(wrap(s.drag), 0, 1.2, dt);
    }
    s.tiltX = damp(s.tiltX, ptr.current.y * 0.04, 2, dt);
    s.tiltY = damp(s.tiltY, ptr.current.x * 0.06, 2, dt);
    const f = facing(p.lat, p.lon);
    s.rx = damp(s.rx, f.x, 2, dt);
    s.ry = s.ry + wrap(f.y + s.spin + s.drag - s.ry) * (1 - Math.exp(-2 * dt));
    const g = globe.current;
    if (g) {
      g.rotation.set(s.rx + s.tiltX, s.ry + s.tiltY, 0);
      g.updateMatrixWorld();
    }
  });
  return null;
}
