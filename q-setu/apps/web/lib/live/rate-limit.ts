/** Fixed-size sliding-window rate limiter, keyed by client (IP). In-process; good enough for one node. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Seconds until `key` may take a slot (0 = now), without recording a hit. */
  peek(key: string): number {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    return list.length >= this.limit ? Math.ceil((this.windowMs - (t - list[0]!)) / 1000) : 0;
  }

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

/**
 * The client key for anonymous scans. X-Forwarded-For is client-controlled unless a trusted proxy sets it,
 * so it is only trusted with QSETU_TRUST_PROXY=1 (then the right-most entry, the one the proxy appended).
 * Without it the caller's IP is unknown (Next.js does not append the socket address), so only the
 * server-wide ceiling applies; spoofing the header then gains nothing.
 */
export function scanClientKey(
  req: Request,
  trustProxy = process.env.QSETU_TRUST_PROXY === "1",
): string {
  if (!trustProxy) return "anonymous";
  const hops = req.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return hops?.at(-1) || req.headers.get("x-real-ip") || "anonymous";
}

/** Anonymous scan limits: per client IP 6/min and 30/h (trusted proxy), plus a server-wide 30/min and 300/h ceiling. */
export class ScanLimits {
  private readonly perMin: RateLimiter;
  private readonly perHour: RateLimiter;
  private readonly allMin: RateLimiter;
  private readonly allHour: RateLimiter;
  constructor(now: () => number = Date.now) {
    this.perMin = new RateLimiter(6, 60_000, now);
    this.perHour = new RateLimiter(30, 3_600_000, now);
    this.allMin = new RateLimiter(30, 60_000, now);
    this.allHour = new RateLimiter(300, 3_600_000, now);
  }
  /** 0 if allowed (and counted), otherwise the seconds to wait. Nothing is counted when refused. */
  take(key: string): number {
    const perIp = key !== "anonymous";
    const peek = [
      perIp ? this.perMin.peek(key) : 0,
      perIp ? this.perHour.peek(key) : 0,
      this.allMin.peek("*"),
      this.allHour.peek("*"),
    ];
    const wait = Math.max(...peek);
    if (wait) return wait;
    if (perIp) {
      this.perMin.take(key);
      this.perHour.take(key);
    }
    this.allMin.take("*");
    this.allHour.take("*");
    return 0;
  }
}
