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

/**
 * The client's IP, as seen by the proxy we trust. `X-Forwarded-For` is a list each proxy appends
 * to, and the client can write anything into it before it reaches us, so the *first* entry is
 * attacker-controlled. The trustworthy entry is the one appended by our own outermost proxy:
 * counting from the right, TRUSTED_PROXY_HOPS (default 1: Vercel, Render, a single nginx). With no
 * header at all (local dev, direct connections) everyone shares the key "local".
 */
export function clientIp(req: Request): string {
  const hops = Math.max(1, Math.min(5, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1));
  const list = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const raw = list.length
    ? list[Math.max(0, list.length - hops)]!
    : (req.headers.get("x-real-ip") ?? "");
  const ip = raw.replace(/^\[|\](:\d+)?$/g, "").replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip.toLowerCase() : "local";
}

/** @deprecated name kept for the existing limiters; same as clientIp. */
export const clientKey = clientIp;
