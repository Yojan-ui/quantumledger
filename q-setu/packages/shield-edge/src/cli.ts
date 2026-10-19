/**
 * `qsetu-edge`: runs Shield Edge from environment variables (the container's entry point).
 *
 *   EDGE_ORIGIN       where to forward, e.g. http://app:3000 or https://origin.internal   (required)
 *   EDGE_ROUTES       several sites: "a.com=http://a:3000,b.com=http://b:3000" (each name only reaches
 *                     its own origin; a Host that disagrees with the TLS name gets 421)
 *   SHIELD_KEK        ≥ 32 chars; encrypts TLS private keys at rest                        (required)
 *   EDGE_DOMAINS      comma-separated names to serve (and get certificates for)
 *   EDGE_PORT         public TLS port (443)
 *   EDGE_HTTP_PORT    plain HTTP: ACME challenges and a redirect to https (80; "off" to disable)
 *   EDGE_ADMIN        metrics and health, e.g. 127.0.0.1:9790 (never expose this publicly)
 *   EDGE_CERT_DIR     encrypted certificate store (/data/certs)
 *   EDGE_CERT_FILE / EDGE_KEY_FILE   bring your own certificate instead of ACME (PEM)
 *   ACME_EMAIL        contact for Let's Encrypt; with EDGE_DOMAINS, certificates are issued and renewed
 *   ACME_DIRECTORY    "production", "staging" (default) or a directory URL
 *   EDGE_MODE         defence engine: off | monitor (default: score and report, never block) | protect | strict
 *   EDGE_HONEYPOTS    comma-separated extra honeypot paths (e.g. /admin if the site has none)
 *   EDGE_TRAP_PATH    the hidden trap link's path
 *   EDGE_CANARY_KEYS  comma-separated canary API keys
 *   EDGE_SITE_KEY     the site key from the dashboard: report events and counts, follow its mode switch
 *   EDGE_REPORT_URL   where to report (default https://quantumledger.app/api/shield/events)
 *
 * The admin address also takes POST /mode?m=off|monitor|protect|strict: the emergency switch.
 */
import { readFileSync } from "node:fs";
import http from "node:http";
import { startAcme } from "./acme";
import { CertStore } from "./certs";
import { hkdfSync } from "node:crypto";
import { DEFAULT_HONEYPOTS, type Mode } from "@qsetu/shield-guard";
import { edgeDefence } from "./defence";
import { assertPqSupport, PQ_GROUPS, startEdge } from "./edge";

const env = process.env;
const log = (e: Record<string, unknown>) =>
  process.stdout.write(`${JSON.stringify({ t: new Date().toISOString(), ...e })}\n`);

function fail(msg: string): never {
  log({ ev: "fatal", msg });
  process.exit(1);
}

