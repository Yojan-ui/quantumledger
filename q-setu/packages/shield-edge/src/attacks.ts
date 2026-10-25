/**
 * The attack suite for the live side-by-side (/shield/live): the same attacks against the legacy bank
 * app twice, bare and behind Shield Edge, so the difference is plain to see.
 *
 *   burst      1,000 requests in parallel
 *   scan       a scanner walking 200 likely paths
 *   inject     SQL injection and XSS payloads in query and body
 *   honeypot   /.env, /.git/config, /wp-login.php, then a planted canary API key
 *   crawl      an AI crawler (GPTBot user agent) taking 150 pages as fast as it can
 *   tls        what an eavesdropper on the wire would face
 *
 * TARGETS ARE RESTRICTED. The suite refuses any host other than loopback (localhost, 127.0.0.1, ::1)
 * or the project's own demo deploys listed in OWN_DEMO_HOSTS, and checks what a name resolves to
 * before sending anything. There is deliberately no option or environment variable to widen this:
 * adding a host is a reviewed code change.
 */
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import tls from "node:tls";

/** The project's own public demo deploys (none yet). Only add hosts we operate. */
export const OWN_DEMO_HOSTS: readonly string[] = [];

const LOOPBACK = (ip: string) => ip === "::1" || ip.startsWith("127.") || ip === "::ffff:127.0.0.1";

export class TargetRefused extends Error {
  constructor(host: string) {
    super(
      `Refused: the attack suite only targets localhost or the project's own demo deploys, not "${host}"`,
    );
    this.name = "TargetRefused";
  }
}

/** Throws unless `url` is loopback (by name and by address) or one of our own demo deploys. */
export async function assertAllowedTarget(url: string): Promise<void> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (OWN_DEMO_HOSTS.includes(host)) return;
  if (isIP(host)) {
    if (!LOOPBACK(host)) throw new TargetRefused(host);
    return;
  }
  if (host !== "localhost") throw new TargetRefused(host);
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || !addrs.every((a) => LOOPBACK(a.address))) throw new TargetRefused(host);
}

export interface Target {
  label: string;
  url: string;
  /** For an https target: the TLS name to ask for. */
  servername?: string;
}

/** The suite's five attacks, in the order they run. */
export type AttackId = "burst" | "scan" | "injection" | "honeypot" | "crawler";

export interface AttackResult {
  attack: string;
  sent: number;
  /** 2xx and 3xx: the attacker got an answer from the app. */
  answered: number;
  /** 403, 429 and Shield's honeypot 404 after a delay: stopped before the app. */
  refused: number;
  /** Plain 404/400 from the app itself: no stop, just nothing there. */
  notFound: number;
  errors: number;
  ms: number;
  note?: string;
}

const WORDS = [
  "admin",
  "administrator",
  "login",
  "wp-admin",
  "wp-login.php",
  "phpmyadmin",
  ".env",
  ".git/config",
  "backup.zip",
  "backup.sql",
  "db.sql",
  "config.php",
  "config.json",
  "server-status",
  ".aws/credentials",
  "api/v1/users",
  "api/users",
  "api/admin",
  "graphql",
  "swagger.json",
  "openapi.json",
  "actuator/health",
  "debug",
  "console",
  "shell",
  "upload",
  "uploads",
  "files",
  "private",
  "internal",
  "test",
  "staging",
  "old",
  "dev",
  ".DS_Store",
  "id_rsa",
  "web.config",
];

