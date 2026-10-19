"use client";

/**
 * "Encryption is folding": the real bytes, physically folding and unfolding.
 *
 * A FoldSheet is a flat sheet of tiles, one per real byte, in --warn (exposed). Sealing folds it in
 * half four times along real creases (each half rotating 180° about its hinge and stacking on top,
 * like origami) into a small dense brick: 8 × 8 tiles become 2 × 2 × 16. As each tile folds it takes
 * --kem, its brightness set by its real ciphertext byte, so every run's brick looks different; when
 * the last crease settles an --sig band (the signature) wraps it. Each crease starts after a delay
 * set by a real ciphertext byte, winds up a touch the wrong way (anticipation) and settles crisply.
 * Opening plays it backwards to the readable sheet. A wrong key or a tampered byte jams it: it starts
 * to unfold, sticks at the bad crease, shudders and crumples there. `crumpled` is the sheet as a
 * recorder holds it (crushed), and `smooth()` unfolds a crumpled sheet flat (an attacker reading it).
 * One InstancedMesh (one draw call); no allocation per frame.
 */
import * as THREE from "three";
import { springIn } from "@/lib/motion";

const COLS = 8;
const ROWS = 8;
export const TILES = COLS * ROWS;
const FOLD_MS = 380;
const WIND = 0.09;

type Phase =
  | { kind: "flat" }
  | { kind: "seal"; at: number }
  | { kind: "sealed" }
  | { kind: "open"; at: number }
  | { kind: "jam"; at: number; crease: number }
  | { kind: "crumpled" }
  | { kind: "smooth"; at: number };

interface Fold {
  /** Fold across x (a crease parallel to y) or across y. */
  axis: "x" | "y";
  crease: number;
  /** Height of the stack's top when this fold starts (the hinge sits there). */
  hinge: number;
}

/** A crease's angle over time: a small wind-up the wrong way, then a spring with a crisp settle. */
function creaseAngle(ms: number): number {
  const t = ms / 1000;
  if (t <= 0) return 0;
  if (t < WIND) return -0.06 * Math.sin((Math.PI * t) / WIND);
  return Math.min(1.04, springIn(t - WIND, 0.62, 2.6));
}

export class FoldSheet {
  readonly group = new THREE.Group();
  readonly tiles: THREE.InstancedMesh;
  readonly band: THREE.Mesh;
  private pitch: number;
  private thick: number;
  private base: THREE.Vector3[] = [];
  private member: boolean[][] = [];
  private folds: Fold[] = [];
  private finalCenter = new THREE.Vector3();
  private phase: Phase = { kind: "flat" };
  private plain = new Uint8Array(TILES);
  private cipher = new Uint8Array(TILES);
  private delays = new Float32Array(4);
  private crumple: { r: THREE.Euler; o: THREE.Vector3 }[] = [];
  private col = new THREE.Color();
  private m = new THREE.Matrix4();
  private r = new THREE.Matrix4();
  private tr = new THREE.Matrix4();
  private inv = new THREE.Matrix4();
  private cc = new THREE.Color();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private axisX = new THREE.Vector3(1, 0, 0);
  private axisY = new THREE.Vector3(0, 1, 0);

