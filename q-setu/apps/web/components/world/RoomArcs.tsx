"use client";

/**
 * Audience packets. Each message a phone seals flies as an arc from a random Indian city to the
 * QuantumLedger node, drawn on in 900 ms with a gradient in that visitor's colours, and ripples the node
 * when it arrives (the server has opened it by then: the arc is queued from the server's verdict).
 * A tampered packet travels in --danger, stops halfway and shatters.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HUB, roomCity, VISITOR_COLOURS } from "@/data/room";
import { easeToken } from "./director";
import { arcPoints, toVec3 } from "./geo";
import { palette } from "./palette";
import { world } from "./store";
import { set3 } from "@/components/scenes/geometry";

const SEG = 80;
const POOL = 12;
const SHARDS = 24;
const DRAW_MS = 900;
const HOLD_MS = 1600;
const SHATTER_MS = 600;

interface Slot {
  line: THREE.Line;
  geo: THREE.BufferGeometry;
  mat: THREE.LineBasicMaterial;
  start: number;
  ok: boolean;
  mid: THREE.Vector3;
  live: boolean;
  rippled: boolean;
}

export function RoomArcs() {
  const c = useMemo(palette, []);
  const hub = useMemo(() => toVec3(HUB[0], HUB[1]), []);
  const slots = useMemo<Slot[]>(
    () =>
      Array.from({ length: POOL }, () => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
        geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
        const mat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
        });
        const line = new THREE.Line(geo, mat);
        line.visible = false;
        line.frustumCulled = false;
        return {
          line,
          geo,
          mat,
          start: 0,
          ok: true,
          mid: new THREE.Vector3(),
          live: false,
          rippled: false,
        };
      }),
    [],
  );
  const shards = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POOL * SHARDS * 3), 3));
    const m = new THREE.PointsMaterial({
      color: c.danger,
      size: 0.018,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    const dirs = Array.from({ length: POOL * SHARDS }, () =>
      new THREE.Vector3().randomDirection().multiplyScalar(0.05 + Math.random() * 0.12),
    );
    return { g, m, p, dirs };
  }, [c]);
  const next = useRef(0);
  const ca = useMemo(() => new THREE.Color(), []);
  const cb = useMemo(() => new THREE.Color(), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const now = performance.now();
    const reduce = !world.breathe;
    // Launch queued packets into the pool (oldest slot is reused if all are busy).
    while (world.roomShots.length) {
      const s = world.roomShots.shift()!;
      const slot = slots[next.current++ % POOL]!;
      const city = roomCity(s.city);
      const pts = arcPoints(toVec3(city.at[0], city.at[1]), hub, SEG);
      const pos = slot.geo.attributes.position!.array as Float32Array;
      const col = slot.geo.attributes.color!.array as Float32Array;
      const v = VISITOR_COLOURS[s.colour % VISITOR_COLOURS.length]!;
      ca.copy(c[v.a]).lerp(c[v.b], v.mix);
      cb.copy(c[v.b]);
      pts.forEach((p, i) => {
        set3(pos, i, p.x, p.y, p.z);
        // A gradient along the arc between the visitor's two role colours; --danger if tampered.
        if (s.ok) tmp.copy(ca).lerp(cb, i / SEG);
        else tmp.copy(c.danger);
        set3(col, i, tmp.r, tmp.g, tmp.b);
      });
      slot.mid.copy(pts[Math.floor(SEG / 2)]!);
      slot.geo.attributes.position!.needsUpdate = slot.geo.attributes.color!.needsUpdate = true;
      slot.start = now;
      slot.ok = s.ok;
      slot.live = true;
      slot.rippled = false;
      slot.line.visible = true;
    }
    const sp = shards.g.attributes.position!.array as Float32Array;
    let anyShard = false;
    slots.forEach((slot, k) => {
      if (!slot.live) return;
      const t = now - slot.start;
      const reach = slot.ok ? 1 : 0.5;
      const draw = reduce ? reach : easeToken(Math.min(1, t / (DRAW_MS * reach))) * reach;
      slot.geo.setDrawRange(0, Math.max(2, Math.round(draw * SEG) + 1));
      if (slot.ok) {
        if (!slot.rippled && t > DRAW_MS) {
          slot.rippled = true;
          world.ripples.push({ city: "mumbai", at: now });
        }
        const fade = t > DRAW_MS + HOLD_MS ? 1 - (t - DRAW_MS - HOLD_MS) / 800 : 1;
        slot.mat.opacity = Math.max(0, fade) * 0.95;
        if (fade <= 0) slot.live = slot.line.visible = false;
      } else {
        // Halfway, the packet fails the check and shatters.
        const st = t - DRAW_MS * 0.5;
        slot.mat.opacity = st < 0 ? 0.95 : Math.max(0, 0.95 - st / 500);
        if (st >= 0 && st < SHATTER_MS && !reduce) {
          anyShard = true;
          const e = easeToken(st / SHATTER_MS);
          for (let i = 0; i < SHARDS; i++) {
            const d = shards.dirs[k * SHARDS + i]!;
            sp.set(
              [slot.mid.x + d.x * e, slot.mid.y + d.y * e, slot.mid.z + d.z * e],
              (k * SHARDS + i) * 3,
            );
          }
        } else {
          // Parked beyond the far plane.
          for (let i = 0; i < SHARDS; i++) set3(sp, k * SHARDS + i, 0, 0, 1000);
        }
        if (st > Math.max(SHATTER_MS, 500)) slot.live = slot.line.visible = false;
      }
    });
    shards.p.visible = anyShard;
    shards.m.opacity = 0.9;
    if (anyShard) shards.g.attributes.position!.needsUpdate = true;
  });

  return (
    <>
      {slots.map((s, i) => (
        <primitive key={i} object={s.line} />
      ))}
      <primitive object={shards.p} />
    </>
  );
}
