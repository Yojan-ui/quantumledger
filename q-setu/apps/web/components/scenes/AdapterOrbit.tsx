"use client";

/**
 * Deploy anywhere: the five adapters as five different objects on a ring, in dark brushed metal with
 * a rim light, and a camera that orbits the ring to face whichever adapter's card is in view
 * (`focus.v`, 0–4, written by the section's ScrollTrigger; read here each frame, no React state).
 *   Shield  a proxy shield standing in front of a server
 *   Web     a browser window with a padlock on its address bar
 *   SDK     a package: a cube in a cube
 *   Edge    a chip with pins on all four sides
 *   Vault   a vault door with a locking wheel and bolts
 * The object in focus lights its accents in --kem. Everything turns like a mechanism, not a motor:
 * the package's core and the vault's wheel turn in detents (a quick move that clicks past its stop and
 * settles, then a hold), and the ring view snaps to the adapter nearest the scroll on a stiff spring,
 * overshooting a hair and settling like a detent. Reduced motion: the camera cuts, nothing turns.
 */
import { PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";
import { Dust } from "./Dust";
import { Studio } from "./Studio";
import { Thicken } from "@/components/scenes/Thicken";
import { Spring, springIn } from "@/lib/motion";

/**
 * A detent turn: `step` radians every `period` s, each move a stiff spring (ζ 0.35, 3 Hz) released at
 * the start of its period, so it clicks past the stop and settles, then holds. Offset by `phase` s.
 */
const detent = (t: number, step: number, period: number, phase = 0) => {
  const u = t + phase;
  const n = Math.floor(u / period);
  return step * (n + springIn(u - n * period, 0.35, 3));
};
/** The ring's detent: stiff, a small overshoot. */
const CLICK = { mass: 1, stiffness: 70, damping: 9.5 };

export const ADAPTER_ORDER = ["shield", "web", "sdk", "edge", "vault"] as const;
const RING = 5.2;
let reduceCache: boolean | undefined;
const reduceMotion = () =>
  (reduceCache ??=
    typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
const STEP = (Math.PI * 2) / ADAPTER_ORDER.length;

/** Ring position of adapter i (facing outwards). */
const at = (i: number) =>
  [Math.sin(i * STEP) * RING, 0, Math.cos(i * STEP) * RING] as [number, number, number];

function useMaterials() {
  return useMemo(() => {
    const c = palette();
    return {
      c,
      metal: new THREE.MeshStandardMaterial({
        color: c.bg.clone().lerp(c.text, 0.55),
        metalness: 0.85,
        roughness: 0.3,
        envMapIntensity: 1.4,
      }),
      dark: new THREE.MeshStandardMaterial({
        color: c.bg.clone().lerp(c.text3, 0.3),
        metalness: 0.7,
        roughness: 0.5,
      }),
      glass: new THREE.MeshStandardMaterial({
        color: c.bg.clone(),
        metalness: 0.2,
        roughness: 0.08,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    };
  }, []);
}

/** The accent material for one object: lit --kem when in focus, a dim neutral otherwise. */
function useAccent(c: ReturnType<typeof palette>) {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: c.text3.clone(),
        emissive: c.kem.clone(),
        emissiveIntensity: 0,
        metalness: 0.4,
        roughness: 0.4,
        toneMapped: false,
      }),
    [c],
  );
}

function Shield({ m, accent }: { m: ReturnType<typeof useMaterials>; accent: THREE.Material }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.95);
    s.quadraticCurveTo(0.55, 0.85, 0.75, 0.7);
    s.lineTo(0.7, 0.05);
    s.quadraticCurveTo(0.55, -0.65, 0, -1);
    s.quadraticCurveTo(-0.55, -0.65, -0.7, 0.05);
    s.lineTo(-0.75, 0.7);
    s.quadraticCurveTo(-0.55, 0.85, 0, 0.95);
    return new THREE.ExtrudeGeometry(s, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
  }, []);
  return (
    <group>
      {/* The server behind it: a rack unit with drive slots. */}
      <RoundedBox args={[1.2, 1.7, 0.8]} radius={0.06} position={[0, 0, -0.75]} material={m.dark} />
      {[-0.45, -0.15, 0.15, 0.45].map((y) => (
        <mesh key={y} position={[0, y, -0.34]} material={accent}>
          <boxGeometry args={[0.8, 0.04, 0.02]} />
        </mesh>
      ))}
      <mesh geometry={shape} material={m.metal} position={[0, 0, 0.05]} />
      <mesh position={[0, 0, 0.3]} material={accent}>
        <torusGeometry args={[0.28, 0.035, 12, 40]} />
      </mesh>
    </group>
  );
}

