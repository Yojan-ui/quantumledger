"use client";

/**
 * The analogy strip's four small objects, one per step:
 *  0 locks       a padlock made of dots (today's encryption)
 *  1 master key  a glowing key that doesn't exist yet (a future quantum computer)
 *  2 copying     boxes travel past; a copy of each peels off into a vault (harvest now)
 *  3 new locks   the dotted padlock snaps onto a lattice: same shape, new lock (ML-KEM)
 * Each pauses when off screen; reduced motion shows the final pose, still.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";
import { easeToken } from "@/lib/ease";

const N = 520;

/** Deterministic pseudo-random numbers, so the models look the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

/** Points on a padlock: a box body and a half-torus shackle. */
function padlock(n = N): Float32Array {
  const r = rng(7);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (i < n * 0.68) {
      // Body surface: pick a face weighted by area.
      const W = 1.0,
        H = 0.78,
        D = 0.36;
      const f = r();
      const u = r() - 0.5,
        v = r() - 0.5;
      if (f < 0.6) [x, y, z] = [u * W, v * H, (r() < 0.5 ? -0.5 : 0.5) * D];
      else if (f < 0.8) [x, y, z] = [(r() < 0.5 ? -0.5 : 0.5) * W, v * H, u * D];
      else [x, y, z] = [u * W, (r() < 0.5 ? -0.5 : 0.5) * H, v * D];
      y -= 0.25;
    } else {
      // Shackle: upper half of a torus.
      const a = Math.PI * r();
      const b = 2 * Math.PI * r();
      const R = 0.31,
        t = 0.055;
      x = (R + t * Math.cos(b)) * Math.cos(a);
      y = 0.14 + (R + t * Math.cos(b)) * Math.sin(a);
      z = t * Math.sin(b);
    }
    out.set([x, y, z], i * 3);
  }
  return out;
}

/** The same padlock snapped to a skewed 3D lattice (the picture behind lattice cryptography). */
function latticeLock(src: Float32Array): Float32Array {
  const out = new Float32Array(src.length);
  const a = new THREE.Vector3(0.11, 0, 0);
  const b = new THREE.Vector3(0.035, 0.105, 0);
  const c = new THREE.Vector3(0.02, 0.02, 0.1);
  const m = new THREE.Matrix3().set(a.x, b.x, c.x, a.y, b.y, c.y, a.z, b.z, c.z);
  const inv = m.clone().invert();
  const p = new THREE.Vector3();
  for (let i = 0; i < src.length; i += 3) {
    p.set(src[i]!, src[i + 1]!, src[i + 2]!).applyMatrix3(inv);
    p.set(Math.round(p.x), Math.round(p.y), Math.round(p.z)).applyMatrix3(m);
    out.set([p.x, p.y, p.z], i);
  }
  return out;
}

/** A key: a ring bow, a shaft and three teeth. */
function keyShape(n = 420): Float32Array {
  const r = rng(11);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x: number, y: number;
    const f = r();
    if (f < 0.45) {
      const a = 2 * Math.PI * r();
      const rad = 0.26 + (r() - 0.5) * 0.06;
      [x, y] = [-0.55 + rad * Math.cos(a), rad * Math.sin(a)];
    } else if (f < 0.85) {
      [x, y] = [-0.29 + r() * 0.95, (r() - 0.5) * 0.07];
    } else {
      const tooth = Math.floor(r() * 3);
      [x, y] = [0.38 + tooth * 0.1 + (r() - 0.5) * 0.05, -0.04 - r() * (0.12 + tooth * 0.04)];
    }
    out.set([x, y, (r() - 0.5) * 0.05], i * 3);
  }
  return out;
}

function Dots({
  positions,
  color,
  size = 0.028,
  glow = false,
}: {
  positions: Float32Array;
  color: THREE.Color;
  size?: number;
  glow?: boolean;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    return g;
  }, [positions]);
  return (
    <points geometry={geo}>
      <pointsMaterial
        color={color}
        size={size}
        transparent
        opacity={glow ? 0.5 : 0.85}
        depthWrite={false}
        blending={glow ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  );
}

