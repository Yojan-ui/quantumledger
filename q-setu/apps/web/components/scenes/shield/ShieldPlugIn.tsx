"use client";

/**
 * "Shield plugs in", in the site's own 3D vocabulary: everything is dots, thin lines and glass, in the
 * role colours (--danger / --warn exposed, --kem encrypted, --sig signed, --ok verified), with the
 * films' anchored labels. Left to right: three visitors' devices, the line into the bank, a recorder
 * tapping that line, and the bank: its real homepage (the bundled legacy bank, sampled into dots) on a
 * server tower. Shield is a lattice cube, the logo's motif.
 *
 * Everything shown is `v` (./model: the events of a real run at story time t) and `bt`, the seconds
 * into the current beat, so a beat's motion is a pure function of time since its real event:
 *  scan      the line pulses --danger, a sweep passes over the page, the real findings and score appear
 *  install   DNS: the line unplugs and re-routes through a junction, and Shield flies in and seats
 *            (wind-up, overshoot, settle). Container: Shield slides in beside the server like a rack
 *            module (a hard stop) and the line threads through it. One line of code: the line types
 *            onto the server, and Shield assembles out of the server's own dots.
 *  handshake the next packet hits Shield; its dots re-form from a sphere into a lattice (the real group
 *            and time on its label), and the colour runs out along the line from Shield, --danger →
 *            --kem, as a moving front. With one line of code it honestly doesn't (TLS unchanged).
 *  harvest   new copies reaching the recorder break into noise; its counter freezes; the old
 *            recordings stay red.
 *  fix       each real header fix lands on the page as a badge, springing in as a cascade, and the
 *            matching finding turns --ok.
 *  verify    a probe is thrown in from outside, lands with a ripple, the real score counts up and a
 *            --sig ring closes around Shield (the signed report).
 *  attack    a burst of --danger packets hits Shield and bounces off with a ripple; real counters.
 * Reduced motion: every beat is its end state (`bt` large), no springs, no camera flights.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import type { DirectorState } from "@/components/director/types";
import { latticeCube, set3 } from "@/components/scenes/geometry";
import { gfx } from "@/lib/client/gfx";
import { Thicken } from "@/components/scenes/Thicken";
import { palette } from "@/components/world/palette";
import { CHECKS } from "@/lib/shield-score";
import { launch, springIn, throwArc, Trail, travel, wobble } from "@/lib/motion";
import { boxDots, DotCloud, imageDots, merge, outlineDots, rng, type Cloud } from "./dots";
import { BEATS, type InstallMode, type View } from "./model";

// ── Layout (scene units) ─────────────────────────────────────────────────────────────────────
const LINE_Y = -0.6;
const HUB = new THREE.Vector3(-4.4, LINE_Y, 0);
const TAP_X = -2.0;
const SERVER = new THREE.Vector3(3.7, -1.3, 0);
const SERVER_SIZE: [number, number, number] = [1.2, 1.6, 1.1];
const WEB = new THREE.Vector3(3.7, 0.55, 0);
const WEB_W = 3.0;
const WEB_H = 1.76;
const HARVESTER = new THREE.Vector3(TAP_X, -2.2, 0);
const DEVICES: [number, number, number][] = [
  [-5.6, 0.3, 0],
  [-5.6, -0.6, 0],
  [-5.6, -1.5, 0],
];
/** Where Shield sits for each install route. */
const SHIELD_AT: Record<InstallMode, THREE.Vector3> = {
  dns: new THREE.Vector3(0.4, LINE_Y, 0),
  container: new THREE.Vector3(2.35, LINE_Y, 0),
  code: new THREE.Vector3(3.7, -0.95, 0.62),
};
const SHIELD_SIZE = 0.62;
const LINE_DOTS = 420;
const PACKET_DOTS = 36;
const MAX_PACKETS = 8;

/** The camera for each beat (and per install route where it matters). */
export function shotCamera(beat: number, mode: InstallMode) {
  const s = SHIELD_AT[mode];
  const cams: { position: [number, number, number]; target: [number, number, number] }[] = [
    // Wide: the whole bench, sitting low (clear of the console drawer top right and the controls).
    { position: [-0.25, 0.9, 12.4], target: [-0.25, -0.35, 0] },
    { position: [s.x + 0.3, s.y + 1.1, 4.4], target: [s.x, s.y + 0.1, 0] },
    { position: [s.x + 0.5, s.y + 0.5, 2.9], target: [s.x, s.y, 0] },
    { position: [TAP_X + 0.3, -0.8, 4.8], target: [TAP_X, -1.6, 0] },
    { position: [WEB.x - 0.2, WEB.y + 0.3, 5.0], target: [WEB.x, WEB.y - 0.1, 0] },
    { position: [-0.25, 1.0, 12.9], target: [-0.25, -0.3, 0] },
    { position: [s.x - 1.7, s.y + 0.7, 4.6], target: [s.x - 0.7, s.y, 0] },
  ];
  return cams[beat]!;
}

