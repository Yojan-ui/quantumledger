"use client";

/**
 * Systems across India, the five adapter sockets, and the route cities (with light pillars that
 * grow with each city's live operations). Route cities are hoverable
 * (a tooltip shows their live counts) and ripple once when a sealed packet arrives.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { params } from "./director";
import { NODES, ROUTE_CITIES, SOCKETS } from "./geo";
import { palette } from "./palette";
import { setHover, world } from "./store";

const o = new THREE.Object3D();
const v = new THREE.Vector3();
const RIPPLE_MS = 900;
const MAX_RIPPLES = 16;

function place(mesh: THREE.InstancedMesh, i: number, pos: THREE.Vector3, scale: number) {
  o.position.copy(pos);
  o.lookAt(pos.clone().multiplyScalar(2));
  o.scale.setScalar(scale);
  o.updateMatrix();
  mesh.setMatrixAt(i, o.matrix);
}

/** A city pillar: a thin light column standing on the surface, growing with live operations. */
function placePillar(mesh: THREE.InstancedMesh, i: number, pos: THREE.Vector3, height: number) {
  o.position.copy(pos);
  o.lookAt(pos.clone().multiplyScalar(2));
  o.scale.set(1, 1, Math.max(0.0001, height));
  o.updateMatrix();
  mesh.setMatrixAt(i, o.matrix);
}

const CITY_INDEX = new Map<string, number>(ROUTE_CITIES.map((c, i) => [c.id, i]));

export function Nodes() {
  const c = useMemo(palette, []);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dots = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const sockets = useRef<THREE.InstancedMesh>(null);
  const cities = useRef<THREE.InstancedMesh>(null);
  const ripples = useRef<THREE.InstancedMesh>(null);
  const pillars = useRef<THREE.InstancedMesh>(null);
  const heights = useRef(new Float32Array(ROUTE_CITIES.length));
  const pillarGeo = useMemo(() => {
    // Unit-length column along +Z (outwards after lookAt), base on the surface.
    const g = new THREE.CylinderGeometry(0.0026, 0.0026, 1, 6, 1, true);
    g.translate(0, 0.5, 0);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const active = useRef<{ city: number; at: number }[]>([]);
  const safe = useRef(new Float32Array(NODES.length));
  const vis = useRef(0);
  const sockVis = useRef(0);
  const col = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3);
    vis.current += (params.nodes - vis.current) * k;
    sockVis.current += (params.sockets - sockVis.current) * k;
    const d = dots.current;
    const r = rings.current;
    const s = sockets.current;
    const ct = cities.current;
    const rp = ripples.current;
    if (!d || !r || !s || !ct || !rp) return;
    NODES.forEach((n, i) => {
      safe.current[i]! += (params.nodeSafe[i]! - safe.current[i]!) * k;
      const on = world.mode !== "deploy" || n.sector === world.sector ? 1 : 0;
      place(d, i, n.pos, 0.011 * vis.current * on);
      col.copy(c.text3).lerp(c.accent, safe.current[i]!);
      d.setColorAt(i, col);
      place(r, i, n.pos, 0.024 * vis.current * on * (safe.current[i]! > 0.5 ? 1 : 0));
    });
    SOCKETS.forEach((pos, i) => {
      const on = i === world.socket;
      place(s, i, pos, (on ? 0.03 : 0.018) * sockVis.current);
      s.setColorAt(i, on ? c.kem : c.text3);
    });

    // Where the highlighted socket is on screen, for the adapter row's connector line.
    const sock = SOCKETS[world.socket];
    if (sock && sockVis.current > 0.5) {
      v.copy(sock).applyMatrix4(s.matrixWorld).project(camera);
      world.socketScreen = { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    } else world.socketScreen = null;

    // Route cities: small neutral markers, hidden while the India dolly shows the systems instead.
    const cityScale = 0.007 * (1 - vis.current) * (world.mode === "story" ? 1 : 0);
    ROUTE_CITIES.forEach((city, i) => place(ct, i, city.pos, cityScale));
    // Pillar height = live sealed operations in that city (last 60 s), eased so it never jumps.
    const pl = pillars.current;
    if (pl) {
      ROUTE_CITIES.forEach((city, i) => {
        const ops = world.cityOps[city.id] ?? 0;
        const target = cityScale > 0 ? 0.012 + Math.min(0.16, (ops / 120) * 0.16) : 0;
        heights.current[i]! += (target - heights.current[i]!) * Math.min(1, dt * 1.5);
        placePillar(pl, i, city.pos, heights.current[i]!);
        // Hovering a city brightens its pillar from 60% to 100% of KEM.
        col.copy(c.kem).multiplyScalar(world.hover?.id === `city:${city.id}` ? 1 : 0.6);
        pl.setColorAt(i, col);
      });
      pl.instanceMatrix.needsUpdate = true;
      if (pl.instanceColor) pl.instanceColor.needsUpdate = true;
    }

    // Ripples: one ring per arrival, expanding and fading over RIPPLE_MS.
    const now = performance.now();
    while (world.ripples.length) {
      const q = world.ripples.shift()!;
      const ci = CITY_INDEX.get(q.city);
      if (ci !== undefined && active.current.length < MAX_RIPPLES)
        active.current.push({ city: ci, at: q.at });
    }
    active.current = active.current.filter((a) => now - a.at < RIPPLE_MS);
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const a = active.current[i];
      if (!a || cityScale === 0) {
        place(rp, i, ROUTE_CITIES[0]!.pos, 0);
        continue;
      }
      const t = (now - a.at) / RIPPLE_MS;
      place(rp, i, ROUTE_CITIES[a.city]!.pos, 0.01 + t * 0.03);
      col.copy(c.accent).multiplyScalar(1 - t);
      rp.setColorAt(i, col);
    }

    d.instanceMatrix.needsUpdate =
      r.instanceMatrix.needsUpdate =
      s.instanceMatrix.needsUpdate =
      ct.instanceMatrix.needsUpdate =
      rp.instanceMatrix.needsUpdate =
        true;
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
    if (s.instanceColor) s.instanceColor.needsUpdate = true;
    if (rp.instanceColor) rp.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, NODES.length]}
        onPointerOver={(e) => {
          if (vis.current < 0.5 || e.instanceId === undefined) return;
          const n = NODES[e.instanceId]!;
          setHover({ id: n.id, label: `${n.label} · ${n.city}` });
        }}
        onPointerOut={() => setHover(null)}
      >
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={rings} args={[undefined, undefined, NODES.length]} raycast={() => null}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshBasicMaterial
          color={c.accent}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={sockets}
        args={[undefined, undefined, SOCKETS.length]}
        raycast={() => null}
      >
        <ringGeometry args={[0.7, 1, 48]} />
        <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh
        ref={cities}
        args={[undefined, undefined, ROUTE_CITIES.length]}
        onPointerOver={(e) => {
          if (e.instanceId === undefined || vis.current > 0.5) return;
          const city = ROUTE_CITIES[e.instanceId]!;
          setHover({ id: `city:${city.id}`, label: city.label });
        }}
        onPointerOut={() => setHover(null)}
      >
        {/* Generous hit area: the visible dot is drawn smaller by the scale. */}
        <circleGeometry args={[1.6, 16]} />
        <meshBasicMaterial
          color={c.text}
          transparent
          opacity={0.55}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={pillars}
        args={[pillarGeo, undefined, ROUTE_CITIES.length]}
        raycast={() => null}
      >
        <meshBasicMaterial
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={ripples} args={[undefined, undefined, MAX_RIPPLES]} raycast={() => null}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial
          transparent
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
