/**
 * Small, bounded counters for behaviour over time. Every map is capped (least recently used goes
 * first), so a flood of new IPs can't grow memory without limit.
 */

/** A Map that forgets its least recently used key past `max` entries. */
export class Lru<K, V> {
  private readonly m = new Map<K, V>();
  constructor(private readonly max: number) {}
  get(k: K): V | undefined {
    const v = this.m.get(k);
    if (v !== undefined) {
      this.m.delete(k);
      this.m.set(k, v);
    }
    return v;
  }
  set(k: K, v: V): void {
    this.m.delete(k);
    this.m.set(k, v);
    if (this.m.size > this.max) this.m.delete(this.m.keys().next().value as K);
  }
  delete(k: K): void {
    this.m.delete(k);
  }
  get size() {
    return this.m.size;
  }
}

/** Events in the last `windowMs`, counted in `slots` buckets (cheap and close enough). */
export class Window {
  private readonly counts: number[];
  private readonly slotMs: number;
  private head = 0;
  private headAt = 0;
  constructor(
    windowMs: number,
    private readonly slots = 10,
  ) {
    this.counts = new Array<number>(slots).fill(0);
    this.slotMs = windowMs / slots;
  }
  private roll(now: number) {
    const slot = Math.floor(now / this.slotMs);
    if (this.headAt === 0) this.headAt = slot;
    const steps = Math.min(this.slots, slot - this.headAt);
    for (let i = 0; i < steps; i++) {
      this.head = (this.head + 1) % this.slots;
      this.counts[this.head] = 0;
    }
    if (steps > 0) this.headAt = slot;
  }
  add(now: number, n = 1): number {
    this.roll(now);
    this.counts[this.head]! += n;
    return this.total(now);
  }
  total(now: number): number {
    this.roll(now);
    return this.counts.reduce((a, b) => a + b, 0);
  }
}

/** Distinct values seen in the last window (two alternating sets: approximate, bounded). */
export class DistinctWindow {
  private cur = new Set<string>();
  private prev = new Set<string>();
  private startedAt = 0;
  constructor(
    private readonly windowMs: number,
    private readonly cap = 512,
  ) {}
  add(now: number, v: string): number {
    if (now - this.startedAt >= this.windowMs) {
      this.prev = this.cur;
      this.cur = new Set();
      this.startedAt = now;
    }
    if (this.cur.size < this.cap) this.cur.add(v);
    let n = this.cur.size;
    for (const p of this.prev) if (!this.cur.has(p)) n++;
    return n;
  }
}