const originUrl = env.EDGE_ORIGIN ?? fail("EDGE_ORIGIN is required (e.g. http://app:3000)");
const kek = env.SHIELD_KEK ?? fail("SHIELD_KEK is required (at least 32 random characters)");
const domains = (env.EDGE_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

let support: { openssl: string };
try {
  support = assertPqSupport();
} catch (e) {
  fail((e as Error).message);
}
log({ ev: "pq_support", openssl: support.openssl, groups: PQ_GROUPS });

const certs = new CertStore(env.EDGE_CERT_DIR ?? "/data/certs", kek, {
  ecdhCurve: PQ_GROUPS,
  minVersion: "TLSv1.2",
});
if (env.EDGE_CERT_FILE && env.EDGE_KEY_FILE) {
  const pair = {
    cert: readFileSync(env.EDGE_CERT_FILE, "utf8"),
    key: readFileSync(env.EDGE_KEY_FILE, "utf8"),
  };
  for (const d of domains) certs.put(d, pair);
  log({ ev: "certs_loaded", domains });
}

const MODES: Mode[] = ["off", "monitor", "protect", "strict"];
const queue: object[] = [];
const mode = (env.EDGE_MODE ?? "monitor") as Mode;
if (!MODES.includes(mode)) fail(`EDGE_MODE must be one of ${MODES.join(", ")}`);
const list = (v?: string) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const defence = edgeDefence({
  mode,
  // Its own key, derived from the KEK: signing challenges never touches the certificate keys.
  secret: Buffer.from(hkdfSync("sha256", kek, Buffer.alloc(0), "qsetu-edge/guard", 32)).toString(
    "base64",
  ),
  honeypots: [...DEFAULT_HONEYPOTS, ...list(env.EDGE_HONEYPOTS)],
  ...(env.EDGE_TRAP_PATH ? { trapPath: env.EDGE_TRAP_PATH } : {}),
  canaryKeys: list(env.EDGE_CANARY_KEYS),
  onEvent: (e) => {
    log({ ev: "guard", ...e });
    if (queue.length < 1000) queue.push(e);
  },
});
log({ ev: "guard_mode", mode });

const routes = env.EDGE_ROUTES
  ? Object.fromEntries(
      list(env.EDGE_ROUTES).map((r) => {
        const [d, u] = r.split("=");
        if (!d || !u || !/^https?:\/\//.test(u))
          fail(`EDGE_ROUTES entry "${r}" must be domain=http(s)://origin`);
        return [d.toLowerCase(), u];
      }),
    )
  : undefined;

const edge = await startEdge({
  port: Number(env.EDGE_PORT ?? 443),
  origin: originUrl,
  ...(routes ? { routes } : {}),
  certs,
  log,
  guard: defence.guard,
  intercept: defence.intercept,
  onResponse: defence.onResponse,
});

// ACME challenges and the https redirect on plain HTTP.
const acme =
  env.ACME_EMAIL && domains.length && !env.EDGE_CERT_FILE
    ? startAcme({
        domains,
        email: env.ACME_EMAIL,
        directory: env.ACME_DIRECTORY ?? "staging",
        certs,
        log,
      })
    : undefined;
if (env.EDGE_HTTP_PORT !== "off") {
  http
    .createServer((req, res) => {
      const token = req.url?.match(/^\/\.well-known\/acme-challenge\/([\w-]{16,128})$/)?.[1];
      if (token && acme) {
        const answer = acme.challenge(token);
        if (answer) {
          res.writeHead(200, { "content-type": "text/plain" });
          return res.end(answer);
        }
      }
      const host = (req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
      if (!domains.includes(host)) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(308, { location: `https://${host}${req.url ?? "/"}` });
      res.end();
    })
    .listen(Number(env.EDGE_HTTP_PORT ?? 80));
}

// Reporting to the dashboard: events and connection counts every 10 s; its mode switch every 60 s
// (unless EDGE_MODE pins the mode here).
if (env.EDGE_SITE_KEY) {
  const url = env.EDGE_REPORT_URL ?? "https://quantumledger.app/api/shield/events";
  const auth = { authorization: `Bearer ${env.EDGE_SITE_KEY}` };
  let last = { pq: 0, classical: 0, requests: 0 };
  setInterval(() => {
    const m = edge.metrics.snapshot();
    const now = {
      pq: m.connections.X25519MLKEM768,
      classical: m.connections.X25519 + m.connections.other,
      requests: m.requests,
    };
    const stats = {
      pq: now.pq - last.pq,
      classical: now.classical - last.classical,
      requests: now.requests - last.requests,
    };
    const events = queue.splice(0, 500);
    fetch(url, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ events, stats }),
      signal: AbortSignal.timeout(5000),
    }).then(
      (r) => {
        if (r.ok) last = now;
      },
      () => {},
    );
  }, 10_000).unref();
  if (!env.EDGE_MODE)
    setInterval(() => {
      fetch(url.replace(/\/events$/, "/config"), {
        headers: auth,
        signal: AbortSignal.timeout(3000),
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ mode?: Mode }>) : undefined))
        .then((j) => {
          if (j?.mode && MODES.includes(j.mode) && j.mode !== defence.engine.mode) {
            defence.engine.setMode(j.mode);
            log({ ev: "guard_mode", mode: j.mode, by: "dashboard" });
          }
        })
        .catch(() => {});
    }, 60_000).unref();
}

// Metrics and health on the admin address only.
const [adminHost = "127.0.0.1", adminPort = "9790"] = (env.EDGE_ADMIN ?? "127.0.0.1:9790").split(
  ":",
);
http
  .createServer((req, res) => {
    if (req.url === "/healthz") return res.end("ok\n");
    if (req.url === "/metrics") {
      res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
      return res.end(edge.metrics.prometheus());
    }
    if (req.url === "/stats")
      return res.end(JSON.stringify({ ...edge.metrics.snapshot(), mode: defence.engine.mode }));
    const m =
      req.method === "POST" && req.url?.match(/^\/mode\?m=(off|monitor|protect|strict)$/)?.[1];
    if (m) {
      defence.engine.setMode(m as Mode);
      log({ ev: "guard_mode", mode: m, by: "admin" });
      return res.end(`${m}\n`);
    }
    res.writeHead(404);
    res.end();
  })
  .listen(Number(adminPort), adminHost);

const stop = async () => {
  log({ ev: "shutdown" });
  acme?.stop();
  await edge.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
