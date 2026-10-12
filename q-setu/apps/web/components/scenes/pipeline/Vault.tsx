"use client";

/**
 * The adversary's storage: a red cylinder below the link with a thin tap beam up to it. Each packet
 * that passes is copied: a red copy peels off and drops into the cylinder, and its counter rolls up.
 * The counter counts the packets this scene animates (labelled "sim"), not real captures.
 * After the fix the beam snaps back, the cylinder dims and the counter freezes.
 */
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { LINK_MID, VAULT } from "./geometry";
import type { Look } from "./look";

const POOL = 10;
const DROP_MS = 900;

export interface Taps {
  /** When each copy started falling (performance.now()), ring buffer. */
  drops: number[];
  next: number;
  count: number;
}

export function Vault({
  look,
  taps,
}: {
  look: React.RefObject<Look>;
  taps: React.RefObject<Taps>;
}) {
  const cyl = useMemo(
    () => new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 16, 3, true)),
    [],
  );
  const cylMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const top = useMemo(() => VAULT.clone().add(new THREE.Vector3(0, 0.6, 0)), []);
  const beam = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([top, LINK_MID]);
    return new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    );
  }, [top]);
  const copyGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.14, 0.14, 0.14)),
    [],
  );
  const copyMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const copies = useRef<(THREE.LineSegments | null)[]>([]);
  const counter = useRef<HTMLSpanElement>(null);
  const shown = useRef(-1);

  useFrame(({ clock }) => {
    const L = look.current;
    const T = taps.current;
    if (!L?.active || !T) return;
    const fixed = L.since.patch < Infinity;
    const snap = fixed ? (L.reduce ? 1 : Math.min(1, L.since.patch / 600)) : 0;
    const harvesting = L.stage >= 0 && L.since.scan < Infinity;
    cylMat.color.copy(harvesting ? L.c.danger : L.c.text3);
    cylMat.opacity = (fixed ? 0.25 : harvesting ? 0.8 : 0.3) * L.dim("vault");
    // The tap beam pulses while recording and pulls back into the cylinder when it snaps.
    const bm = beam.material as THREE.LineBasicMaterial;
    const pos = beam.geometry.attributes.position!.array as Float32Array;
    const end = LINK_MID.clone().lerp(top, easeToken(snap));
    pos.set([end.x, end.y, end.z], 3);
    beam.geometry.attributes.position!.needsUpdate = true;
    bm.color.copy(L.c.danger);
    bm.opacity = harvesting
      ? (1 - snap) *
        (0.35 + (L.reduce ? 0 : 0.25 * Math.sin(clock.elapsedTime * 6))) *
        L.dim("vault")
      : 0;
    // Copies fall from the link into the cylinder.
    copyMat.color.copy(L.c.danger);
    copies.current.forEach((c, i) => {
      if (!c) return;
      const t0 = T.drops[i] ?? 0;
      const k = t0 ? (L.now - t0) / DROP_MS : 2;
      c.visible = k >= 0 && k < 1 && !L.reduce;
      if (!c.visible) return;
      c.position.copy(LINK_MID).lerp(VAULT, easeToken(k));
      c.rotation.set(k * 4, k * 3, 0);
    });
    copyMat.opacity = 0.9 * L.dim("vault");
    // The counter rolls only while recording; it freezes once the wiretap is dissolved.
    if (counter.current && shown.current !== T.count) {
      shown.current = T.count;
      counter.current.textContent = T.count.toLocaleString("en-IN");
    }
  });

  return (
    <group>
      <lineSegments geometry={cyl} material={cylMat} position={VAULT} />
      <primitive object={beam} />
      {Array.from({ length: POOL }, (_, i) => (
        <lineSegments
          key={i}
          ref={(c) => void (copies.current[i] = c)}
          geometry={copyGeo}
          material={copyMat}
          visible={false}
        />
      ))}
      <Html
        position={[VAULT.x - 2.1, VAULT.y + 0.5, VAULT.z]}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          aria-hidden
          className="whitespace-nowrap rounded-sm border border-line bg-base px-2 py-1 font-mono text-micro uppercase text-danger"
        >
          adversary storage
          <span className="block normal-case text-fg">
            <span ref={counter} className="tabular">
              0
            </span>{" "}
            packets copied (sim)
          </span>
        </div>
      </Html>
    </group>
  );
}

/** Records one copied packet (called by the link as a packet passes the tap). */
export function tap(T: Taps, now: number) {
  T.drops[T.next] = now;
  T.next = (T.next + 1) % POOL;
  T.count++;
}
