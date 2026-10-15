import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  anticipate,
  cascadeDelays,
  curl,
  LAND,
  LAZY,
  planMove,
  Rope,
  sampleMove,
  Spring,
  throwArc,
  throwSpeed,
  timeScale,
} from "@/lib/motion";

describe("springs", () => {
  it("LAND overshoots once and settles on its target", () => {
    const s = new Spring(0, LAND);
    s.target = 1;
    let peak = 0;
    for (let i = 0; i < 240; i++) peak = Math.max(peak, s.step(1 / 60));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.35);
    expect(s.settled(1e-2)).toBe(true);
  });
  it("LAZY never overshoots", () => {
    const s = new Spring(0, LAZY);
    s.target = 1;
    let peak = 0;
    for (let i = 0; i < 600; i++) peak = Math.max(peak, s.step(1 / 60));
    expect(peak).toBeLessThanOrEqual(1.001);
  });
  it("is stable at a slow frame rate", () => {
    const s = new Spring(0, LAND);
    s.target = 1;
    for (let i = 0; i < 40; i++) s.step(0.25);
    expect(Math.abs(s.x - 1)).toBeLessThan(0.01);
  });
});

describe("timing", () => {
  it("anticipation backs off first, then arrives", () => {
    expect(anticipate(0.06, 1)).toBeLessThan(0);
    expect(anticipate(0.12 + 1, 1)).toBeCloseTo(1, 5);
  });
  it("a throw is slowest at the apex and reaches 1", () => {
    expect(throwArc(1)).toBeCloseTo(1, 6);
    expect(throwSpeed(0.5)).toBeLessThan(throwSpeed(0.05));
    expect(throwSpeed(0.5)).toBeLessThan(throwSpeed(0.95));
  });
  it("cascades spread from the contact point in beats", () => {
    const pts = [0, 0, 0, 1, 0, 0, 3, 0, 0];
    const d = cascadeDelays(pts, { x: 0, y: 0, z: 0 }, { speed: 10, beat: 0.05 });
    expect(d[0]).toBe(0);
    expect(d[1]).toBeLessThan(d[2]!);
    for (const x of d) expect(Math.round(x / 0.05) * 0.05).toBeCloseTo(x, 6);
  });
  it("slow motion ramps 1 → 0.2 → 1", () => {
    expect(timeScale(0, 2)).toBe(1);
    expect(timeScale(2.1, 2)).toBeCloseTo(0.2, 6);
    expect(timeScale(5, 2)).toBe(1);
  });
});

describe("flow", () => {
  it("curl noise is divergence-free", () => {
    const v = new THREE.Vector3();
    const e = 1e-2;
    const at = (x: number, y: number, z: number) => curl(x, y, z, new THREE.Vector3()).clone();
    const div =
      (at(0.3 + e, 0.7, 0.2).x - at(0.3 - e, 0.7, 0.2).x) / (2 * e) +
      (at(0.3, 0.7 + e, 0.2).y - at(0.3, 0.7 - e, 0.2).y) / (2 * e) +
      (at(0.3, 0.7, 0.2 + e).z - at(0.3, 0.7, 0.2 - e).z) / (2 * e);
    expect(curl(0.3, 0.7, 0.2, v).length()).toBeGreaterThan(0.01);
    expect(Math.abs(div)).toBeLessThan(0.05);
  });
});

describe("rope", () => {
  it("sags under gravity between two pins and keeps its length", () => {
    const pts = Array.from({ length: 9 }, (_, i) => new THREE.Vector3(i * 0.5, 0, 0));
    const r = new Rope(pts);
    r.pin(0, pts[0]!);
    r.pin(8, new THREE.Vector3(3.5, 0, 0));
    for (let i = 0; i < 300; i++) r.step(1 / 60);
    expect(r.p[4]!.y).toBeLessThan(-0.2);
    expect(r.p[3]!.distanceTo(r.p[4]!)).toBeCloseTo(0.5, 1);
  });
});

describe("camera", () => {
  it("a move starts and ends on its framings, inside 1.2–1.8 s", () => {
    const m = planMove(
      { pos: new THREE.Vector3(0, 2, 10), look: new THREE.Vector3() },
      { pos: new THREE.Vector3(4, 1, 4), look: new THREE.Vector3(2, 0, 0) },
    );
    expect(m.duration).toBeGreaterThanOrEqual(1.2);
    expect(m.duration).toBeLessThanOrEqual(1.8);
    const p = new THREE.Vector3();
    const l = new THREE.Vector3();
    sampleMove(m, 0, p, l);
    expect(p.distanceTo(m.from.pos)).toBeLessThan(1e-6);
    expect(sampleMove(m, m.duration + 1, p, l)).toBe(true);
    expect(p.distanceTo(m.to.pos)).toBeLessThan(0.01);
  });
});
