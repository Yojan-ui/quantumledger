/**
 * The framework-neutral part of the Shield middleware: the defence engine, safe response headers,
 * the challenge endpoint, and batched event reports to the dashboard.
 *
 * What the middleware can't do: it runs inside your app, after TLS has already ended, so it can't
 * add the post-quantum key exchange. That needs Shield Edge in front (the DNS route or the
 * container). It also can't see TLS fingerprints, so its view of a client is headers and behaviour.
 */
import {
  Guard,
  POW_PATH,
  type Decision,
  type GuardConfig,
  type GuardEvent,
  type Mode,
  type RequestInfo,
} from "@qsetu/shield-guard";

export interface ShieldOptions {
  /** Your site key from the dashboard (keep it server-side; ≥ 32 characters). */
  siteKey: string;
  /** New sites start in "monitor": scored and reported, never blocked, until you switch. */
  mode?: Mode;
  /** Where events are reported; default the QuantumLedger dashboard. `false` to keep them local. */
  reportTo?: string | false;
  /** Count this many trusted proxies (load balancer, CDN) when reading X-Forwarded-For. Default 0. */
  trustProxyHops?: number;
  /** Set safe response headers (nosniff, referrer policy, frame options; HSTS over https). Default true. */
  headers?: boolean;
  honeypots?: string[];
  trapPath?: string;
  canaryKeys?: string[];
  exempt?: RegExp[];
  onEvent?: (e: GuardEvent) => void;
}

export const DEFAULT_REPORT_URL = "https://quantumledger.app/api/shield/events";

export interface Shield {
  guard: Guard;
  /** The client's IP from the socket address and X-Forwarded-For, counting trusted hops only. */
  clientIp(remote: string | undefined, xff: string | string[] | undefined): string;
  check(req: RequestInfo): Promise<Decision>;
  finish(req: RequestInfo, status: number): void;
  isChallengePost(method: string, path: string): boolean;
  solve(
    req: RequestInfo,
    body: string,
  ): { status: number; headers: Record<string, string>; body: string };
  safeHeaders(https: boolean): Record<string, string>;
  /** Sends any queued events now (also every 10 s by itself). */
  flush(): Promise<void>;
  close(): void;
}

export function createShield(opts: ShieldOptions): Shield {
  if (!opts.siteKey || opts.siteKey.length < 32)
    throw new Error("shield(): siteKey must be your ≥ 32-character site key");
  const queue: GuardEvent[] = [];
  const report = opts.reportTo === false ? undefined : (opts.reportTo ?? DEFAULT_REPORT_URL);
  const cfg: GuardConfig = {
    mode: opts.mode ?? "monitor",
    secret: opts.siteKey,
    ...(opts.honeypots ? { honeypots: opts.honeypots } : {}),
    ...(opts.trapPath ? { trapPath: opts.trapPath } : {}),
    ...(opts.canaryKeys ? { canaryKeys: opts.canaryKeys } : {}),
    ...(opts.exempt ? { exempt: opts.exempt } : {}),
    onEvent: (e) => {
      opts.onEvent?.(e);
      if (report && queue.length < 1000) queue.push(e);
    },
  };
  const guard = new Guard(cfg);
  const hops = Math.max(0, Math.min(5, opts.trustProxyHops ?? 0));

  const flush = async () => {
    if (!report || !queue.length) return;
    const batch = queue.splice(0, 200);
    try {
      await fetch(report, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.siteKey}` },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Reporting is best-effort: never let it affect the site.
    }
  };
  const timer = setInterval(() => void flush(), 10_000);
  timer.unref?.();

  return {
    guard,
    clientIp(remote, xff) {
      const list = (Array.isArray(xff) ? xff.join(",") : (xff ?? ""))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const ip = hops > 0 && list.length >= hops ? list[list.length - hops]! : (remote ?? "");
      return ip.replace(/^::ffff:(?=\d)/, "");
    },
    check: (r) => guard.check(r),
    finish: (r, s) => guard.finish(r, s),
    isChallengePost: (m, p) => m === "POST" && p.split("?")[0] === POW_PATH,
    solve: (r, b) => guard.solve(r, b),
    safeHeaders(https) {
      if (opts.headers === false) return {};
      return {
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-frame-options": "SAMEORIGIN",
        ...(https ? { "strict-transport-security": "max-age=63072000; includeSubDomains" } : {}),
      };
    },
    flush,
    close: () => clearInterval(timer),
  };
}
