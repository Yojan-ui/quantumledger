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
import { PROFILES } from "./profiles";
import type { AttackEvent, EventRecord } from "../types";
import {
  datasetFeatures,
  FEATURES,
  FeatureTracker,
  toVector,
  type DatasetRow,
  type Facts,
  type Features,
} from "./features";
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
/** Dataset requests per class used when the full CSIC copy is present (keeps training fast). */
export const MAX_DATASET = 3000;
const DATA_DIR = new URL("../../data/", import.meta.url);

function parseCsic(text: string, label: 0 | 1): DatasetRow[] {
  const t = text.replace(/\r\n/g, "\n");
  const starts = [...t.matchAll(/^(GET|POST|PUT) http/gm)].map((m) => m.index);
  return starts.map((s, i) => {
    const chunk = t.slice(s, starts[i + 1] ?? t.length);
    const cut = chunk.indexOf("\n\n");
    const head = cut < 0 ? chunk : chunk.slice(0, cut);
    const rest = cut < 0 ? "" : chunk.slice(cut + 2);
    const [method = "GET", url = ""] = head.split("\n")[0]!.split(" ");
    const u = new URL(url, "http://localhost");
    return {
      method,
      path: u.pathname,
      query: u.search.slice(1),
      body: method === "POST" || method === "PUT" ? (rest.trim().split("\n")[0] ?? "") : "",
      label,
    };
  });
}

const evenly = <T>(a: T[], n: number) => {
  const step = Math.max(1, Math.floor(a.length / n));
  return a.filter((_, i) => i % step === 0).slice(0, n);
};

/**
 * The public labelled dataset: the full CSIC 2010 files if they are in data/csic2010/, else the
 * bundled sample. Read from disk; never fetched.
 */
export function loadDataset(): { rows: DatasetRow[]; name: string } {
  try {
    const n = readFileSync(new URL("csic2010/normalTrafficTraining.txt", DATA_DIR), "latin1");
    const a = readFileSync(new URL("csic2010/anomalousTrafficTest.txt", DATA_DIR), "latin1");
    return {
      rows: [...evenly(parseCsic(n, 0), MAX_DATASET), ...evenly(parseCsic(a, 1), MAX_DATASET)],
      name: "CSIC 2010 (full copy, evenly trimmed)",
    };
  } catch {
    const rows = readFileSync(new URL("csic2010-sample.jsonl", DATA_DIR), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as DatasetRow);
    return { rows, name: "CSIC 2010 (bundled sample)" };
  }
}

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

/**
 * Trains and evaluates on the public dataset plus this Lab's evidence. `normal` adds safe examples
 * from unrecorded traffic.
 */
export function train(
  events: EventRecord[],
  normal: number[][] = [],
  data: { rows: DatasetRow[]; name: string } = loadDataset(),
) {
  const t0 = performance.now();
  const { samples, byEvent } = dataset(events);
  let lab: Sample[] = [
    ...samples,
    ...normal.map((x, i) => ({ x, y: 0 as const, group: `normal:${i}` })),
  ];
  const capped = lab.length > MAX_SAMPLES;
  if (capped) lab = lab.slice(-MAX_SAMPLES);
  const ds: Sample[] = data.rows.map((r, i) => ({
    x: toVector(datasetFeatures(r).x),
    y: r.label,
    group: `csic:${i}`,
  }));
  const all = [...lab, ...ds];
  const groups = [...new Set(lab.filter((s) => s.y === 1).map((s) => s.group))];
  // Hold back about one recorded attack in five (whole incidents); with few, at least the newest.
  let test = new Set(groups.filter(heldBack));
  if (!test.size && groups.length > 1) test = new Set([groups.at(-1)!]);
  const isTest = (s: Sample) =>
    test.has(s.group) ||
    ((s.group.startsWith("normal:") || s.group.startsWith("csic:")) && heldBack(s.group));
  const trainSet = all.filter((s) => !isTest(s));
  const testSet = all.filter(isTest);
  let accuracy = 0;
  let labAccuracy: number | null = null;
  let datasetAccuracy: number | null = null;
  if (testSet.length && trainSet.length) {
    const probe = { ...fit(trainSet), v: 1 as const } as unknown as Weights;
    const ok = (s: Sample) => (forward(probe, s.x) >= 0.5 ? 1 : 0) === s.y;
    const share = (set: Sample[]) => (set.length ? set.filter(ok).length / set.length : null);
    accuracy = share(testSet) ?? 0;
    labAccuracy = share(testSet.filter((s) => !s.group.startsWith("csic:")));
    datasetAccuracy = share(testSet.filter((s) => s.group.startsWith("csic:")));
  }
  const r3 = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);
  const p = fit(all);
  const metrics: Metrics = {
    accuracy: r3(accuracy)!,
    heldOut: testSet.length,
    samples: all.length,
    attacks: groups.length,
    datasetAttacks: data.rows.filter((r) => r.label === 1).length,
    datasetNormal: data.rows.filter((r) => r.label === 0).length,
    labAccuracy: r3(labAccuracy),
    datasetAccuracy: r3(datasetAccuracy),
    dataset: data.name,
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
  private readonly data = loadDataset();

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
          // Vectors saved by an older feature set don't fit this model: drop them.
          this.normal = (JSON.parse(readFileSync(n, "utf8")) as number[][])
            .filter((x) => x.length === FEATURES.length)
            .slice(-MAX_NORMAL);
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

  /** The current model's verdict on each reference threat's typical traffic. */
  scoreProfiles(): { threatId: string; verdict: Verdict }[] {
    if (!this.weights) return [];
    return Object.entries(PROFILES).map(([threatId, p]) => ({
      threatId,
      verdict: verdict(this.weights!, p.x, p.facts),
    }));
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
    if (!force && events.length === this.trainedOn) return undefined;
    this.trainedOn = events.length;
    const { weights, byEvent } = train(events, this.normal, this.data);
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
