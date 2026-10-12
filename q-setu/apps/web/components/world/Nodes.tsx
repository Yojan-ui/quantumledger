"use client";

/**
 * Systems across India, the five adapter sockets, and the route cities (with light pillars that
 * grow with each city's live operations). Route cities are hoverable
 * (a tooltip shows their live counts) and ripple once when a sealed packet arrives.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { params } from "./director";
import { NODES, ROUTE_CITIES, SOCKETS } from "./geo";
import { palette } from "./palette";
import { setHover, world } from "./store";
import { burst } from "@/lib/client/burst";

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

/** Demo 2: west → east rank of each node within its sector, for the 80 ms "all sealed" wave. */
const RANK = NODES.map((n) => NODES.filter((m) => m.sector === n.sector && m.lon < n.lon).length);
const RING_DROP_MS = 650;

/** A node's "dot model" when the camera flies to it: a small shell of points around the node. */
function modelGeometry() {
  const pts: number[] = [];
  const N = 90;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    pts.push(Math.cos(th) * r, y, Math.sin(th) * r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
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
  const model = useRef<THREE.Points>(null);
  const modelGeo = useMemo(modelGeometry, []);
  const modelVis = useRef(0);
  const dropAt = useRef(new Float64Array(NODES.length));
  const focusVis = useRef(0);

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
    const deploy = world.mode === "deploy";
    const focus = deploy ? (world.shot?.focus ?? null) : null;
    const now = performance.now();
    focusVis.current += ((focus ? 1 : 0) - focusVis.current) * k;
    modelVis.current += ((focus && world.shot?.model ? 1 : 0) - modelVis.current) * k;
    NODES.forEach((n, i) => {
      const was = safe.current[i]! > 0.5;
      safe.current[i]! += (params.nodeSafe[i]! - safe.current[i]!) * k;
      // Demo 2: a node that just became sealed drops a KEM ring onto itself.
      if (!was && safe.current[i]! > 0.5) dropAt.current[i] = now;
      const on = world.mode !== "deploy" || n.sector === world.sector ? 1 : 0;
      // Focus pull: the node in focus grows, the others shrink and dim.
      const isFocus = n.id === focus;
      const f = isFocus ? 1 + 0.6 * focusVis.current : 1 - 0.35 * focusVis.current;
      place(d, i, n.pos, 0.011 * vis.current * on * f);
      // On the deploy map a node is saffron (harvestable) until it's sealed, then OK.
      if (deploy) col.copy(c.warn).lerp(c.ok, safe.current[i]!);
      else col.copy(c.text3).lerp(c.accent, safe.current[i]!);
      if (!isFocus) col.multiplyScalar(1 - 0.5 * focusVis.current);
      d.setColorAt(i, col);
      const drop = dropAt.current[i]
        ? easeToken(Math.min(1, (now - dropAt.current[i]!) / RING_DROP_MS))
        : 1;
      const wave =
        deploy && world.waveAt
          ? Math.max(
              0,
              Math.sin(
                Math.PI * Math.min(1, Math.max(0, (now - world.waveAt - RANK[i]! * 80) / 500)),
              ),
            )
          : 0;
      place(
        r,
        i,
        n.pos,
        0.024 *
          vis.current *
          on *
          (safe.current[i]! > 0.5 ? 1 : 0) *
          (1 + 2.5 * (1 - drop) + 0.8 * wave),
      );
      if (isFocus && model.current) {
        model.current.position.copy(n.pos).multiplyScalar(1.02);
        model.current.scale.setScalar(Math.max(0.0001, 0.032 * easeToken(modelVis.current)));
        (model.current.material as THREE.PointsMaterial).color.copy(col);
      }
    });
    if (model.current) model.current.visible = modelVis.current > 0.01;

    // Where the focused node is on screen (for its anchored label), if it's inside the stage.
    const fi = focus ? NODES.findIndex((n) => n.id === focus) : -1;
    const fr = world.focusRect;
    if (fi >= 0 && fr) {
      v.copy(NODES[fi]!.pos).applyMatrix4(d.matrixWorld).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const inside = x > fr.left && x < fr.left + fr.width && y > fr.top && y < fr.top + fr.height;
      world.focusScreen = inside && v.z < 1 ? { x, y } : null;
    } else world.focusScreen = null;
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
      <points ref={model} geometry={modelGeo} visible={false} raycast={() => null}>
        <pointsMaterial size={0.006} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
      </points>
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
          setHover({ id: `city:${city.id}`, label: `${city.label} · click to seal a packet` });
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          if (e.instanceId === undefined || vis.current > 0.5) return;
          e.stopPropagation();
          const city = ROUTE_CITIES[e.instanceId]!;
          const at = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
          // A real transaction on a route from this city; the bus brings its packet back as an arc.
          void fetch("/api/seal-from", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ city: city.id }),
          }).then((r) => {
            if (!r.ok) return;
            world.ripples.push({ city: city.id, at: performance.now() });
            burst(at);
          });
        }}
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
