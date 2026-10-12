"use client";

/**
 * The client, the server and the link between them.
 *  - Before the fix: two lattice-edged boxes and a red link arcing over the sphere; handshake packets
 *    travel it, and each one passing the wiretap is copied (`onCopy`, the vault counts them).
 *  - DEFEND (the real hybrid handshake): the link cracks and shatters into shards, the boxes become
 *    glowing icospheres, and a thick arc of flowing particles in --kem joins them.
 *  - RESCAN: the endpoints and the arc turn --ok as the radar passes.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { CLIENT, LINK, rng, SERVER } from "./geometry";
import type { Look } from "./look";

const SHATTER_MS = 900;
const ARC_N = 420;
const SHARDS = 48;
const LUT = LINK.getSpacedPoints(200);
const at = (t: number, out: THREE.Vector3) => {
  const x = Math.max(0, Math.min(0.9999, t)) * (LUT.length - 1);
  const i = Math.floor(x);
  return out.copy(LUT[i]!).lerp(LUT[i + 1]!, x - i);
};

/** A cube's edges plus its faces' midlines: a lattice cube. */
function latticeCube(size: number): THREE.BufferGeometry {
  const h = size / 2;
  const seg: number[] = [];
  const line = (a: number[], b: number[]) => seg.push(...a, ...b);
  for (const s of [-h, 0, h])
    for (const t of [-h, 0, h]) {
      line([-h, s, t], [h, s, t]);
      line([s, -h, t], [s, h, t]);
      line([s, t, -h], [s, t, h]);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  return g;
}

function Endpoint({
  at: pos,
  look,
  azimuth,
}: {
  at: THREE.Vector3;
  look: React.RefObject<Look>;
  azimuth: number;
}) {
  const cube = useMemo(() => latticeCube(0.9), []);
  const cubeMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const ico = useMemo(() => new THREE.IcosahedronGeometry(0.42, 1), []);
  const icoEdges = useMemo(() => new THREE.EdgesGeometry(ico), [ico]);
  const fill = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const edge = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const halo = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const L = look.current;
    if (!L?.active || !a.current || !b.current) return;
    const k = L.morph;
    const g = L.green(azimuth);
    a.current.scale.setScalar(Math.max(0.001, 1 - k));
    a.current.rotation.y = L.reduce ? 0.5 : clock.elapsedTime * 0.2;
    b.current.scale.setScalar(Math.max(0.001, k));
    b.current.rotation.y = L.reduce ? 0 : clock.elapsedTime * 0.5;
    cubeMat.color.copy(L.c.text3).lerp(L.c.danger, L.stage >= 0 ? 0.6 : 0);
    cubeMat.opacity = 0.8 * L.dim("link");
    fill.color.copy(L.c.kem).lerp(L.c.ok, g);
    fill.opacity = 0.35 * L.dim("link");
    edge.color.copy(L.c.text).lerp(L.c.ok, g);
    edge.opacity = 0.9 * L.dim("link");
    halo.color.copy(fill.color);
    halo.opacity = 0.05 * k * L.dim("link");
  });
  return (
    <group position={pos}>
      <group ref={a}>
        <lineSegments geometry={cube} material={cubeMat} />
      </group>
      <group ref={b}>
        <mesh geometry={ico} material={fill} />
        <lineSegments geometry={icoEdges} material={edge} />
        {/* A soft additive halo: the glow, without a bloom pass over the shared canvas. */}
        <mesh scale={1.45} material={halo}>
          <sphereGeometry args={[0.42, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
}

export function Link({ look, onCopy }: { look: React.RefObject<Look>; onCopy: () => void }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(LUT);
    const m = new THREE.LineBasicMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return new THREE.Line(g, m);
  }, []);
  const packets = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 3), 3));
    const m = new THREE.PointsMaterial({
      size: 0.16,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return p;
  }, []);
  const shards = useMemo(() => {
    const r = rng(11);
    const from = new Float32Array(SHARDS * 3);
    const dir = new Float32Array(SHARDS * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < SHARDS; i++) {
      at(i / (SHARDS - 1), v);
      from.set([v.x, v.y, v.z], i * 3);
      dir.set([(r() - 0.5) * 2.4, (r() - 0.2) * 2, (r() - 0.5) * 2.4], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(from.slice(), 3));
    const m = new THREE.PointsMaterial({
      size: 0.09,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return { p, g, m, from, dir };
  }, []);
  const arc = useMemo(() => {
    const r = rng(5);
    const seed = Array.from({ length: ARC_N }, () => [
      r(),
      (r() - 0.5) * 0.16,
      (r() - 0.5) * 0.16,
      0.6 + r() * 0.8,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3));
    const m = new THREE.PointsMaterial({
      size: 0.05,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return { p, g, m, seed };
  }, []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const lastPhase = useRef([0, 0, 0]);
  const t = useRef(0);

  useFrame((_, dt) => {
    const L = look.current;
    if (!L?.active) return;
    t.current += L.reduce ? 0 : Math.min(dt, 0.1);
    const lm = line.material as THREE.LineBasicMaterial;
    const fixed = L.since.patch < Infinity;
    const sh = fixed ? Math.min(1, L.since.patch / SHATTER_MS) : 0;
    // The red link: crackles before it breaks, gone once shattered.
    lm.color.copy(L.stage >= 0 ? L.c.danger : L.c.text3);
    lm.opacity = fixed ? 0 : (L.stage >= 0 ? 0.75 : 0.25) * L.dim("link");
    // Packets: three handshakes in flight until the fix; each copied as it passes the tap.
    const pp = packets.geometry.attributes.position!.array as Float32Array;
    (packets.material as THREE.PointsMaterial).color.copy(L.c.danger);
    (packets.material as THREE.PointsMaterial).opacity =
      fixed || L.stage < 0 ? 0 : 0.95 * L.dim("link");
    for (let i = 0; i < 3; i++) {
      const ph = (t.current * 0.32 + i / 3) % 1;
      at(ph, v);
      pp.set([v.x, v.y, v.z], i * 3);
      if (!fixed && L.stage >= 0 && lastPhase.current[i]! < 0.5 && ph >= 0.5) onCopy();
      lastPhase.current[i] = ph;
    }
    packets.geometry.attributes.position!.needsUpdate = true;
    // The shatter: shards fly out and fall over 0.9 s after the real handshake.
    shards.p.visible = fixed && sh < 1 && !L.reduce;
    if (shards.p.visible) {
      const e = easeToken(sh);
      const sp = shards.g.attributes.position!.array as Float32Array;
      for (let i = 0; i < SHARDS; i++) {
        sp[i * 3] = shards.from[i * 3]! + shards.dir[i * 3]! * e;
        sp[i * 3 + 1] = shards.from[i * 3 + 1]! + shards.dir[i * 3 + 1]! * e - 2.2 * sh * sh;
        sp[i * 3 + 2] = shards.from[i * 3 + 2]! + shards.dir[i * 3 + 2]! * e;
      }
      shards.g.attributes.position!.needsUpdate = true;
      shards.m.color.copy(L.c.danger).lerp(L.c.text, sh);
      shards.m.opacity = 1 - sh;
    }
    // The new link: particles flowing client → server in --kem (green once verified).
    const grow = fixed
      ? L.reduce
        ? 1
        : easeToken(Math.min(1, Math.max(0, (L.since.patch - 500) / 800)))
      : 0;
    arc.p.visible = grow > 0;
    if (grow > 0) {
      const ap = arc.g.attributes.position!.array as Float32Array;
      for (let i = 0; i < ARC_N; i++) {
        const [s0, ox, oz, sp] = arc.seed[i]!;
        const tt = ((s0! + t.current * 0.18 * sp!) % 1) * grow;
        at(tt, v);
        ap.set([v.x + ox!, v.y + ox! * 0.5, v.z + oz!], i * 3);
      }
      arc.g.attributes.position!.needsUpdate = true;
      arc.m.color.copy(L.c.kem).lerp(L.c.ok, L.green(Math.PI / 2));
      arc.m.opacity = 0.9 * L.dim("link");
    }
  });

  return (
    <>
      <primitive object={line} />
      <primitive object={packets} />
      <primitive object={shards.p} />
      <primitive object={arc.p} />
      <Endpoint at={CLIENT} look={look} azimuth={Math.PI} />
      <Endpoint at={SERVER} look={look} azimuth={0.001} />
    </>
  );
}
