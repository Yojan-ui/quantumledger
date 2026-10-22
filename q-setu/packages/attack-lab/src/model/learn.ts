/**
 * Learning from the Lab's own evidence. The recorded events are the labelled data: a request Shield
 * flagged is an attack (1), one it let through is safe (0), and ordinary traffic Shield saw but
 * didn't record adds more safe examples (feature numbers only, nothing that identifies anyone).
 *
 * Each retrain holds back about one attack in five (whole incidents, so the model is tested on
 * attacks it never saw), measures accuracy on those, then trains the deployed model on everything.
 * Every update is written to the weights file and signed into the evidence chain with ML-DSA-65.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonical } from "@qsetu/shield/manifest-format";
import type { EvidenceStore } from "../store";
import type { AttackEvent, EventRecord } from "../types";
import { FEATURES, FeatureTracker, toVector, type Facts, type Features } from "./features";
import {
  fit,
  forward,
  verdict,
  type Metrics,
  type Sample,
  type Verdict,
  type Weights,
} from "./net";

/** The newest samples kept for training; more than this is trimmed (and the metrics say so). */
export const MAX_SAMPLES = 2000;
const MAX_NORMAL = 2000;

export const SHIPPED_WEIGHTS = new URL("./weights.json", import.meta.url);

const hashOf = (s: string) => createHash("sha256").update(s).digest("hex");
const heldBack = (group: string) => parseInt(hashOf(group).slice(0, 8), 16) % 5 === 0;

export function loadWeights(path: string | URL): Weights | undefined {
  try {
    const w = JSON.parse(readFileSync(path, "utf8")) as Weights;
    return w.v === 1 && w.features.length === FEATURES.length ? w : undefined;
  } catch {
    return undefined;
  }
}

export function saveWeights(path: string, w: Weights) {
  writeFileSync(`${path}.tmp`, JSON.stringify(w));
  renameSync(`${path}.tmp`, path);
}

/** Replays recorded events in time order into features and labels. */
export function dataset(events: EventRecord[]) {
  const tracker = new FeatureTracker();
  const byEvent = new Map<string, { x: Features; facts: Facts }>();
  const samples: Sample[] = [];
  for (const r of [...events].sort((a, b) => a.body.at - b.body.at || a.seq - b.seq)) {
    const f = tracker.observe(r.body);
    byEvent.set(r.body.id, f);
    samples.push({ x: toVector(f.x), y: r.body.flagged ? 1 : 0, group: r.body.incidentId });
  }
  return { samples, byEvent };
}

/** Trains and evaluates. `normal` adds safe examples from unrecorded traffic. */
export function train(events: EventRecord[], normal: number[][] = []) {
  const t0 = performance.now();
  const { samples, byEvent } = dataset(events);
  let all = [...samples, ...normal.map((x, i) => ({ x, y: 0 as const, group: `normal:${i}` }))];
  const capped = all.length > MAX_SAMPLES;
  if (capped) all = all.slice(-MAX_SAMPLES);
  const groups = [...new Set(all.filter((s) => s.y === 1).map((s) => s.group))];
  // Hold back about one attack in five; with few attacks, at least the newest one.
  let test = new Set(groups.filter(heldBack));
  if (!test.size && groups.length > 1) test = new Set([groups.at(-1)!]);
  const isTest = (s: Sample) =>
    test.has(s.group) || (s.group.startsWith("normal:") && heldBack(s.group));
  const trainSet = all.filter((s) => !isTest(s));
  const testSet = all.filter(isTest);
  let accuracy = 0;
  if (testSet.length && trainSet.length) {
    const probe = { ...fit(trainSet), v: 1 as const } as unknown as Weights;
    const right = testSet.filter((s) => (forward(probe, s.x) >= 0.5 ? 1 : 0) === s.y).length;
    accuracy = right / testSet.length;
  }
  const p = fit(all);
  const metrics: Metrics = {
    accuracy: Math.round(accuracy * 1000) / 1000,
    heldOut: testSet.length,
    samples: all.length,
    attacks: groups.length,
    capped,
    ms: 0,
  };
  const body = { v: 1 as const, features: FEATURES, ...p, metrics };
  const version = `m-${hashOf(canonical({ ...body, metrics: undefined })).slice(0, 10)}`;
  metrics.ms = Math.round(performance.now() - t0);
  const weights: Weights = { ...body, version, trainedAt: Date.now() };
  return { weights, byEvent };
}

export interface ModelUpdate {
  version: string;
  trainedAt: number;
  weightsHash: string;
  metrics: Metrics;
}

/**
 * The model the engine runs: scores each request as Shield finishes it, keeps a bounded sample of
 * ordinary traffic as safe examples, and retrains in the background when new evidence arrives.
 */
export class LiveModel {
  weights: Weights | undefined;
  private readonly tracker = new FeatureTracker();
  private normal: number[][] = [];
  private byEvent = new Map<string, { x: Features; facts: Facts }>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private trainedOn = -1;
  private readonly dir: string | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly store: EvidenceStore,
    opts: { dir?: string; shipped?: URL } = {},
  ) {
    if (opts.dir) {
      this.dir = join(opts.dir, "model");
      mkdirSync(this.dir, { recursive: true });
      const n = join(this.dir, "normal.json");
      if (existsSync(n)) {
        try {
          this.normal = (JSON.parse(readFileSync(n, "utf8")) as number[][]).slice(-MAX_NORMAL);
        } catch {
          this.normal = [];
        }
      }
    }
    this.weights =
      (this.dir && loadWeights(join(this.dir, "weights.json"))) ||
      loadWeights(opts.shipped ?? SHIPPED_WEIGHTS);
    store.onChange(() => this.schedule());
  }

  /** Features and verdict for a finished request (and remembers it in the source's history). */
  observe(e: AttackEvent): { verdict?: Verdict; x: number[] } {
    const f = this.tracker.observe(e);
    return {
      x: toVector(f.x),
      ...(this.weights ? { verdict: verdict(this.weights, f.x, f.facts) } : {}),
    };
  }

  /** A request Shield saw and let through without recording: one more safe example. */
  addNormal(x: number[]) {
    this.normal.push(x);
    if (this.normal.length > MAX_NORMAL) this.normal = this.normal.slice(-MAX_NORMAL);
  }

  /** The current model's verdict for a recorded event (for records written before it existed). */
  scoreEvent(id: string): Verdict | undefined {
    const f = this.byEvent.get(id);
    return f && this.weights ? verdict(this.weights, f.x, f.facts) : undefined;
  }

  onUpdate(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Retrains a moment after new evidence stops arriving. */
  schedule(delayMs = 2500) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.retrain();
    }, delayMs);
    this.timer.unref?.();
  }

  /** Trains on everything recorded so far, if anything new arrived. Returns the update, if any. */
  retrain(force = false): ModelUpdate | undefined {
    const events = this.store.allEvents();
    if (!events.length || (!force && events.length === this.trainedOn)) return undefined;
    this.trainedOn = events.length;
    const { weights, byEvent } = train(events, this.normal);
    this.byEvent = byEvent;
    this.weights = weights;
    if (this.dir) {
      saveWeights(join(this.dir, "weights.json"), weights);
      writeFileSync(join(this.dir, "normal.json"), JSON.stringify(this.normal));
    }
    const update: ModelUpdate = {
      version: weights.version,
      trainedAt: weights.trainedAt,
      weightsHash: hashOf(canonical(weights)),
      metrics: weights.metrics,
    };
    // Signed into the evidence chain like every other record.
    this.store.appendModel(update);
    for (const l of this.listeners) l();
    return update;
  }
}
