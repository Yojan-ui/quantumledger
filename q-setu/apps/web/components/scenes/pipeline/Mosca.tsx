"use client";

/**
 * SCORE in 3D. "X + Y ? Z" forms out of particles above the sphere when the real score arrives; the
 * "?" resolves to ">" (red: the data outlives its lock) or "<" (green), wired to the Mosca sliders.
 * An orange countdown ring around the sphere drains to the share of the data's shelf life (X + Y)
 * that falls before the estimated Q-Day (Z's low end, from facts.ts); the rest glows red.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { mosca } from "@/lib/mosca";
import { R, rng, textPoints } from "./geometry";
import type { Look } from "./look";

const RING_N = 160;
const RING_R = R * 1.42;

export function Mosca({
  look,
  x,
  y,
  count,
}: {
  look: React.RefObject<Look>;
  x: number;
  y: number;
  count: number;
}) {
  const m = mosca(x, y);
  const sets = useMemo(() => {
    const scatter = new Float32Array(count * 3);
    const r = rng(3);
    for (let i = 0; i < count; i++)
      scatter.set([(r() - 0.5) * R * 2, (r() - 0.5) * R * 2, (r() - 0.5) * R * 2], i * 3);
    return {
      scatter,
      q: textPoints("X + Y ? Z", count, 0.85),
      gt: textPoints("X + Y > Z", count, 0.85),
      lt: textPoints("X + Y < Z", count, 0.85),
    };
  }, [count]);
  const pts = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.PointsMaterial({
      size: 0.03,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new THREE.Points(g, mat);
    p.frustumCulled = false;
    return { p, g, mat };
  }, [count]);
  const ring = useMemo(() => {
    const mk = () => {
      const g = new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: RING_N + 1 }, (_, i) => {
          const a = (i / RING_N) * Math.PI * 2 + Math.PI / 2;
          return new THREE.Vector3(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R);
        }),
      );
      return new THREE.Line(
        g,
        new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
      );
    };
    return { safe: mk(), exposed: mk() };
  }, []);
  const resolvedAt = useRef(0);
  const verdict = m?.exposed ? "gt" : "lt";
  useEffect(() => void (resolvedAt.current = 0), [verdict]);

  useFrame(() => {
    const L = look.current;
    if (!L?.active) return;
    const scored = L.since.score < Infinity;
    const onStage = L.stage === 1;
    const k = scored ? (L.reduce ? 1 : easeToken(Math.min(1, L.since.score / 900))) : 0;
    // The question forms first; the answer replaces the "?" 0.9 s later (or when the sliders move).
    if (scored && !resolvedAt.current && k >= 1) resolvedAt.current = L.now;
    const res = resolvedAt.current
      ? L.reduce
        ? 1
        : easeToken(Math.min(1, (L.now - resolvedAt.current) / 500))
      : 0;
    const target = verdict === "gt" ? sets.gt : sets.lt;
    const p = pts.g.attributes.position!.array as Float32Array;
    for (let i = 0; i < p.length; i++) {
      const formed = sets.scatter[i]! + (sets.q[i]! - sets.scatter[i]!) * k;
      p[i] = formed + (target[i]! - sets.q[i]!) * res;
    }
    pts.g.attributes.position!.needsUpdate = true;
    pts.p.position.set(0, R + 0.95 + L.lift, 0.6);
    pts.mat.color.copy(L.c.warn).lerp(verdict === "gt" ? L.c.danger : L.c.ok, res);
    pts.mat.opacity =
      (onStage ? 0.95 : scored && L.since.patch === Infinity ? 0.12 : 0) * L.dim("mosca");
    // The countdown ring: drains to the part of the shelf life before the estimated Q-Day.
    const frac = m ? Math.max(0, Math.min(1, m.z.low / m.sum)) : 1;
    const drain = scored ? (L.reduce ? 1 : easeToken(Math.min(1, L.since.score / 2500))) : 0;
    const safeN = Math.round(RING_N * (1 - (1 - frac) * drain));
    ring.safe.geometry.setDrawRange(0, Math.max(0, safeN) + 1);
    ring.exposed.geometry.setDrawRange(safeN, RING_N - safeN + 1);
    for (const [line, col] of [
      [ring.safe, L.c.warn],
      [ring.exposed, L.c.danger],
    ] as const) {
      line.position.y = L.lift;
      const mat = line.material as THREE.LineBasicMaterial;
      mat.color.copy(col);
      mat.opacity =
        scored && L.since.patch === Infinity ? (onStage ? 0.9 : 0.35) * L.dim("mosca") : 0;
    }
  });

  return (
    <>
      <primitive object={pts.p} />
      <primitive object={ring.safe} />
      <primitive object={ring.exposed} />
    </>
  );
}