export async function runSuite(
  target: Target,
  onEach?: (r: AttackResult) => void,
  /** Called before each attack (the live demo gives each attack a fresh defence state). */
  beforeEach?: (attack: string) => void,
  /** Run only these attacks (default: all five, in order). */
  only?: readonly AttackId[],
): Promise<AttackResult[]> {
  const want = (id: AttackId) => !only || only.includes(id);
  await assertAllowedTarget(target.url);
  const base = new URL(target.url);
  const secure = base.protocol === "https:";
  const agent = secure
    ? new https.Agent({ keepAlive: true, maxSockets: 100, rejectUnauthorized: false })
    : new http.Agent({ keepAlive: true, maxSockets: 100 });

  const send = (
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: string,
  ) =>
    new Promise<number>((resolve) => {
      const req = (secure ? https : http).request(
        {
          protocol: base.protocol,
          hostname: base.hostname,
          port: base.port,
          method,
          path,
          agent,
          headers: {
            "user-agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
            accept: "*/*",
            ...(target.servername ? { host: target.servername } : {}),
            ...(body ? { "content-type": "application/json" } : {}),
            ...headers,
          },
          ...(secure ? { servername: target.servername ?? base.hostname } : {}),
          timeout: 10_000,
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode ?? 0));
        },
      );
      req.on("timeout", () => req.destroy());
      req.on("error", () => resolve(0));
      req.end(body);
    });

  const tally = (attack: string, statuses: number[], ms: number, note?: string): AttackResult => ({
    attack,
    sent: statuses.length,
    answered: statuses.filter((s) => s >= 200 && s < 400).length,
    refused: statuses.filter((s) => s === 403 || s === 429 || s === 421).length,
    notFound: statuses.filter((s) => s === 404 || s === 400 || s === 405).length,
    errors: statuses.filter((s) => s === 0 || s >= 500).length,
    ms: Math.round(ms),
    ...(note ? { note } : {}),
  });

  const results: AttackResult[] = [];
  const done = (r: AttackResult) => {
    results.push(r);
    onEach?.(r);
  };
  let n = 0;
  const timed = async (fn: () => Promise<number[]>) => {
    beforeEach?.(String(n++));
    const t = performance.now();
    const s = await fn();
    return [s, performance.now() - t] as const;
  };

  // 1. Burst: 1,000 at once.
  if (want("burst")) {
    const [s, ms] = await timed(() =>
      Promise.all(
        Array.from({ length: 1000 }, () =>
          send("GET", "/api/health", { "user-agent": "Go-http-client/1.1" }),
        ),
      ),
    );
    done(tally("Burst of 1,000 parallel requests", s, ms));
  }
  // 2. Route scan.
  if (want("scan")) {
    const [s, ms] = await timed(async () => {
      const out: number[] = [];
      for (let i = 0; i < 200; i++)
        out.push(
          await send("GET", `/${WORDS[i % WORDS.length]}${i >= WORDS.length ? `?v=${i}` : ""}`, {
            "user-agent": "python-requests/2.32",
          }),
        );
      return out;
    });
    done(tally("Route scan (200 likely paths)", s, ms));
  }
  // 3. Injection payloads.
  if (want("injection")) {
    const payloads = [
      "' OR '1'='1' --",
      "1; DROP TABLE accounts;--",
      "<script>alert(document.cookie)</script>",
      '"><img src=x onerror=alert(1)>',
      "${jndi:ldap://x}",
      "../../../../etc/passwd",
    ];
    const [s, ms] = await timed(async () => {
      const out: number[] = [];
      for (let i = 0; i < 40; i++) {
        const p = payloads[i % payloads.length]!;
        out.push(
          i % 2
            ? await send("GET", `/api/health?q=${encodeURIComponent(p)}`)
            : await send("POST", "/api/transfer", {}, JSON.stringify({ to: p, amount: 1 })),
        );
      }
      return out;
    });
    done(
      tally(
        "SQL injection and XSS payloads",
        s,
        ms,
        "Payload signatures are the WAF's job (OWASP CRS, optional in the container). Shield's behaviour engine alone only reacts once the attempts pile up.",
      ),
    );
  }
  // 4. Honeypots, then the canary key, then an ordinary request from the same client.
  if (want("honeypot")) {
    const [s, ms] = await timed(async () => [
      await send("GET", "/.env"),
      await send("GET", "/.git/config"),
      await send("GET", "/wp-login.php"),
      await send("GET", "/api/health", { authorization: "Bearer qsk_canary_demo_9b1c" }),
      await send("GET", "/api/health"),
    ]);
    done(
      tally(
        "Honeypots, canary key, then a normal request",
        s,
        ms,
        "Behind Shield the honeypot answers are slow, plain 404s and the client is blocked afterwards.",
      ),
    );
  }
  // 5. A crawler taking everything at speed.
  if (want("crawler")) {
    const [s, ms] = await timed(async () => {
      const out: number[] = [];
      for (let i = 0; i < 150; i++)
        out.push(
          await send("GET", `/api/health?page=${i}`, {
            "user-agent":
              "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
          }),
        );
      return out;
    });
    done(tally("AI crawler (GPTBot UA, 150 pages, no pause)", s, ms));
  }
  agent.destroy();
  return results;
}

/** What an eavesdropper faces on the wire. */
export async function tlsCheck(
  target: Target,
): Promise<{ encrypted: boolean; protocol?: string; group?: string; note: string }> {
  await assertAllowedTarget(target.url);
  const u = new URL(target.url);
  if (u.protocol !== "https:")
    return {
      encrypted: false,
      note: "Plain HTTP: anyone on the path can read and change every byte.",
    };
  return new Promise((resolve) => {
    const s = tls.connect(
      {
        host: u.hostname,
        port: Number(u.port || 443),
        servername: target.servername ?? u.hostname,
        rejectUnauthorized: false,
        ecdhCurve: "X25519MLKEM768:X25519",
      },
      () => {
        const group = (s.getEphemeralKeyInfo() as { name?: string } | null)?.name;
        const protocol = s.getProtocol() ?? undefined;
        s.end();
        resolve({
          encrypted: true,
          ...(protocol ? { protocol } : {}),
          ...(group ? { group } : {}),
          note:
            group === "X25519MLKEM768"
              ? "TLS 1.3 with a hybrid post-quantum key exchange: a recording made today stays sealed against a future quantum computer."
              : "Encrypted, but with a classical key exchange only.",
        });
      },
    );
    s.on("error", (e) => resolve({ encrypted: false, note: `TLS failed: ${e.message}` }));
  });
}