/** The line from the hub to the server, through Shield's spot for this route. */
function linePath(mode: InstallMode, lift: number, thread: number) {
  const pts = [
    HUB.clone(),
    new THREE.Vector3(TAP_X, LINE_Y, 0),
    new THREE.Vector3(-0.8, LINE_Y, 0),
    // DNS: the junction (it lifts as the line is unplugged and re-plugged).
    new THREE.Vector3(0.4, LINE_Y + lift, 0),
    new THREE.Vector3(1.4, LINE_Y, 0),
    // Container: the line threads down through the module beside the server.
    new THREE.Vector3(2.35, LINE_Y - 0.0 * thread, 0.0 + 0.0 * thread),
    new THREE.Vector3(SERVER.x - SERVER_SIZE[0] / 2, LINE_Y, 0),
  ];
  void mode;
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

const lineVertex = /* glsl */ `
  attribute float aS;
  uniform float uPR; uniform float uFront; uniform float uShieldS; uniform float uPulse;
  uniform vec3 uA; uniform vec3 uB;
  varying vec3 vC; varying float vA;
  void main() {
    // The --kem front runs out from Shield towards the visitors (smaller s).
    float k = uFront > 0.0 && aS <= uShieldS ? smoothstep(uFront, uFront - 0.04, uShieldS - aS) : 0.0;
    vC = mix(uA, uB, k);
    float pulse = uPulse >= 0.0 ? exp(-pow((aS - uPulse) / 0.03, 2.0)) : 0.0;
    vA = 0.45 + 0.55 * pulse;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(22.0 / -mv.z, 1.0, 4.0) * uPR * (1.0 + pulse);
  }
`;
const lineFragment = /* glsl */ `
  varying vec3 vC; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vC, (1.0 - smoothstep(0.2, 0.5, d)) * vA);
  }
`;

/** Sphere (Fibonacci) and lattice (3×3×4) shapes for a packet's dots. */
function packetShapes() {
  const sphere = new Float32Array(PACKET_DOTS * 3);
  const lattice = new Float32Array(PACKET_DOTS * 3);
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < PACKET_DOTS; i++) {
    const y = 1 - (i / (PACKET_DOTS - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    sphere.set([Math.cos(g * i) * r * 0.13, y * 0.13, Math.sin(g * i) * r * 0.13], i * 3);
    const a = i % 3;
    const b = Math.floor(i / 3) % 3;
    const c = Math.floor(i / 9);
    lattice.set([(a - 1) * 0.085, (b - 1) * 0.085, (c - 1.5) * 0.085], i * 3);
  }
  return { sphere, lattice };
}

interface Packet {
  /** Beat it belongs to, and when it leaves the hub (seconds into that beat). */
  beat: number;
  at: number;
  /** The upgrade packet (re-forms at Shield), already quantum-safe, or classical. */
  kind: "upgrade" | "safe" | "classical";
}

export interface ShieldSceneProps {
  state: DirectorState;
  onSettled: () => void;
  v: View;
  /** Seconds into the current beat (story time); ignored under reduced motion. */
  bt: number;
  active: boolean;
  reduce: boolean;
  /** performance.now() when the dots began to re-form here (0: already formed), and to scatter. */
  formAt?: number;
  leaveAt?: number;
  /** Anchored labels (off where the page's own copy sits over the slot). */
  labels?: boolean;
  /** Lens shift (fractions of the view), to leave room for copy laid over the slot. */
  shift?: [number, number];
  /** Extra dolly-out (0 = none), on top of the narrow-stage pull. */
  wider?: number;
}

export default function ShieldPlugIn({
  state,
  onSettled,
  v,
  bt: btIn,
  active,
  reduce,
  formAt = 0,
  leaveAt = 0,
  labels = true,
  shift = [0, 0],
  wider = 0,
}: ShieldSceneProps) {
  const c = useMemo(palette, []);
  // Framed for a 2:1 stage; a narrower one (a phone) dollies every shot out to keep the bench in.
  const size = useThree((st) => st.size);
  const aspect = size.width / Math.max(1, size.height);
  const pull = () => Math.max(0, 2 / aspect - 1) / 3.5 + wider;
  const mode = v.mode;
  const beat = v.beat;
  const bt = reduce ? 99 : btIn;
  /** Seconds into beat `b` as seen now: −1 before it, large once past it. */
  const at = (b: number) => (beat > b ? 99 : beat < b ? -1 : bt);
  // Focus pull (the site's stand-in for depth of field): while the camera moves, whatever isn't this
  // beat's subject softens, and comes back as the shot settles. Not on phones, or at the ladder's
  // last step.
  const SUBJECT: Record<string, string[]> = {
    scan: ["web", "line", "server", "devices"],
    install: ["shield", "line", "server"],
    handshake: ["shield", "line"],
    harvest: ["harvester", "line"],
    fix: ["web", "server"],
    verify: ["web", "server", "shield", "line", "devices", "harvester"],
    attack: ["shield", "line"],
  };
  const focusK = useRef(1);
  const dim = (part: string) => (SUBJECT[BEATS[v.beat]!]?.includes(part) ? 1 : focusK.current);
  const clock = () => ({
    form: reduce || !formAt ? 99 : (performance.now() - formAt) / 1000,
    leave: leaveAt && !reduce ? (performance.now() - leaveAt) / 1000 : -1,
  });

  // ── The bank's page, sampled into dots (loads once; a plain field until it does). ──
  const [page, setPage] = useState<Cloud | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setPage(imageDots(img, WEB_W, WEB_H));
    img.src = "/scenes/legacy-bank.jpg";
  }, []);
  const server = useMemo(() => boxDots(...SERVER_SIZE, 70, 5), []);
  const harvester = useMemo(() => boxDots(1.0, 0.7, 0.7, 55, 9), []);
  const devices = useMemo(
    () =>
      merge([
        [
          merge([
            [outlineDots(0.32, 0.56, 40), [0, 0, 0]],
            [outlineDots(0.24, 0.42, 30), [0, 0.02, 0.01]],
          ]),
          DEVICES[0]!,
        ],
        [
          merge([
            [outlineDots(0.62, 0.4, 50), [0, 0.06, 0]],
            [outlineDots(0.74, 0.04, 30), [0, -0.18, 0.05]],
          ]),
          DEVICES[1]!,
        ],
        [
          merge([
            [outlineDots(0.46, 0.62, 46), [0, 0, 0]],
            [outlineDots(0.36, 0.48, 34), [0, 0, 0.01]],
          ]),
          DEVICES[2]!,
        ],
      ]),
    [],
  );

  // ── The line: dots along the path, coloured by the --kem front. ──
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LINE_DOTS * 3), 3));
    const s = new Float32Array(LINE_DOTS).map((_, i) => i / (LINE_DOTS - 1));
    g.setAttribute("aS", new THREE.BufferAttribute(s, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      uniforms: {
        uPR: { value: 1 },
        uFront: { value: 0 },
        uShieldS: { value: 0.5 },
        uPulse: { value: -1 },
        uA: { value: new THREE.Color() },
        uB: { value: new THREE.Color() },
      },
      transparent: true,
      depthWrite: false,
    });
    return { g, m };
  }, []);
  // The feeders from each device to the hub, and the recorder's tap: thin lines.
  const feeders = useMemo(() => {
    const pts: number[] = [];
    for (const d of DEVICES) pts.push(d[0] + 0.4, d[1], 0, HUB.x, HUB.y, 0);
    pts.push(TAP_X, LINE_Y, 0, TAP_X, HARVESTER.y + 0.35, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const feederMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false }),
    [],
  );
  const tapMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );

  // ── Packets: a sphere of dots (classical) that can re-form into a lattice (hybrid). ──
  const shapes = useMemo(packetShapes, []);
  const packets = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = MAX_PACKETS * PACKET_DOTS;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { g, m, n };
  }, []);
  const trails = useMemo(() => {
    const segs = MAX_PACKETS * 16;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3));
    const m = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { g, m, list: Array.from({ length: MAX_PACKETS }, () => new Trail(10)) };
  }, []);
  // Copies on their way down the tap, and the recorder's contents.
  const copies = useMemo(() => {
    const n = 6 * 14 + 140;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { g, m, n };
  }, []);

  // ── Shield: the lattice cube (edges and node dots) in a faint glass body. ──
  const latticeGeo = useMemo(() => latticeCube(SHIELD_SIZE, 3), []);
  const latticeMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const nodes = useMemo(() => {
    const out: THREE.Vector3[] = [];
    const h = SHIELD_SIZE / 2;
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let d = 0; d < 3; d++) out.push(new THREE.Vector3(-h + a * h, -h + b * h, -h + d * h));
    return out;
  }, []);
  const nodeDots = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(27 * 3), 3));
    const m = new THREE.PointsMaterial({
      size: 0.06,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { g, m };
  }, []);
  /** For the one-line-of-code route: the server dots each node peels off from. */
  const peelFrom = useMemo(() => {
    const r = rng(77);
    return nodes.map(
      () =>
        new THREE.Vector3(
          SERVER.x + (r() - 0.5) * SERVER_SIZE[0],
          SERVER.y + (r() - 0.5) * SERVER_SIZE[1],
          SERVER.z + SERVER_SIZE[2] / 2,
        ),
    );
  }, [nodes]);
  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        transparent: true,
        opacity: 0.12,
        roughness: 0.1,
        depthWrite: false,
      }),
    [],
  );
  const shieldG = useRef<THREE.Group>(null);
  const sigRing = useRef<THREE.Mesh>(null);
  const sigGeo = useMemo(() => new THREE.TorusGeometry(0.62, 0.012, 6, 96), []);
  const ripple = useRef<THREE.Mesh>(null);
  const webRipple = useRef<THREE.Mesh>(null);
  const sweep = useRef<THREE.Mesh>(null);
  const probe = useRef<THREE.Mesh>(null);
  const probeTrail = useMemo(() => new Trail(14), []);
  const probeLine = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(14 * 2 * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(14 * 2 * 3), 3));
    return new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
  }, []);
  const badges = useRef<(THREE.Mesh | null)[]>([]);
  const badgeMats = useMemo(
    () =>
      CHECKS.map(
        () =>
          new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [],
  );
  const attackDots = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    const m = new THREE.PointsMaterial({
      size: 0.09,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { g, m };
  }, []);
  const attackSeeds = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 16 }, (_, i) => ({
      from: new THREE.Vector3(-6.5 + r() * 1.5, -1.6 + r() * 3.2, -1 + r() * 2),
      at: i * 0.12 + r() * 0.08,
      speed: 1.1 + r() * 0.4,
    }));
  }, []);

  // Packet schedule: visitors 1–3 cross during the scan; 4 is the upgrade (or the first post-install
  // packet); 5–6 cross while the recorder is on screen.
  const schedule: Packet[] = useMemo(() => {
    const pq = mode !== "code";
    return [
      { beat: 0, at: 0.4, kind: "classical" },
      { beat: 0, at: 1.15, kind: "classical" },
      { beat: 0, at: 1.9, kind: "classical" },
      { beat: 2, at: 0.15, kind: pq ? "upgrade" : "classical" },
      { beat: 3, at: 0.2, kind: pq ? "safe" : "classical" },
      { beat: 3, at: 1.0, kind: pq ? "safe" : "classical" },
    ];
  }, [mode]);
  const visible = (n: number) => v.visits.some((x) => x.n === n);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const shieldPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ gl, clock: frameClock }, dt) => {
    if (!active) return;
    const pullFocus =
      !reduce && !state.settled && gfx.quality < 3 && window.innerWidth >= 768 ? 0.45 : 1;
    focusK.current += (pullFocus - focusK.current) * Math.min(1, dt * 4);
    const pr = gl.getPixelRatio();
    const now = frameClock.elapsedTime;
    const installAt = at(1);
    const installed = v.installed;
    const pq = mode !== "code";

    // ── The line: re-plug (DNS) or thread (container) during the install. ──
    const lift =
      mode === "dns" && installAt >= 0 && installAt < 99
        ? 0.45 * Math.max(0, Math.sin(Math.PI * Math.min(1, installAt / 1.1))) -
          0.08 * Math.max(0, wobble(installAt - 1.1, 2.5, 5))
        : 0;
    const path = linePath(mode, lift, 0);
    const lp = line.g.attributes.position!.array as Float32Array;
    for (let i = 0; i < LINE_DOTS; i++) {
      path.getPoint(i / (LINE_DOTS - 1), tmp);
      set3(lp, i, tmp.x, tmp.y, tmp.z);
    }
    line.g.attributes.position!.needsUpdate = true;
    const lu = line.m.uniforms;
    lu.uPR!.value = pr;
    (lu.uA!.value as THREE.Color).copy(c.danger);
    (lu.uB!.value as THREE.Color).copy(c.kem);
    // Shield's position along the line (s), from its x.
    const sx = SHIELD_AT[mode].x;
    const shieldS = Math.max(
      0,
      Math.min(1, (sx - HUB.x) / (SERVER.x - SERVER_SIZE[0] / 2 - HUB.x)),
    );
    lu.uShieldS!.value = shieldS;
    // The front: from Shield outward at ~0.5 of the line per second, after the upgrade packet lands.
    const hsAt = at(2);
    lu.uFront!.value = pq && hsAt >= 0 ? Math.max(0, (hsAt - 1.0) * 0.45) : 0;
    // The scan's pulse runs from the hub to the bank once.
    const scanAt = at(0);
    lu.uPulse!.value = scanAt >= 0 && scanAt < 1.4 ? scanAt / 1.2 : -1;
    feederMat.color.copy(c.text3);
    tapMat.color.copy(c.danger);

    // ── Shield: where it is and how it got there. ──
    const home = SHIELD_AT[mode];
    const sg = shieldG.current;
    let assemble = 1;
    if (sg) {
      sg.visible = beat >= 1 && (installAt > 0 || beat > 1);
      shieldPos.copy(home);
      let scale = 1;
      if (mode === "dns") {
        // Flies in from above once the line is lifted, winds up, overshoots and seats.
        const k = launch(installAt - 0.7, { amount: 0.1, zeta: 0.42, hz: 1.4 });
        tmp.set(home.x - 1.2, home.y + 2.6, 1.2);
        shieldPos.copy(tmp).lerp(home, k);
      } else if (mode === "container") {
        // Slides in from behind the server like a module into a rack: fast, a hard stop, a bounce.
        const k = springIn(installAt - 0.3, 0.3, 3.0);
        shieldPos.set(home.x, home.y, home.z - 2.4 * (1 - k));
      } else {
        // Assembles from the server's dots after the line has typed in (1.2 s).
        assemble = installAt >= 99 ? 1 : Math.max(0, installAt - 1.2);
        scale = 1;
      }
      // The upgrade packet hits Shield: a kick that rings down.
      const hit = pq && hsAt >= 0 ? wobble(hsAt - 0.85, 3.2, 5) : 0;
      // Attack hits: small jolts.
      const atk = at(6);
      const jolt =
        atk >= 0 && atk < 99 ? 0.03 * Math.sin(atk * 40) * Math.exp(-((atk % 0.6) * 4)) : 0;
      sg.position.set(shieldPos.x + jolt, shieldPos.y + 0.03 * hit, shieldPos.z);
      sg.scale.setScalar(scale * (1 + 0.06 * hit));
      sg.rotation.y = reduce ? 0.4 : 0.4 + Math.sin(now * 0.4) * 0.08;
      // Glow: --kem once installed, brighter as the handshake re-forms there.
      const on = installed ? 1 : Math.max(0, Math.min(1, installAt - 0.9));
      col.copy(c.text3).lerp(c.kem, on);
      latticeMat.color.copy(col);
      latticeMat.opacity = mode === "code" ? Math.min(1, Math.max(0, assemble - 0.6)) : 0.9;
      nodeDots.m.color.copy(col).lerp(c.text, 0.2 * Math.abs(hit));
      glassMat.color.copy(c.kem);
      glassMat.opacity = 0.08 + 0.1 * on;
      // Node dots: in place, or (code) flying from the server's surface in a cascade.
      const np = nodeDots.g.attributes.position!.array as Float32Array;
      nodes.forEach((n, i) => {
        if (mode === "code" && assemble < 99) {
          const delay = (n.length() / SHIELD_SIZE) * 0.25;
          const k = springIn(assemble - delay, 0.5, 1.8);
          tmp.copy(peelFrom[i]!).sub(sg.position).lerp(n, k);
          set3(np, i, tmp.x, tmp.y, tmp.z);
        } else set3(np, i, n.x, n.y, n.z);
      });
      nodeDots.g.attributes.position!.needsUpdate = true;
    }
    // The signed report: a --sig ring closes around Shield during the verify beat.
    const vAt = at(5);
    if (sigRing.current) {
      const k = vAt < 0 ? 0 : Math.min(1, Math.max(0, (vAt - 1.4) / 0.8));
      sigRing.current.visible = k > 0 && !!v.report;
      sigRing.current.position.copy(shieldPos);
      sigGeo.setDrawRange(0, Math.ceil((sigGeo.index?.count ?? 0) * k));
      (sigRing.current.material as THREE.MeshBasicMaterial).color.copy(c.sig);
    }

    // ── Packets. ──
    const pp = packets.g.attributes.position!.array as Float32Array;
    const pc = packets.g.attributes.color!.array as Float32Array;
    const tp = trails.g.attributes.position!.array as Float32Array;
    const tc = trails.g.attributes.color!.array as Float32Array;
    pp.fill(1e4);
    tp.fill(0);
    tc.fill(0);
    let tv = 0;
    const cp = copies.g.attributes.position!.array as Float32Array;
    const cc = copies.g.attributes.color!.array as Float32Array;
    cp.fill(1e4);
    let ck = 0;
    const TRAVEL = 1.7;
    schedule.forEach((p, k) => {
      const n = k + 1;
      if (!visible(n)) return;
      const t = at(p.beat) - p.at;
      if (t < 0 || t > TRAVEL + 0.2 || reduce) return;
      const u = travel(Math.min(1, t / TRAVEL));
      path.getPoint(u, tmp);
      // Sphere → lattice: the upgrade packet re-forms as it passes Shield; safe packets already are.
      const atShield = Math.max(0, (u - shieldS) * TRAVEL * 1.6);
      const form = p.kind === "safe" ? 1 : p.kind === "upgrade" ? springIn(atShield, 0.5, 1.8) : 0;
      const kem = p.kind === "classical" ? 0 : p.kind === "safe" ? 1 : Math.min(1, atShield * 3);
      col.copy(c.danger).lerp(c.kem, kem);
      for (let i = 0; i < PACKET_DOTS; i++) {
        const j = k * PACKET_DOTS + i;
        tmp2.set(shapes.sphere[i * 3]!, shapes.sphere[i * 3 + 1]!, shapes.sphere[i * 3 + 2]!);
        tmp2.lerp(
          {
            x: shapes.lattice[i * 3]!,
            y: shapes.lattice[i * 3 + 1]!,
            z: shapes.lattice[i * 3 + 2]!,
          } as THREE.Vector3,
          form,
        );
        set3(pp, j, tmp.x + tmp2.x, tmp.y + tmp2.y, tmp.z + tmp2.z);
        set3(pc, j, col.r, col.g, col.b);
      }
      const tr = trails.list[k]!;
      if (t < 0.03) tr.reset(tmp);
      tr.push(tmp);
      const wrote = tr.write(tp.subarray(tv * 3), tc.subarray(tv * 3), col, 0.8);
      tv += wrote;
      // The recorder's tap: when the packet passes it, a copy drops down the tap.
      const tapU = (TAP_X - HUB.x) / (SERVER.x - SERVER_SIZE[0] / 2 - HUB.x);
      const ct = (u - tapU) * TRAVEL;
      if (ct > 0 && ct < 0.9) {
        const fall = Math.min(1, ct / 0.55);
        const y = LINE_Y + (HARVESTER.y + 0.2 - LINE_Y) * fall * fall;
        const noise = kem > 0.5 && fall >= 1 ? (ct - 0.55) / 0.35 : 0;
        for (let i = 0; i < 14 && ck < copies.n; i++, ck++) {
          const a = i * 2.4;
          const spread = 0.05 + noise * 0.6;
          set3(
            cp,
            ck,
            TAP_X + Math.cos(a) * spread,
            y + Math.sin(a * 1.7) * spread,
            Math.sin(a) * spread,
          );
          col.copy(kem > 0.5 ? c.kem : c.danger).multiplyScalar(1 - noise);
          set3(cc, ck, col.r, col.g, col.b);
        }
      }
    });
    packets.g.attributes.position!.needsUpdate = true;
    packets.g.attributes.color!.needsUpdate = true;
    trails.g.setDrawRange(0, tv);
    trails.g.attributes.position!.needsUpdate = true;
    trails.g.attributes.color!.needsUpdate = true;
    // The recorder's contents: one red cluster per exposed handshake (they stay red).
    const rec = Math.min(8, v.exposed);
    for (let r = 0; r < rec; r++)
      for (let i = 0; i < 14 && ck < copies.n; i++, ck++) {
        const a = i * 2.4 + r;
        set3(
          cp,
          ck,
          HARVESTER.x - 0.32 + (r % 4) * 0.21 + Math.cos(a) * 0.04,
          HARVESTER.y - 0.12 + Math.floor(r / 4) * 0.2 + Math.sin(a * 1.7) * 0.04,
          Math.sin(a) * 0.04,
        );
        set3(cc, ck, c.danger.r, c.danger.g, c.danger.b);
      }
    copies.g.attributes.position!.needsUpdate = true;
    copies.g.attributes.color!.needsUpdate = true;

    // ── The scan sweep over the page, and the probe and its landing ripple (verify). ──
    if (sweep.current) {
      const k = scanAt >= 0 && scanAt < 99 ? (scanAt - 1.0) / 1.1 : -1;
      sweep.current.visible = k > 0 && k < 1;
      sweep.current.position.set(WEB.x - WEB_W / 2 + WEB_W * k, WEB.y, 0.03);
      (sweep.current.material as THREE.MeshBasicMaterial).color.copy(c.danger);
    }
    if (probe.current) {
      const k = vAt >= 0 && vAt < 99 ? vAt / 1.0 : -1;
      const flying = k > 0 && k < 1;
      probe.current.visible = flying;
      const u = throwArc(Math.min(1, Math.max(0, k)));
      tmp.set(-2.5, 4.6, 2.5).lerp(WEB, u);
      tmp.y += Math.sin(Math.PI * u) * 1.2;
      probe.current.position.copy(tmp);
      (probe.current.material as THREE.MeshBasicMaterial).color.copy(c.kem);
      if (k <= 0.02) probeTrail.reset(tmp);
      if (flying) probeTrail.push(tmp);
      const pa = probeLine.geometry.attributes.position!.array as Float32Array;
      const pcol = probeLine.geometry.attributes.color!.array as Float32Array;
      const wrote = flying ? probeTrail.write(pa, pcol, c.kem, 0.9) : 0;
      probeLine.geometry.setDrawRange(0, wrote);
      probeLine.geometry.attributes.position!.needsUpdate = true;
      probeLine.geometry.attributes.color!.needsUpdate = true;
    }
    const rippleAt = (m: THREE.Mesh | null, t: number, color: THREE.Color, size: number) => {
      if (!m) return;
      const k = t / 0.8;
      m.visible = k > 0 && k < 1 && !reduce;
      m.scale.setScalar(0.05 + (1 - (1 - Math.min(1, k)) ** 3) * size);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.copy(color);
      mat.opacity = (1 - k) * 0.9;
    };
    rippleAt(webRipple.current, vAt >= 0 && vAt < 99 ? vAt - 1.0 : -1, c.kem, 1.4);
    // The attack: packets thrown at Shield, bouncing off; a ripple at each hit.
    const atk = at(6);
    const ap = attackDots.g.attributes.position!.array as Float32Array;
    ap.fill(1e4);
    let lastHit = -1;
    if (v.attack && atk >= 0 && atk < 99)
      attackSeeds.forEach((s, i) => {
        const t = atk - s.at;
        if (t < 0) return;
        const reach = 0.7 / s.speed;
        if (t < reach) {
          tmp.copy(s.from).lerp(shieldPos, throwArc(t / reach, 0.3));
        } else {
          // Bounce: back the way it came, slowing, fading.
          const b = t - reach;
          if (b > 1.2) return;
          lastHit = Math.max(lastHit, s.at + reach);
          tmp.copy(shieldPos).lerp(s.from, (1 - Math.exp(-b * 2.5)) * 0.45);
        }
        set3(ap, i, tmp.x, tmp.y, tmp.z);
      });
    attackDots.g.attributes.position!.needsUpdate = true;
    attackDots.m.color.copy(c.danger);
    if (ripple.current) ripple.current.position.copy(shieldPos);
    rippleAt(ripple.current, lastHit >= 0 ? atk - lastHit : -1, c.danger, 0.9);

    // ── Fix: badges spring onto the page's right edge, one by one as the fixes arrive. ──
    const fixAt = at(4);
    const fixes = CHECKS.filter((ch) => v.fixes[ch.id]);
    CHECKS.forEach((ch, i) => {
      const b = badges.current[i];
      if (!b) return;
      const f = v.fixes[ch.id];
      const order = fixes.indexOf(ch);
      b.visible = !!f;
      if (!f) return;
      const appear = fixAt >= 99 ? 99 : fixAt - (order / Math.max(1, CHECKS.length)) * 4.2;
      const k = springIn(appear, 0.4, 2.2);
      b.position.set(
        WEB.x + WEB_W / 2 + 0.18,
        WEB.y + WEB_H / 2 - 0.12 - i * 0.24 + 0.4 * (1 - k),
        0.02,
      );
      b.scale.setScalar(Math.max(0.001, k));
      badgeMats[i]!.color.copy(f.ok ? c.ok : f.partial ? c.warn : c.danger);
      badgeMats[i]!.opacity = 0.85;
    });
  });

  // ── Labels (the films' anchored labels), each shown when its beat has happened. ──
  const show = labels && (state.settled || reduce);
  // Phones: one label per beat, the one that matters (the caption and console carry the rest).
  const phone = size.width < 768;
  const before = v.before;
  const checks = before?.checks;
  const fixed = (id: string) => v.fixes[id as keyof typeof v.fixes];
  const findings: { id: string; label: string; value: string; at: [number, number, number] }[] =
    before
      ? [
          {
            id: "kex",
            label: "Key exchange",
            value: v.upgraded
              ? `${v.handshake?.group ?? ""} · hybrid`
              : `${before.group} (classical)`,
            at: [WEB.x - WEB_W / 2 - 0.05, WEB.y + 0.6, 0],
          },
          {
            id: "cert",
            label: "Certificate",
            value: `${before.certKey} · stays until CAs issue PQ`,
            at: [WEB.x - WEB_W / 2 - 0.05, WEB.y + 0.15, 0],
          },
          ...(checks && !checks.hsts.ok
            ? [
                {
                  id: "hsts",
                  label: "HSTS",
                  value: fixed("hsts")?.ok ? "added" : "missing",
                  at: [WEB.x - WEB_W / 2 - 0.05, WEB.y - 0.3, 0] as [number, number, number],
                },
              ]
            : []),
          ...(checks && !checks.stack.ok
            ? [
                {
                  id: "stack",
                  label: "Server header",
                  value: fixed("stack")?.ok
                    ? "stripped"
                    : `exposed (${checks.stack.seen ?? "server"})`,
                  at: [WEB.x - WEB_W / 2 - 0.05, WEB.y - 0.75, 0] as [number, number, number],
                },
              ]
            : []),
        ]
      : [];
  const findingRole = (id: string) =>
    id === "kex"
      ? v.upgraded
        ? "kem"
        : "danger"
      : id === "cert"
        ? "warn"
        : fixed(id)?.ok
          ? "ok"
          : "danger";
  const scanned = beat > 0 || at0(beat, btIn, reduce) > 2.0;
  const typed =
    mode === "code" && v.installArtifact
      ? v.installArtifact.slice(0, Math.floor((reduce || beat > 1 ? 99 : btIn) * 40))
      : "";
  const id = BEATS[beat];

  return (
    <Thicken>
      <DirectorCamera
        state={state}
        onSettled={onSettled}
        drift={0.015}
        pull={pull}
        shiftX={shift[0]}
        shiftY={shift[1]}
      />
      <fog attach="fog" args={[c.bg, 9, 24]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 6]} intensity={0.8} />

      {/* The bank: its homepage in dots on a glass window, on a server tower of dots. */}
      {page && (
        <DotCloud
          cloud={page}
          color={c.text}
          position={[WEB.x, WEB.y, WEB.z]}
          origin={[0, -1.6, 0]}
          clock={clock}
          size={34}
          opacity={() => dim("web")}
        />
      )}
      <mesh position={WEB} renderOrder={-1}>
        <planeGeometry args={[WEB_W + 0.12, WEB_H + 0.12]} />
        <meshBasicMaterial color={c.bg} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <lineSegments position={WEB}>
        <edgesGeometry args={[new THREE.PlaneGeometry(WEB_W + 0.12, WEB_H + 0.12)]} />
        <lineBasicMaterial color={c.text3} transparent opacity={0.6} depthWrite={false} />
      </lineSegments>
      <DotCloud
        cloud={server}
        color={c.text3}
        position={[SERVER.x, SERVER.y, SERVER.z]}
        clock={clock}
        opacity={() => 0.9 * dim("server")}
      />
      <DotCloud
        cloud={devices}
        color={c.text}
        opacity={() => 0.7 * dim("devices")}
        clock={clock}
        origin={[-5.6, -0.35, 0]}
      />
      <DotCloud
        cloud={harvester}
        color={c.danger}
        position={[HARVESTER.x, HARVESTER.y, HARVESTER.z]}
        clock={clock}
        opacity={() => 0.55 * dim("harvester")}
      />
      <mesh position={[TAP_X, LINE_Y, 0]} material={tapMat} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.09, 0.012, 6, 32]} />
      </mesh>

      {/* The line and its feeders, the packets and their trails, the copies. */}
      <points geometry={line.g} material={line.m} frustumCulled={false} />
      <lineSegments geometry={feeders} material={feederMat} />
      <points geometry={packets.g} material={packets.m} frustumCulled={false} />
      <lineSegments geometry={trails.g} material={trails.m} frustumCulled={false} />
      <points geometry={copies.g} material={copies.m} frustumCulled={false} />

      {/* Shield. */}
      <group ref={shieldG} visible={false}>
        <lineSegments geometry={latticeGeo} material={latticeMat} />
        <points geometry={nodeDots.g} material={nodeDots.m} frustumCulled={false} />
        <mesh material={glassMat}>
          <boxGeometry args={[SHIELD_SIZE * 1.15, SHIELD_SIZE * 1.15, SHIELD_SIZE * 1.15]} />
        </mesh>
      </group>
      <mesh ref={sigRing} geometry={sigGeo} visible={false}>
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <mesh ref={ripple} visible={false} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Scan sweep, the verify probe and its ripple on the page. */}
      <mesh ref={sweep} visible={false}>
        <planeGeometry args={[0.04, WEB_H]} />
        <meshBasicMaterial transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={probe} visible={false}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <primitive object={probeLine} />
      <mesh ref={webRipple} position={[WEB.x, WEB.y, 0.04]} visible={false}>
        <ringGeometry args={[0.94, 1, 64]} />
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {CHECKS.map((ch, i) => (
        <mesh
          key={ch.id}
          ref={(m) => void (badges.current[i] = m)}
          material={badgeMats[i]}
          visible={false}
        >
          <planeGeometry args={[0.22, 0.12]} />
        </mesh>
      ))}
      <points geometry={attackDots.g} material={attackDots.m} frustumCulled={false} />

      {/* Labels. */}
      {findings.map((f) => (
        <Anchor
          key={f.id}
          position={f.at}
          label={f.label}
          value={f.value}
          role={findingRole(f.id)}
          show={show && !phone && scanned && (id === "scan" || id === "fix")}
        />
      ))}
      <Anchor
        position={[WEB.x, WEB.y - WEB_H / 2 - 0.05, 0.3]}
        side="down"
        label="Readiness score"
        value={
          v.score !== undefined
            ? `${v.score} / 100${v.after ? ` · was ${v.before?.score}` : ""}`
            : "–"
        }
        role={v.after ? "ok" : "warn"}
        show={show && scanned && (id === "scan" || id === "verify")}
      />
      <Anchor
        position={[HARVESTER.x, HARVESTER.y - 0.45, 0]}
        side="down"
        label="Recorder (sim)"
        value={`${v.recorded} handshakes recorded · ${v.exposed} open at Q-Day${v.upgraded && beat >= 3 ? " · new captures unreadable" : ""}`}
        role="danger"
        show={show && (phone ? id === "harvest" : id === "scan" || id === "harvest")}
      />
      {v.handshake && (
        <Anchor
          position={[SHIELD_AT[mode].x, SHIELD_AT[mode].y + 0.55, 0]}
          label={
            v.handshake.quantumSafe ? v.handshake.group : `${v.handshake.group} · TLS unchanged`
          }
          value={`${v.handshake.ms.toFixed(2)} ms · measured`}
          role={v.handshake.quantumSafe ? "kem" : "danger"}
          show={show && id === "handshake"}
        />
      )}
      {mode === "code" && (
        <Anchor
          position={[SERVER.x, SERVER.y + SERVER_SIZE[1] / 2 + 0.05, 0.6]}
          side="down"
          label="One line in the bank's app"
          value={typed || " "}
          role="kem"
          show={id === "install" && (show || typed.length > 0)}
        />
      )}
      {v.report && (
        <Anchor
          position={[SHIELD_AT[mode].x, SHIELD_AT[mode].y - 0.75, 0]}
          side="down"
          label="Signed report"
          value="ML-DSA-65 · verified"
          role="sig"
          show={show && !phone && id === "verify"}
        />
      )}
      {v.attack && (
        <Anchor
          position={[SHIELD_AT[mode].x - 0.9, SHIELD_AT[mode].y + 0.6, 0]}
          label="Attack"
          value={`${v.attack.refused} of ${v.attack.sent} turned away · ${v.attack.answered} answered`}
          role="danger"
          show={show && id === "attack"}
        />
      )}
    </Thicken>
  );
}

/** Seconds into the scan beat (for "the findings have appeared"). */
function at0(beat: number, bt: number, reduce: boolean) {
  return reduce || beat > 0 ? 99 : bt;
}