function Browser({ m, accent }: { m: ReturnType<typeof useMaterials>; accent: THREE.Material }) {
  return (
    <group>
      <RoundedBox args={[2, 1.4, 0.08]} radius={0.05} material={m.metal} />
      <mesh position={[0, -0.12, 0.05]} material={m.glass}>
        <planeGeometry args={[1.84, 1.02]} />
      </mesh>
      {/* Title bar: three dots and the address bar with its padlock. */}
      {[-0.82, -0.72, -0.62].map((x) => (
        <mesh key={x} position={[x, 0.56, 0.05]} material={m.dark}>
          <circleGeometry args={[0.035, 16]} />
        </mesh>
      ))}
      <RoundedBox
        args={[1.1, 0.13, 0.03]}
        radius={0.03}
        position={[0.15, 0.56, 0.05]}
        material={m.dark}
      />
      <group position={[-0.32, 0.56, 0.08]} scale={0.09}>
        <mesh position={[0, -0.2, 0]} material={accent}>
          <boxGeometry args={[0.9, 0.7, 0.3]} />
        </mesh>
        <mesh position={[0, 0.25, 0]} material={accent}>
          <torusGeometry args={[0.3, 0.09, 8, 20, Math.PI]} />
        </mesh>
      </group>
      {/* A sealed form on the page. */}
      {[0.1, -0.12, -0.34].map((y) => (
        <mesh key={y} position={[0, y, 0.06]} material={y === -0.34 ? accent : m.dark}>
          <boxGeometry args={[1.2, 0.12, 0.02]} />
        </mesh>
      ))}
    </group>
  );
}

function Package({ m, accent }: { m: ReturnType<typeof useMaterials>; accent: THREE.Material }) {
  const inner = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (inner.current && !reduceMotion())
      inner.current.rotation.y = detent(clock.elapsedTime, Math.PI / 2, 2.4);
  });
  return (
    <group>
      <mesh material={m.glass}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.4, 1.4, 1.4)]} />
        <lineBasicMaterial color={m.c.text3} transparent opacity={0.6} depthWrite={false} />
      </lineSegments>
      <group ref={inner}>
        <RoundedBox args={[0.7, 0.7, 0.7]} radius={0.06} material={m.metal} />
        <mesh material={accent}>
          <boxGeometry args={[0.74, 0.08, 0.74]} />
        </mesh>
      </group>
    </group>
  );
}