  constructor(
    private c: { plain: THREE.Color; cipher: THREE.Color; sig: THREE.Color; danger: THREE.Color },
    { tile = 0.1, gap = 0.012, seed = 1 } = {},
  ) {
    this.pitch = tile + gap;
    this.thick = tile * 0.14;
    const geo = new THREE.BoxGeometry(tile, tile, this.thick);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.tiles = new THREE.InstancedMesh(geo, mat, TILES);
    this.tiles.frustumCulled = false;
    for (let i = 0; i < TILES; i++) {
      const x = ((i % COLS) - (COLS - 1) / 2) * this.pitch;
      const y = (Math.floor(i / COLS) - (ROWS - 1) / 2) * this.pitch;
      this.base.push(new THREE.Vector3(x, y, 0));
      this.tiles.setColorAt(i, c.plain);
    }
    // The four creases: across x, across y, x, y. Work out each tile's side of each crease by
    // carrying its (completed) position through the folds before it.
    const minX = (-COLS * this.pitch) / 2;
    let maxX = -minX;
    const minY = (-ROWS * this.pitch) / 2;
    let maxY = -minY;
    let layers = 1;
    const pos = this.base.map((b) => b.clone());
    for (const axis of ["x", "y", "x", "y"] as const) {
      const crease = axis === "x" ? (minX + maxX) / 2 : (minY + maxY) / 2;
      const hinge = layers * this.thick;
      this.folds.push({ axis, crease, hinge });
      const side = pos.map((p) => (axis === "x" ? p.x > crease : p.y > crease));
      this.member.push(side);
      pos.forEach((p, i) => {
        if (!side[i]) return;
        if (axis === "x") p.x = 2 * crease - p.x;
        else p.y = 2 * crease - p.y;
        p.z = 2 * hinge - p.z;
      });
      if (axis === "x") maxX = crease;
      else maxY = crease;
      layers *= 2;
    }
    this.finalCenter.set((minX + maxX) / 2, (minY + maxY) / 2, (layers * this.thick) / 2);
    // Crumple: a deterministic random rotation and squeeze per tile.
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) * 2 - 1;
    for (let i = 0; i < TILES; i++)
      this.crumple.push({
        r: new THREE.Euler(rnd() * 1.6, rnd() * 1.6, rnd() * 1.2),
        o: new THREE.Vector3(rnd() * 0.06, rnd() * 0.06, rnd() * 0.12),
      });
    // The signature band: a square collar round the brick's middle.
    const bw = 2 * this.pitch + 0.03;
    this.band = new THREE.Mesh(
      new THREE.CylinderGeometry(
        bw * 0.72,
        bw * 0.72,
        layers * this.thick * 0.28,
        4,
        1,
        true,
      ).rotateY(Math.PI / 4),
      new THREE.MeshBasicMaterial({
        color: c.sig.clone().multiplyScalar(2.2),
        toneMapped: false,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    this.band.rotation.x = Math.PI / 2;
    this.band.visible = false;
    this.group.add(this.tiles, this.band);
  }

  /** The real bytes: the plaintext (shown flat) and its ciphertext (the brick's pattern and timing). */
  setBytes(plain: Uint8Array, cipher: Uint8Array) {
    this.plain.fill(0);
    this.cipher.fill(0);
    this.plain.set(plain.subarray(0, TILES));
    this.cipher.set(cipher.subarray(0, TILES));
    // Each crease waits a little longer for a higher ciphertext byte (0–140 ms).
    for (let i = 0; i < 4; i++) this.delays[i] = ((this.cipher[i * 7] ?? 0) / 255) * 140;
  }

  seal(at: number) {
    this.phase = { kind: "seal", at };
  }
  open(at: number) {
    this.phase = { kind: "open", at };
  }
  /** Starts to unfold, then jams at crease `crease` (0–3) and crumples there. */
  jam(at: number, crease = 1) {
    this.phase = { kind: "jam", at, crease };
  }
  setSealed() {
    this.phase = { kind: "sealed" };
  }
  setFlat() {
    this.phase = { kind: "flat" };
  }
  setCrumpled() {
    this.phase = { kind: "crumpled" };
  }
  smooth(at: number) {
    this.phase = { kind: "smooth", at };
  }
  get kind() {
    return this.phase.kind;
  }
  /** When the current animation's last crease has settled (ms after it began). */
  get duration() {
    return 4 * FOLD_MS + this.delays.reduce((a, b) => a + b, 0) + 300;
  }

  /** Fold progress (0 flat … 1 folded) of each crease, and the crumple amount, at `now`. */
  private state(now: number, reduce: boolean): { p: number[]; crumple: number; jamAt: number } {
    const ph = this.phase;
    const p = [0, 0, 0, 0];
    let crumple = 0;
    let jamAt = -1;
    const run = (ms: number, forward: boolean) => {
      let t = ms;
      for (let k = 0; k < 4; k++) {
        const i = forward ? k : 3 - k;
        t -= this.delays[i]!;
        const a = reduce ? 1 : creaseAngle(t);
        p[i] = forward ? a : 1 - a;
        t -= FOLD_MS;
      }
    };
    switch (ph.kind) {
      case "flat":
        break;
      case "sealed":
        p.fill(1);
        break;
      case "seal":
        run(now - ph.at, true);
        break;
      case "open":
        p.fill(1);
        run(now - ph.at, false);
        break;
      case "jam": {
        // Unfold normally down to the bad crease; it opens a little, sticks, shudders and crumples.
        p.fill(1);
        const ms = now - ph.at;
        let t = ms;
        for (let i = 3; i > ph.crease; i--) {
          t -= this.delays[i]!;
          p[i] = 1 - (reduce ? 1 : creaseAngle(t));
          t -= FOLD_MS;
        }
        const stuck = reduce ? 1 : Math.min(1, Math.max(0, t / FOLD_MS));
        const shudder = reduce
          ? 0
          : Math.sin(t / 22) * Math.exp(-Math.max(0, t - FOLD_MS) / 400) * 0.04;
        p[ph.crease] = 1 - 0.32 * stuck + (t > FOLD_MS * 0.6 ? shudder : 0);
        crumple = reduce ? 0.6 : Math.min(0.6, Math.max(0, (t - FOLD_MS) / 900) * 0.6);
        jamAt = ph.crease;
        break;
      }
      case "crumpled":
        crumple = 1;
        break;
      case "smooth":
        crumple = reduce
          ? 0
          : 1 - Math.min(1, Math.max(0, springIn((now - ph.at) / 1000, 0.6, 0.9)));
        break;
    }
    return { p, crumple, jamAt };
  }

  /** Writes every tile's matrix and colour for `now`. */
  update(now: number, reduce: boolean) {
    const { p, crumple, jamAt } = this.state(now, reduce);
    const folded = p.reduce((a, b) => a + Math.max(0, Math.min(1, b)), 0) / 4;
    for (let i = 0; i < TILES; i++) {
      this.m.makeTranslation(this.base[i]!.x, this.base[i]!.y, 0);
      for (let f = 0; f < 4; f++) {
        if (!this.member[f]![i] || p[f] === 0) continue;
        const fold = this.folds[f]!;
        const ang = Math.PI * p[f]!;
        // Rotate about the hinge line (the crease, at the stack's top), lifting the half over.
        if (fold.axis === "x") {
          this.r.makeRotationAxis(this.axisY, -ang);
          this.tr.makeTranslation(fold.crease, 0, fold.hinge);
        } else {
          this.r.makeRotationAxis(this.axisX, ang);
          this.tr.makeTranslation(0, fold.crease, fold.hinge);
        }
        this.inv.copy(this.tr).invert();
        this.m.premultiply(this.inv).premultiply(this.r).premultiply(this.tr);
      }
      // Centre the brick as it forms (the sheet's centre and the brick's centre differ).
      this.v.copy(this.finalCenter).multiplyScalar(-folded);
      this.m.premultiply(this.tr.makeTranslation(this.v.x, this.v.y, this.v.z));
      if (crumple > 0 && (jamAt < 0 || this.member[jamAt]![i])) {
        const cr = this.crumple[i]!;
        this.e.set(cr.r.x * crumple, cr.r.y * crumple, cr.r.z * crumple);
        this.q.setFromEuler(this.e);
        this.r.compose(this.v.copy(cr.o).multiplyScalar(crumple), this.q, this.one);
        this.m.multiply(this.r);
        if (jamAt < 0)
          this.m.premultiply(this.tr.makeScale(1 - 0.45 * crumple, 1 - 0.45 * crumple, 1));
      }
      this.tiles.setMatrixAt(i, this.m);
      // Colour: plaintext --warn; ciphertext --kem with its byte's brightness as the tile folds.
      const f = Math.max(
        0,
        Math.min(
          1,
          this.member.reduce((a, side, k) => (side[i] ? Math.max(a, p[k]!) : a), 0) * 1.4 +
            folded * 0.6,
        ),
      );
      const b = this.cipher[i]! / 255;
      const pb = this.plain[i]! / 255;
      this.col.copy(this.c.plain).multiplyScalar(0.55 + 0.6 * pb);
      this.cc.copy(this.c.cipher).multiplyScalar(0.25 + 1.9 * b * b);
      this.col.lerp(this.cc, f);
      if (jamAt >= 0 && this.member[jamAt]![i] && crumple > 0)
        this.col.lerp(this.c.danger, Math.min(1, crumple * 2) * (Math.sin(now / 40) > 0 ? 1 : 0.5));
      this.tiles.setColorAt(i, this.col);
    }
    this.tiles.instanceMatrix.needsUpdate = true;
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
    // The signature band: wraps the brick once the last crease has settled.
    const settled = p.every((x) => x >= 0.98) ? 1 : 0;
    this.band.visible = settled > 0 && jamAt < 0;
    this.band.scale.setScalar(this.band.visible ? 1 : 0.0001);
  }

  dispose() {
    this.tiles.geometry.dispose();
    (this.tiles.material as THREE.Material).dispose();
    this.band.geometry.dispose();
    (this.band.material as THREE.Material).dispose();
  }
}
