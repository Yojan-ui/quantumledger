"use client";

/**
 * Twelve great-circle arcs, one per live-mesh route. Every pulse is a real packet from the bus
 * (LiveTraffic): its travel time follows the measured latency, and an arc lights up while it carries
 * traffic, then settles back. A rejected (tampered) packet snaps halfway and its arc flashes saffron.
 * The director still decides which arc a chapter is about; that one stays fully bright.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { params } from "./director";
import { ARCS, arcPoints, toVec3 } from "./geo";
import { palette } from "./palette";
import { setPinned, world, type PacketInfo } from "./store";
import { set3 } from "@/components/scenes/geometry";

const SEG = 64;
const N = ARCS.length;
export const ARC_POINTS = ARCS.map((a) =>
  arcPoints(toVec3(a.from[0], a.from[1]), toVec3(a.to[0], a.to[1]), SEG),
);

function pointOnArc(arc: number, t: number, out: THREE.Vector3) {
  const pts = ARC_POINTS[arc]!;
  const x = Math.min(SEG - 1e-4, Math.max(0, t * SEG));
  const i = Math.floor(x);
  return out.copy(pts[i]!).lerp(pts[i + 1]!, x - i);
}

const lineVertex = /* glsl */ `
  attribute float aT; attribute float aArc;
  uniform float uLevel[${N}]; uniform float uTint[${N}]; uniform float uFlash[${N}]; uniform float uSnap[${N}];
  varying float vT; varying float vLevel; varying float vTint; varying float vFlash; varying float vSnap;
  void main() {
    int i = int(aArc + 0.5);
    vT = aT; vLevel = uLevel[i]; vTint = uTint[i]; vFlash = uFlash[i]; vSnap = uSnap[i];
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const lineFragment = /* glsl */ `
  uniform vec3 uNeutral; uniform vec3 uAccent; uniform vec3 uWarn;
  uniform vec3 uKem; uniform vec3 uSig; uniform float uGrad;
  varying float vT; varying float vLevel; varying float vTint; varying float vFlash; varying float vSnap;
  void main() {
    float ends = smoothstep(0.0, 0.05, vT) * smoothstep(1.0, 0.95, vT);
    // A snapped arc opens a gap around the break point that widens as the flash fades.
    float gap = vFlash > 0.0 ? smoothstep(0.0, 0.01, abs(vT - vSnap) - (1.0 - vFlash) * 0.12) : 1.0;
    // Protected arcs carry a gradient between the role colours: encryption (KEM) → signature (SIG).
    vec3 acc = mix(uAccent, mix(uKem, uSig, vT), uGrad);
    vec3 c = mix(mix(uNeutral, acc, vTint), uWarn, vFlash);
    float a = max(vLevel * 0.55, vFlash * 0.9) * ends * gap;
    gl_FragColor = vec4(c, a);
  }
