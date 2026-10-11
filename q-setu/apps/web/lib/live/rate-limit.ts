/** Fixed-size sliding-window rate limiter, keyed by client (IP). In-process; good enough for one node. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit. Returns 0 if allowed, otherwise the seconds until the next slot frees up. */
  take(key: string): number {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return Math.ceil((this.windowMs - (t - list[0]!)) / 1000);
    }
    list.push(t);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.hits.delete(this.hits.keys().next().value!);
    return 0;
  }
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}