function Chip({ m, accent }: { m: ReturnType<typeof useMaterials>; accent: THREE.Material }) {
  const pins = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let k = 0; k < 6; k++) {
      const t = -0.55 + k * 0.22;
      out.push([t, 0.85, 0, 0], [t, -0.85, 0, 0], [0.85, t, 0, 1], [-0.85, t, 0, 1]);
    }
    return out;
  }, []);
  return (
    <group rotation={[-0.35, 0, 0]}>
      <RoundedBox args={[1.5, 1.5, 0.22]} radius={0.05} material={m.dark} />
      <RoundedBox
        args={[0.8, 0.8, 0.06]}
        radius={0.03}
        position={[0, 0, 0.13]}
        material={m.metal}
      />
      <mesh position={[0, 0, 0.17]} material={accent}>
        <ringGeometry args={[0.18, 0.24, 32]} />
      </mesh>
      {pins.map(([x, y, , v], i) => (
        <mesh key={i} position={[x, y, 0]} material={m.metal}>
          <boxGeometry args={v ? [0.22, 0.07, 0.05] : [0.07, 0.22, 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

function VaultDoor({ m, accent }: { m: ReturnType<typeof useMaterials>; accent: THREE.Material }) {
  const wheel = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (wheel.current && !reduceMotion())
      wheel.current.rotation.z = detent(clock.elapsedTime, Math.PI / 3, 2.0, 0.9);
  });
  return (
    <group>
      <RoundedBox args={[2, 2, 0.3]} radius={0.08} position={[0, 0, -0.18]} material={m.dark} />
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
        <cylinderGeometry args={[0.82, 0.82, 0.22, 48]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0.13]} material={accent}>
            <cylinderGeometry args={[0.045, 0.045, 0.06, 12]} />
          </mesh>
        );
      })}
      <group ref={wheel} position={[0, 0, 0.2]}>
        <mesh material={m.metal}>
          <torusGeometry args={[0.34, 0.035, 12, 40]} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} rotation={[0, 0, (k * Math.PI) / 3]} material={m.metal}>
            <boxGeometry args={[0.7, 0.05, 0.05]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const MODELS: Record<
  (typeof ADAPTER_ORDER)[number],
  (p: { m: ReturnType<typeof useMaterials>; accent: THREE.Material }) => ReactNode
> = {
  shield: Shield,
  web: Browser,
  sdk: Package,
  edge: Chip,
  vault: VaultDoor,
};

function Slot({
  i,
  id,
  m,
  focus,
}: {
  i: number;
  id: (typeof ADAPTER_ORDER)[number];
  m: ReturnType<typeof useMaterials>;
  focus: { v: number };
}) {
  const accent = useAccent(m.c);
  const g = useRef<THREE.Group>(null);
  const Model = MODELS[id];
  useFrame((_, dt) => {
    // In focus: accents glow --kem; the object turns a little towards the camera and lifts.
    const near = Math.max(0, 1 - Math.abs(focus.v - i));
    const mat = accent as THREE.MeshStandardMaterial;
    mat.emissiveIntensity += (near * 2.2 - mat.emissiveIntensity) * Math.min(1, dt * 5);
    mat.color.copy(m.c.text3).lerp(m.c.kem, near);
    if (g.current)
      g.current.position.y += (near * 0.25 - g.current.position.y) * Math.min(1, dt * 4);
  });
  return (
    <group position={at(i)} rotation={[0, i * STEP, 0]} scale={0.85}>
      <group ref={g}>
        <Model m={m} accent={accent} />
      </group>
    </group>
  );
}

export default function AdapterOrbit({ focus, active }: { focus: { v: number }; active: boolean }) {
  const m = useMaterials();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const size = useThree((st) => st.size);
  const angle = useRef(new Spring(0, CLICK));
  useFrame((_, dt) => {
    const c = cam.current;
    if (!c || !active) return;
    // Orbit the ring so the adapter in focus faces the camera, from slightly above: the view clicks
    // to the nearest adapter (a detent), never parks between two.
    const target = Math.round(focus.v) * STEP;
    const sp = angle.current;
    if (reduceMotion()) sp.set(target);
    else {
      sp.target = target;
      sp.step(dt);
    }
    const a = sp.x;
    // From outside the ring, slightly above; the aim point sits left of the object, so it lands
    // right of centre (the headline is top-left, the cards along the bottom).
    // Phones are narrow: further back, aimed dead centre (no room for the off-centre framing).
    const narrow = size.width < 768;
    const out = RING + (narrow ? 9.5 : 6.4);
    c.position.set(Math.sin(a) * out, 1.4, Math.cos(a) * out);
    const side = narrow ? 0 : 1.7;
    c.lookAt(
      Math.sin(a) * RING - Math.cos(a) * side,
      0.15,
      Math.cos(a) * RING + Math.sin(a) * side,
    );
  });
  return (
    <Thicken>
      <PerspectiveCamera
        ref={cam}
        makeDefault
        fov={38}
        near={0.1}
        far={40}
        position={[0, 1.3, 7]}
      />
      <Studio rim={m.c.kem} fog={m.c.bg} floorY={-1.15} />
      <Dust color={m.c.text3} spread={18} />
      {ADAPTER_ORDER.map((id, i) => (
        <Slot key={id} i={i} id={id} m={m} focus={focus} />
      ))}
    </Thicken>
  );
}