`;

interface Live {
  arc: number;
  t: number;
  speed: number;
  size: number;
  reverse: boolean;
  doomed: boolean;
  arriveAt?: string;
  info?: PacketInfo;
}

/** A click within this many CSS px of a packet in flight inspects it. */
const PICK_PX = 16;

export function Arcs() {
  const pr = useThree((s) => s.viewport.dpr);
  const c = useMemo(palette, []);
  const live = useRef<Live[]>([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const spark = useRef(0);
  const activity = useRef(new Float32Array(N));
  const flash = useRef(new Float32Array(N));
  /** Which live packet each drawn point slot shows this frame (for click-to-inspect). */
  const slots = useRef<(Live | undefined)[]>([]);
  const drawn = useRef(0);
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  // Click a packet in flight: pin its real bus event (op, algorithm, bytes, latency, route).
  useEffect(() => {
    let downAt: { x: number; y: number } | null = null;
    const v = new THREE.Vector3();
    const down = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => {
      const d = downAt;
      downAt = null;
      const r = world.focusRect;
      const g = group.current;
      if (!d || !r || !g || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      if ((e.target as Element).closest?.("button, a, input, textarea, select, [role=dialog]"))
        return;
      if (e.clientX < r.left || e.clientX > r.left + r.width) return;
      if (e.clientY < r.top || e.clientY > r.top + r.height) return;
      const pos = pulses.g.attributes.position!.array as Float32Array;
      let best: Live | undefined;
      let bestD = PICK_PX;
      for (let k = 0; k < drawn.current; k++) {
        const l = slots.current[k];
        if (!l?.info) continue;
        v.set(pos[k * 3]!, pos[k * 3 + 1]!, pos[k * 3 + 2]!).applyMatrix4(g.matrixWorld);
        // Behind the globe (the far hemisphere from the camera): not clickable.
        if (v.dot(camera.position) < 0) continue;
        v.project(camera);
        const dist = Math.hypot(
          ((v.x + 1) / 2) * size.width - e.clientX,
          ((1 - v.y) / 2) * size.height - e.clientY,
        );
        if (dist < bestD) {
          bestD = dist;
          best = l;
        }
      }
      if (best?.info) setPinned({ kind: "packet", info: best.info, x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, size]);

  const lines = useMemo(() => {
    const pos: number[] = [];
    const t: number[] = [];
    const arc: number[] = [];
    ARC_POINTS.forEach((pts, a) => {
      for (let i = 0; i < SEG; i++) {
        pos.push(...pts[i]!.toArray(), ...pts[i + 1]!.toArray());
        t.push(i / SEG, (i + 1) / SEG);
        arc.push(a, a);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(t, 1));
    g.setAttribute("aArc", new THREE.Float32BufferAttribute(arc, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      uniforms: {
        uLevel: { value: new Array(N).fill(0.12) },
        uTint: { value: new Array(N).fill(0) },
        uFlash: { value: new Array(N).fill(0) },
        uSnap: { value: new Array(N).fill(0.5) },
        uNeutral: { value: c.text },
        uAccent: { value: c.warn.clone() },
        uWarn: { value: c.danger },
        uKem: { value: c.kem },
        uSig: { value: c.sig },
        uGrad: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    return { g, m };
  }, [c]);

  // The arcs drawn thick (screen-space, ~2 px) with a soft glow pass. The shader above stays the
  // source of truth for the per-arc state; its colour and alpha are baked per vertex on the CPU
  // each frame (premultiplied, additive), written in place into the line's colour buffer.
  const view = useThree((st) => st.size);
  const thick = useMemo(() => {
    const pos = lines.g.attributes.position!.array as Float32Array;
    const geo = new LineSegmentsGeometry();
    geo.setPositions(pos);
    geo.setColors(new Float32Array(pos.length));
    const mat = (w: number, o: number) =>
      new LineMaterial({
        linewidth: w,
        vertexColors: true,
        transparent: true,
        opacity: o,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        worldUnits: false,
        toneMapped: false,
      });
    const core = new LineSegments2(geo, mat(2, 1));
    const glow = new LineSegments2(geo, mat(7, 0.16));
    core.frustumCulled = glow.frustumCulled = false;
    const buf = (geo.attributes.instanceColorStart as THREE.InterleavedBufferAttribute)
      .data as THREE.InstancedInterleavedBuffer;
    return { geo, core, glow, buf };
  }, [lines]);
  const mix3 = useMemo(() => ({ acc: new THREE.Color(), c: new THREE.Color() }), []);

  const pulses = useMemo(() => {
    const n = 64;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aWarn", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
    const m = new THREE.ShaderMaterial({
      vertexShader: `attribute float aSize; attribute float aWarn; varying float vWarn; uniform float uPR; void main(){ vWarn = aWarn; vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = aSize*uPR/-mv.z; }`,
      fragmentShader: `uniform vec3 uColor; uniform vec3 uWarn; varying float vWarn; void main(){ float d = length(gl_PointCoord-.5); if (d > .5) discard; gl_FragColor = vec4(mix(uColor, uWarn, vWarn), smoothstep(.5,.2,d)); }`,
      uniforms: {
        uPR: { value: pr },
        uColor: { value: c.warn.clone() },
        uWarn: { value: c.danger },
      },
      transparent: true,
      depthWrite: false,
    });
    return { g, m, n };
  }, [pr, c]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const accent = params.accent === "accent" ? c.accent : c.warn;
    (lines.m.uniforms.uAccent!.value as THREE.Color).lerp(accent, Math.min(1, dt * 4));
    const grad = lines.m.uniforms.uGrad!;
    grad.value += ((params.accent === "accent" ? 1 : 0) - grad.value) * Math.min(1, dt * 4);
    (pulses.m.uniforms.uColor!.value as THREE.Color).copy(
      lines.m.uniforms.uAccent!.value as THREE.Color,
    );
    const level = lines.m.uniforms.uLevel!.value as number[];
    const tint = lines.m.uniforms.uTint!.value as number[];
    const fl = lines.m.uniforms.uFlash!.value as number[];
    const snap = lines.m.uniforms.uSnap!.value as number[];
    // The global Q-Day switch: every classical (untinted) arc cracks for its 6 s; sealed ones hold.
    const qday = world.qdayAt ? performance.now() - world.qdayAt : -1;
    for (let i = 0; i < N; i++) {
      if (qday >= 0 && qday < 6000 && tint[i]! < 0.5) {
        flash.current[i] = Math.max(flash.current[i]!, 0.9);
        snap[i] = 0.5;
      }
      // Traffic lights an arc up (an arc "spawns" with its packet), then it settles back.
      activity.current[i] = Math.max(0, activity.current[i]! - dt * 0.35);
      flash.current[i] = Math.max(0, flash.current[i]! - dt * 1.1);
      // While a scan result is on screen, only its arc speaks: traffic doesn't light other arcs.
      const quiet = world.scanActive && !!world.scan;
      const target = quiet
        ? params.arcLevel[i]!
        : Math.max(params.arcLevel[i]!, Math.min(0.55, 0.12 + activity.current[i]! * 0.45));
      level[i] = level[i]! + (target - level[i]!) * Math.min(1, dt * 3);
      const tintTarget = quiet
        ? 0
        : Math.max(params.arcTint[i]!, activity.current[i]! > 0.05 ? 1 : 0);
      tint[i] = tint[i]! + (tintTarget - tint[i]!) * Math.min(1, dt * 3);
      fl[i] = flash.current[i]!;
    }

    // Bake the arcs' colour × alpha per vertex into the thick lines (see the shader for the maths).
    {
      const arr = thick.buf.array as Float32Array;
      const accent = lines.m.uniforms.uAccent!.value as THREE.Color;
      const g = lines.m.uniforms.uGrad!.value as number;
      const sm = (e0: number, e1: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
      };
      const { acc, c: col } = mix3;
      for (let a = 0; a < N; a++) {
        const lv = level[a]!;
        const tn = tint[a]!;
        const flv = fl[a]!;
        const sn = snap[a]!;
        for (let i = 0; i < SEG; i++) {
          for (let e = 0; e < 2; e++) {
            const t = (i + e) / SEG;
            acc.copy(c.kem).lerp(c.sig, t);
            acc.lerpColors(accent, acc, g);
            col.copy(c.text).lerp(acc, tn).lerp(c.danger, flv);
            const ends = sm(0, 0.05, t) * (1 - sm(0.95, 1, t));
            const gap = flv > 0 ? sm(0, 0.01, Math.abs(t - sn) - (1 - flv) * 0.12) : 1;
            const al = Math.max(lv * 0.55, flv * 0.9) * ends * gap;
            const k = ((a * SEG + i) * 2 + e) * 3;
            arr[k] = col.r * al;
            arr[k + 1] = col.g * al;
            arr[k + 2] = col.b * al;
          }
        }
      }
      thick.buf.needsUpdate = true;
      const w = view.width * pr;
      const h = view.height * pr;
      (thick.core.material as LineMaterial).resolution.set(w, h);
      (thick.glow.material as LineMaterial).resolution.set(w, h);
      (thick.core.material as LineMaterial).linewidth = 2 * pr;
      (thick.glow.material as LineMaterial).linewidth = 7 * pr;
    }

    // Live packets: at most one per arc in flight, so at most 12 on screen.
    while (world.pulses.length) {
      const q = world.pulses.shift()!;
      if (q.arc < 0 || q.arc >= N) continue;
      activity.current[q.arc] = Math.min(1, activity.current[q.arc]! + 0.6);
      if (live.current.some((l) => l.arc === q.arc && l.size < 20)) continue;
      live.current.push({
        arc: q.arc,
        t: 0,
        speed: q.speed ?? 0.3,
        size: q.size ?? 9,
        reverse: !!q.reverse,
        doomed: !!q.doomed,
        arriveAt: q.arriveAt,
        info: q.info,
      });
    }
    if (params.sparkArc >= 0) {
      spark.current += dt;
      if (!live.current.some((l) => l.size >= 20))
        live.current.push({
          arc: params.sparkArc,
          t: 0,
          speed: 0.18,
          size: 22,
          reverse: false,
          doomed: false,
        });
      if (spark.current > 0.08 && live.current.length < pulses.n) {
        spark.current = 0;
        live.current.push({
          arc: params.sparkArc,
          t: 0,
          speed: 0.5,
          size: 4,
          reverse: false,
          doomed: false,
        });
      }
    }

    const pos = pulses.g.attributes.position!.array as Float32Array;
    const size = pulses.g.attributes.aSize!.array as Float32Array;
    const warn = pulses.g.attributes.aWarn!.array as Float32Array;
    size.fill(0);
    let k = 0;
    // Compacted in place (no new array per frame).
    const list = live.current;
    let keep = 0;
    for (const l of list) {
      l.t += dt * l.speed;
      if (l.doomed && l.t >= 0.5) {
        // Snap: the tampered packet dies at the break point and the arc flashes saffron.
        flash.current[l.arc] = 1;
        snap[l.arc] = 0.5;
        continue;
      }
      if (l.t >= 1) {
        world.harvested++;
        if (l.arriveAt && params.accent === "accent")
          world.ripples.push({ city: l.arriveAt, at: performance.now() });
        continue;
      }
      if (k < pulses.n) {
        pointOnArc(l.arc, l.reverse ? 1 - l.t : l.t, tmp);
        set3(pos, k, tmp.x, tmp.y, tmp.z);
        warn[k] = l.doomed ? Math.min(1, l.t * 2) : 0;
        slots.current[k] = l;
        size[k++] = l.size * Math.min(1, level[l.arc]! * 1.6 + 0.25);
      }
      list[keep++] = l;
    }
    list.length = keep;
    drawn.current = k;
    pulses.g.attributes.position!.needsUpdate = true;
    pulses.g.attributes.aSize!.needsUpdate = true;
    pulses.g.attributes.aWarn!.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <primitive object={thick.glow} />
      <primitive object={thick.core} />
      <points geometry={pulses.g} material={pulses.m} frustumCulled={false} />
    </group>
  );
}
