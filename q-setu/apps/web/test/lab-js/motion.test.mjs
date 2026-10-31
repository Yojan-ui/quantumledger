import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  breathe,
  cubicBezier,
  flightDuration,
  flightProgress,
  MOTION,
  rollValue,
  staggerDelay,
} from "../../public/lab/js/motion.js";

const css = readFileSync(new URL("../../public/lab/css/tokens.css", import.meta.url), "utf8");
const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(m, name);
  return m[1].trim();
};

test("tokens.css mirrors motion.js", () => {
  assert.equal(token("dur-overlay"), `${MOTION.overlayMs}ms`);
  assert.equal(token("dur-exit"), `${MOTION.exitMs}ms`);
  assert.equal(token("dur-stagger"), `${MOTION.staggerMs}ms`);
  assert.equal(token("dur-roll"), `${MOTION.rollMs}ms`);
  assert.equal(token("dur-flight-min"), `${MOTION.flightMinMs}ms`);
  assert.equal(token("dur-flight-max"), `${MOTION.flightMaxMs}ms`);
  assert.equal(token("rise"), `${MOTION.riseIn}px`);
  assert.equal(token("ease-overlay"), `cubic-bezier(${MOTION.overlayEase.join(", ")})`);
  assert.equal(token("ease-exit"), `cubic-bezier(${MOTION.exitEase.join(", ")})`);
});

test("flights stay in the 1.1-1.6 s band and settle exactly", () => {
  assert.equal(flightDuration(0), 1100);
  assert.equal(flightDuration(1e9), 1600);
  assert.equal(flightProgress(0), 0);
  assert.equal(flightProgress(1), 1);
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => flightProgress(i / 100)));
  assert.ok(peak > 1 && peak <= 1 + MOTION.settleOvershoot + 1e-9);
});

test("cubic bezier endpoints and monotonic overlay ease", () => {
  const e = cubicBezier(...MOTION.overlayEase);
  assert.ok(Math.abs(e(0)) < 1e-6 && Math.abs(e(1) - 1) < 1e-6);
  let prev = -1;
  for (let i = 0; i <= 50; i++) {
    const v = e(i / 50);
    assert.ok(v >= prev - 1e-9);
    prev = v;
  }
  const lin = cubicBezier(0, 0, 1, 1);
  assert.ok(Math.abs(lin(0.37) - 0.37) < 1e-4);
});

test("reduced motion: numbers jump, breathing stops", () => {
  assert.equal(rollValue(0, 42, 10, 600, true), 42);
  assert.equal(rollValue(undefined, 42, 10), 42);
  assert.equal(rollValue(0, 100, 600), 100);
  assert.equal(breathe(1234, true), 1);
  for (let t = 0; t < 8000; t += 500) assert.ok(breathe(t) >= 1 && breathe(t) <= 1.015 + 1e-9);
  assert.equal(staggerDelay(3), 120);
});