export default function AnalogyModel({
  step,
  active,
  reduce,
}: {
  step: 0 | 1 | 2 | 3;
  active: boolean;
  reduce: boolean;
}) {
  const c = useMemo(palette, []);
  const group = useRef<THREE.Group>(null);
  const lock = useMemo(() => padlock(), []);
  const lattice = useMemo(() => latticeLock(lock), [lock]);
  const key = useMemo(() => keyShape(), []);
  const morph = useRef<THREE.Points>(null);
  const morphMat = useRef<THREE.PointsMaterial>(null);
  const boxes = useRef<(THREE.Group | null)[]>([]);
  const copies = useRef<(THREE.Group | null)[]>([]);
  const boxGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.16, 0.16, 0.16)),
    [],
  );
  const vaultGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.7, 0.42, 0.42)),
    [],
  );
  const morphGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(lock.slice(), 3));
    return g;
  }, [lock]);
  const tint = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    if (!active) return;
    const t = reduce ? 0 : clock.elapsedTime;
    if (group.current) group.current.rotation.y = reduce ? -0.45 : -0.45 + Math.sin(t * 0.5) * 0.35;
    if (step === 1 && group.current)
      group.current.rotation.z = reduce ? 0.2 : 0.2 + Math.sin(t * 1.3) * 0.05;
    if (step === 2) {
      // Each box crosses left to right in 3 s; past the middle its copy rises into the vault.
      boxes.current.forEach((b, i) => {
        const k = reduce ? (i + 0.5) / 4 : (t / 3 + i / 4) % 1;
        if (b) b.position.set(-1.1 + 2.2 * k, -0.45, 0);
        const cp = copies.current[i];
        if (!cp) return;
        const up = reduce ? 1 : easeToken(Math.min(1, Math.max(0, (k - 0.42) / 0.35)));
        cp.visible = k > 0.42 || reduce;
        cp.position.set(-1.1 + 2.2 * Math.min(k, 0.42) + up * 0.3, -0.45 + up * 0.88, 0);
        cp.scale.setScalar(1 - up * 0.45);
      });
    }
    if (step === 3 && morph.current && morphMat.current) {
      // Hold as a dotted padlock, snap onto the lattice, hold, and back: a 6 s loop.
      const ph = reduce ? 0.5 : (t / 6) % 1;
      const m =
        ph < 0.2
          ? 0
          : ph < 0.35
            ? (ph - 0.2) / 0.15
            : ph < 0.8
              ? 1
              : ph < 0.95
                ? 1 - (ph - 0.8) / 0.15
                : 0;
      const e = easeToken(m);
      const pos = morphGeo.attributes.position!.array as Float32Array;
      for (let i = 0; i < pos.length; i++) pos[i] = lock[i]! + (lattice[i]! - lock[i]!) * e;
      morphGeo.attributes.position!.needsUpdate = true;
      morphMat.current.color.copy(tint.copy(c.text3).lerp(c.kem, e));
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.1, 3]} fov={36} />
      <group ref={group}>
        {step === 0 && <Dots positions={lock} color={c.text} />}
        {step === 1 && <Dots positions={key} color={c.warn} size={0.04} glow />}
        {step === 3 && (
          <points ref={morph} geometry={morphGeo}>
            <pointsMaterial
              ref={morphMat}
              color={c.text3}
              size={0.028}
              transparent
              opacity={0.9}
              depthWrite={false}
              toneMapped={false}
            />
          </points>
        )}
      </group>
      {step === 2 && (
        <>
          <lineSegments geometry={vaultGeo} position={[0.35, 0.55, 0]} rotation={[0.3, -0.5, 0]}>
            <lineBasicMaterial color={c.warn} toneMapped={false} />
          </lineSegments>
          {[0, 1, 2, 3].map((i) => (
            <group key={i}>
              <group ref={(g) => void (boxes.current[i] = g)}>
                <lineSegments geometry={boxGeo}>
                  <lineBasicMaterial color={c.kem} toneMapped={false} />
                </lineSegments>
              </group>
              <group ref={(g) => void (copies.current[i] = g)} visible={false}>
                <lineSegments geometry={boxGeo}>
                  <lineBasicMaterial color={c.warn} transparent opacity={0.8} toneMapped={false} />
                </lineSegments>
              </group>
            </group>
          ))}
        </>
      )}
    </>
  );
}
