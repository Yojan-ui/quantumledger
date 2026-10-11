/**
 * The live event bus. Every adapter, the simulator, the mesh, the ledger and the KMS publish what
 * they actually did here (with measured wall time). `/api/stream` relays it over SSE, and
 * `/api/metrics` reads the rolling aggregates below.
 */
import { EventEmitter } from "node:events";
import { ROUTES } from "@/data/routes";
import type { CityStats, Metrics, Op, OpEvent, OpStats, PolicyState } from "./types";

export type Publish = Omit<OpEvent, "seq" | "at"> & { at?: number };

const WINDOW_MS = 60_000;
const RATE_MS = 5_000;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i]!;
}

export class Bus {
  private readonly ee = new EventEmitter();
  private seq = 0;
  private total = 0;
  /** Events inside the rolling window, oldest first. */
  private window: OpEvent[] = [];
  /** The last few events, so a new subscriber sees something immediately. */
  private readonly recent: OpEvent[] = [];
  private readonly sites = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {
    this.ee.setMaxListeners(0);
  }

  publish(e: Publish): OpEvent {
    const ev: OpEvent = { ...e, seq: ++this.seq, at: e.at ?? this.now() };
    this.total++;
    this.window.push(ev);
    this.recent.push(ev);
    if (this.recent.length > 40) this.recent.shift();
    if (ev.site) this.sites.set(ev.site, (this.sites.get(ev.site) ?? 0) + 1);
    this.trim();
    this.ee.emit("op", ev);
    return ev;
  }

  /** Runs `fn`, measures it, and publishes the result. Failures publish `ok: false` and rethrow. */
  timed<T>(
    { failDetail, ...e }: Omit<Publish, "ms" | "ok"> & { failDetail?: string },
    fn: () => T,
    bytesOf?: (r: T) => number,
  ): T {
    const t = performance.now();
    try {
      const r = fn();
      this.publish({ ...e, ms: performance.now() - t, ok: true, bytes: bytesOf?.(r) ?? e.bytes });
      return r;
    } catch (err) {
      this.publish({
        ...e,
        op: e.op === "OPEN" || e.op === "VERIFY" ? "REJECT" : e.op,
        ms: performance.now() - t,
        ok: false,
        detail: failDetail ?? (err as Error).message,
      });
      throw err;
    }
  }

  subscribe(fn: (e: OpEvent) => void): () => void {
    this.ee.on("op", fn);
    return () => void this.ee.off("op", fn);
  }

  listeners(): number {
    return this.ee.listenerCount("op");
  }

  siteCount(site: string): number {
    return this.sites.get(site) ?? 0;
  }

  history(): OpEvent[] {
    return [...this.recent];
  }

  metrics(policy: PolicyState): Metrics {
    this.trim();
    const t = this.now();
    const byOpMs = new Map<Op, number[]>();
    const cities = new Map<string, { sealed: number; rejected: number; ms: number; n: number }>();
    let recentCount = 0;
    const city = (name: string) => {
      let c = cities.get(name);
      if (!c) cities.set(name, (c = { sealed: 0, rejected: 0, ms: 0, n: 0 }));
      return c;
    };
    for (const e of this.window) {
      if (t - e.at <= RATE_MS) recentCount++;
      const list = byOpMs.get(e.op) ?? [];
      list.push(e.ms);
      byOpMs.set(e.op, list);
      const r = e.route !== undefined ? ROUTES[e.route] : undefined;
      const ends = r ? [r.from, r.to] : [e.from, e.to].filter((x): x is string => !!x);
      if (e.op === "SEAL" && e.ok)
        for (const name of ends) {
          const c = city(name);
          c.sealed++;
          c.ms += e.ms;
          c.n++;
        }
      if (e.op === "REJECT") for (const name of ends) city(name).rejected++;
    }
    const byOp: Partial<Record<Op, OpStats>> = {};
    for (const [op, list] of byOpMs) {
      const sorted = list.sort((a, b) => a - b);
      byOp[op] = {
        count: list.length,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
      };
    }
    const byCity: Record<string, CityStats> = {};
    for (const [name, c] of cities)
      byCity[name] = { sealed: c.sealed, rejected: c.rejected, avgMs: c.n ? c.ms / c.n : 0 };
    return {
      windowSec: WINDOW_MS / 1000,
      opsPerSec: recentCount / (RATE_MS / 1000),
      total: this.total,
      byOp,
      byCity,
      bySite: Object.fromEntries(this.sites),
      policy,
    };
  }

  private trim() {
    const cutoff = this.now() - WINDOW_MS;
    let i = 0;
    while (i < this.window.length && this.window[i]!.at < cutoff) i++;
    if (i) this.window = this.window.slice(i);
  }
}
