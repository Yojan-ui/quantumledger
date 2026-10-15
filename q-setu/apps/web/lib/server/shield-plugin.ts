import "server-only";
/**
 * "Shield plugs in": the real Scan → Install → Fix → Verify sequence the signature scene is driven by,
 * on this server's loopback interface, against the bundled legacy bank. Each step emits one event as it
 * completes; the scene plays the beat when its event arrives.
 *
 * What is real: every TLS handshake (native OpenSSL), every scan (the readiness scanner on the TLS that
 * was actually negotiated), every header check (a real response), Shield Edge or the Shield middleware
 * in front of the bank, the ML-DSA-65 signature on the report.
 * What is simulated, and labelled "(sim)": the site's address (a reserved .example name on loopback),
 * the DNS change and the container (the same edge runs in-process), and the harvester (it counts the
 * handshakes it could have recorded; nothing is stored).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import tls from "node:tls";
import { bytesToBase64, getSig, scan } from "@qsetu/core";
import { createLegacyApp } from "@qsetu/legacy-bank";
import { shield } from "@qsetu/shield";
import {
  CertStore,
  edgeDefence,
  PQ_GROUPS,
  runSuite,
  selfSignedCert,
  startEdge,
  type AttackResult,
  type Edge,
} from "@qsetu/shield-edge";
import { connectForTest, describeTls, HYBRID_GROUP } from "@/lib/live/tls";
import { checkHeaders, edgeScore, type Checks } from "@/lib/shield-score";
import { DATA_DIR } from "./runtime";

/** Express middleware, as the legacy bank's `use` option takes it. */
type RequestHandler = NonNullable<
  NonNullable<Parameters<typeof createLegacyApp>[1]>["use"]
>[number];

/** The demo site's name: a reserved example domain, served on loopback. */
export const DEMO_DOMAIN = "ledgerwood-bank.example";
export type InstallMode = "dns" | "container" | "code";

export interface Measured {
  protocol: string | null;
  group: string;
  hybridPq: boolean;
  certKey: string;
  /** The readiness scanner's score for the negotiated TLS. */
  transport: number;
  checks: Checks;
  score: number;
}

export type PluginEvent =
  | { t: "start"; domain: string; mode: InstallMode; sim: string[] }
  | { t: "scan"; before: Measured }
  | { t: "visit"; n: number; group: string; ms: number; quantumSafe: boolean }
  | { t: "install"; mode: InstallMode; artifact: string; note: string }
  | { t: "handshake"; group: string; protocol: string | null; ms: number; quantumSafe: boolean }
  | { t: "fix"; id: keyof Checks; ok: boolean; partial?: boolean; seen?: string }
  | { t: "rescan"; after: Measured }
  | { t: "report"; url: string; signedAt: string }
  | { t: "done"; ms: number }
  | { t: "error"; message: string };

const ARTIFACT: Record<InstallMode, string> = {
  dns: `${DEMO_DOMAIN}.  300  IN  CNAME  edge.quantumledger.app.`,
  container: "docker run -d -p 443:443 -e SHIELD_ORIGIN=http://bank:4000 quantumledger/shield-edge",
  code: "app.use(shield({ siteKey: process.env.QSETU_SITE_KEY }))",
};
const NOTE: Record<InstallMode, string> = {
  dns: "(sim) the CNAME is shown, not published: the edge runs on this server's loopback.",
  container: "(sim) no container runtime here: the same edge runs in-process.",
  code: "One line in the bank's app. It adds the defence and the headers; your TLS stays as it is. Post-quantum TLS needs the DNS or container route.",
};

// ── the pieces ──────────────────────────────────────────────────────────────────────────────

function listen(server: http.Server | https.Server): Promise<number> {
  return new Promise((r) =>
    server.listen(0, "127.0.0.1", () => r((server.address() as { port: number }).port)),
  );
}

/** A fresh copy of the bank on a private port, optionally with middleware in front of its routes. */
async function bank(use: RequestHandler[] = []): Promise<{ url: string; close: () => void }> {
  const server = http.createServer(createLegacyApp(() => {}, { use }));
  const port = await listen(server);
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

/**
 * The site as it is today: a classical TLS terminator (X25519 or P-256 only, TLS 1.2 allowed, an
 * ECDSA certificate) proxying to the bank and passing its headers through, as most sites do.
 */
async function classicalFront(origin: string): Promise<{ port: number; close: () => void }> {
  const pair = selfSignedCert([DEMO_DOMAIN], 1);
  const o = new URL(origin);
  const server = https.createServer(
    { key: pair.key, cert: pair.cert, ecdhCurve: "X25519:P-256", minVersion: "TLSv1.2" },
    (req, res) => {
      const up = http.request(
        {
          host: o.hostname,
          port: o.port,
          path: req.url,
          method: req.method,
          // As any TLS terminator does: the app behind it learns the visitor came over HTTPS.
          headers: { ...req.headers, "x-forwarded-proto": "https" },
        },
        (ores) => {
          res.writeHead(ores.statusCode ?? 502, ores.headers);
          ores.pipe(res);
        },
      );
      up.on("error", () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(up);
    },
  );
  const port = await listen(server);
  return { port, close: () => server.close() };
}

/** Shield Edge in front of `origin`: hybrid PQ key exchange, TLS 1.3 only, hardened headers. */
async function shieldEdge(origin: string, dir: string): Promise<Edge> {
  const pair = selfSignedCert([DEMO_DOMAIN], 1);
  const certs = new CertStore(dir, randomBytes(32).toString("base64"), {
    ecdhCurve: PQ_GROUPS,
    minVersion: "TLSv1.3",
  });
  certs.put(DEMO_DOMAIN, pair);
  return startEdge({
    port: 0,
    host: "127.0.0.1",
    origin,
    certs,
    fallbackCert: pair,
    minVersion: "TLSv1.3",
    harden: true,
  });
}

/** Does the server still accept TLS 1.2? */
function accepts12(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = tls.connect(
      {
        host: "127.0.0.1",
        port,
        servername: DEMO_DOMAIN,
        maxVersion: "TLSv1.2",
        rejectUnauthorized: false,
      },
      () => {
        s.end();
        resolve(true);
      },
    );
    s.on("error", () => resolve(false));
  });
}

function headersOf(port: number): Promise<Record<string, string | undefined>> {
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          host: "127.0.0.1",
          port,
          path: "/",
          servername: DEMO_DOMAIN,
          headers: { host: DEMO_DOMAIN },
          rejectUnauthorized: false,
          agent: false,
        },
        (res) => {
          res.resume();
          const out: Record<string, string | undefined> = {};
          for (const [k, v] of Object.entries(res.headers))
            out[k] = Array.isArray(v) ? v.join(", ") : v;
          resolve(out);
        },
      )
      .on("error", reject);
  });
}

/** One visitor: a fresh TLS connection offering the hybrid group, and the page. */
function visit(port: number): Promise<{ group: string; ms: number }> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const s = tls.connect(
      {
        host: "127.0.0.1",
        port,
        servername: DEMO_DOMAIN,
        ecdhCurve: `${HYBRID_GROUP}:X25519:P-256`,
        rejectUnauthorized: false,
      },
      () => {
        const ms = performance.now() - t0;
        const group = (s.getEphemeralKeyInfo() as { name?: string } | null)?.name ?? "unknown";
        s.end();
        resolve({ group, ms: +ms.toFixed(2) });
      },
    );
    s.on("error", reject);
  });
}

/** Scan: the TLS the scanner negotiates, the readiness scanner's score for it, and the headers. */
async function measure(port: number): Promise<Measured> {
  const raw = await connectForTest("127.0.0.1", DEMO_DOMAIN, Date.now() + 5000, port);
  const probe = describeTls(DEMO_DOMAIN, "127.0.0.1", raw);
  const transport = scan(probe.report, DEMO_DOMAIN).score;
  const checks = checkHeaders(await headersOf(port), await accepts12(port));
  return {
    protocol: probe.protocol,
    group: probe.group,
    hybridPq: probe.hybridPq,
    certKey: probe.certKey,
    transport,
    checks,
    score: edgeScore(transport, checks),
  };
}

// ── the signed report ───────────────────────────────────────────────────────────────────────

export interface QuantumReadyReport {
  domain: string;
  mode: InstallMode;
  before: Measured;
  after: Measured;
  signedAt: string;
  /** What was simulated in this run. */
  sim: string[];
}
export interface SignedReport {
  report: QuantumReadyReport;
  alg: "ML-DSA-65";
  publicKey: string;
  signature: string;
}

const sig = () => getSig("ml-dsa-65");
const keyFile = () => join(DATA_DIR, "verified", "report-key.json");

/** The report signing key: created once, kept in the data directory (mode 600). */
function reportKey(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  try {
    const k = JSON.parse(readFileSync(keyFile(), "utf8")) as { pk: string; sk: string };
    return { publicKey: Buffer.from(k.pk, "base64"), secretKey: Buffer.from(k.sk, "base64") };
  } catch {
    const kp = sig().keygen();
    mkdirSync(join(DATA_DIR, "verified"), { recursive: true });
    writeFileSync(
      keyFile(),
      JSON.stringify({ pk: bytesToBase64(kp.publicKey), sk: bytesToBase64(kp.secretKey) }),
      { mode: 0o600 },
    );
    return kp;
  }
}

const reportFile = (domain: string) =>
  join(DATA_DIR, "verified", `${domain.replace(/[^a-z0-9.-]/gi, "_")}.json`);

/** The canonical bytes that are signed: the report as JSON with sorted keys. */
export function canonical(r: QuantumReadyReport): Uint8Array {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sort((v as Record<string, unknown>)[k])]),
          )
        : v;
  return new TextEncoder().encode(JSON.stringify(sort(r)));
}

function signReport(r: QuantumReadyReport): SignedReport {
  const k = reportKey();
  const signed: SignedReport = {
    report: r,
    alg: "ML-DSA-65",
    publicKey: bytesToBase64(k.publicKey),
    signature: bytesToBase64(sig().sign(canonical(r), k.secretKey)),
  };
  writeFileSync(reportFile(r.domain), JSON.stringify(signed));
  return signed;
}

/** The stored report for a domain, and whether its signature verifies now. */
export function loadReport(domain: string): { signed: SignedReport; valid: boolean } | null {
  try {
    const signed = JSON.parse(readFileSync(reportFile(domain), "utf8")) as SignedReport;
    const valid = sig().verify(
      Buffer.from(signed.signature, "base64"),
      canonical(signed.report),
      Buffer.from(signed.publicKey, "base64"),
    );
    return { signed, valid };
  } catch {
    return null;
  }
}

// ── the run ─────────────────────────────────────────────────────────────────────────────────

const g = globalThis as unknown as { __qsetuPlugin?: boolean };

/** Runs the sequence, calling `emit` as each step completes. Returns "busy" if a run is going. */
export async function runPlugin(
  mode: InstallMode,
  emit: (e: PluginEvent) => void,
): Promise<"busy" | void> {
  if (g.__qsetuPlugin) return "busy";
  g.__qsetuPlugin = true;
  const t0 = performance.now();
  const closers: (() => unknown)[] = [];
  const dir = mkdtempSync(join(tmpdir(), "shield-plugin-"));
  const sim = [`(sim) the site is the bundled demo bank at ${DEMO_DOMAIN}, on loopback`];
  if (mode !== "code") sim.push(NOTE[mode]);
  sim.push("(sim) the harvester counts handshakes it could record; nothing is stored");
  try {
    emit({ t: "start", domain: DEMO_DOMAIN, mode, sim });
    // 1. Scan the site as it is today.
    const plain = await bank();
    closers.push(plain.close);
    const today = await classicalFront(plain.url);
    closers.push(today.close);
    const before = await measure(today.port);
    emit({ t: "scan", before });
    // Visitors arrive; each handshake is one a recorder could keep.
    for (let n = 1; n <= 3; n++) {
      const v = await visit(today.port);
      emit({ t: "visit", n, ...v, quantumSafe: v.group === HYBRID_GROUP });
    }
    // 2. Install.
    emit({ t: "install", mode, artifact: ARTIFACT[mode], note: NOTE[mode] });
    let port: number;
    if (mode === "code") {
      const mw = shield({
        siteKey: randomBytes(32).toString("base64url"),
        mode: "protect",
        reportTo: false,
      }) as unknown as RequestHandler;
      const shielded = await bank([mw]);
      closers.push(shielded.close);
      const front = await classicalFront(shielded.url);
      closers.push(front.close);
      port = front.port;
    } else {
      const edge = await shieldEdge(plain.url, dir);
      closers.push(() => edge.close());
      port = edge.address().port;
    }
    // 3. The next visitor's handshake, through whatever is now in front.
    const first = await visit(port);
    const after = await measure(port);
    emit({
      t: "handshake",
      group: first.group,
      protocol: after.protocol,
      ms: first.ms,
      quantumSafe: first.group === HYBRID_GROUP,
    });
    for (let n = 4; n <= 6; n++) {
      const v = await visit(port);
      emit({ t: "visit", n, ...v, quantumSafe: v.group === HYBRID_GROUP });
    }
    // 4. The fixes, as measured on a real response.
    for (const [id, c] of Object.entries(after.checks) as [keyof Checks, Checks[keyof Checks]][])
      emit({
        t: "fix",
        id,
        ok: c.ok,
        ...(c.partial ? { partial: true } : {}),
        ...(c.seen ? { seen: c.seen } : {}),
      });
    // 5. Verify: the rescan, then the signed report.
    emit({ t: "rescan", after });
    const signedAt = new Date().toISOString();
    signReport({ domain: DEMO_DOMAIN, mode, before, after, signedAt, sim });
    emit({ t: "report", url: `/verified/${DEMO_DOMAIN}`, signedAt });
    emit({ t: "done", ms: Math.round(performance.now() - t0) });
  } catch (e) {
    emit({ t: "error", message: (e as Error).message.slice(0, 200) });
  } finally {
    for (const c of closers.reverse()) {
      try {
        await c();
      } catch {
        /* already closed */
      }
    }
    rmSync(dir, { recursive: true, force: true });
    g.__qsetuPlugin = false;
  }
}

/**
 * Attack it: a scripted agent against a fresh Shield Edge in protect mode in front of the demo bank
 * (the suite refuses any host but loopback). Three of the suite's five attacks, about 13 s: a
 * 1,000-request burst, the honeypots and canary key, and an AI crawler. The route scan is left out
 * here because Shield tarpits it on purpose (about two minutes); /shield/live runs all five.
 */
export const SCENE_ATTACKS = ["burst", "honeypot", "crawler"] as const;
export async function runPluginAttack(): Promise<AttackResult[] | "busy"> {
  if (g.__qsetuPlugin) return "busy";
  g.__qsetuPlugin = true;
  const dir = mkdtempSync(join(tmpdir(), "shield-attack-"));
  const plain = await bank();
  const pair = selfSignedCert([DEMO_DOMAIN], 1);
  const certs = new CertStore(dir, randomBytes(32).toString("base64"), {
    ecdhCurve: PQ_GROUPS,
    minVersion: "TLSv1.2",
  });
  certs.put(DEMO_DOMAIN, pair);
  const fresh = () =>
    edgeDefence({
      mode: "protect",
      secret: randomBytes(32).toString("base64"),
      // The suite's planted key (packages/shield-edge/src/attacks.ts): first touch blocks.
      canaryKeys: ["qsk_canary_demo_9b1c"],
      powBits: 16,
    });
  let defence = fresh();
  const edge = await startEdge({
    port: 0,
    host: "127.0.0.1",
    origin: plain.url,
    certs,
    fallbackCert: pair,
    harden: true,
    guard: (gi) => defence.guard!(gi),
    intercept: {
      path: "/.well-known/qsetu/pow",
      maxBytes: 2048,
      handle: (b, gi) => defence.intercept!.handle(b, gi),
    },
    onResponse: (gi, s) => defence.onResponse!(gi, s),
  });
  try {
    return await runSuite(
      { label: "Shield", url: `https://127.0.0.1:${edge.address().port}`, servername: DEMO_DOMAIN },
      undefined,
      () => {
        defence = fresh();
      },
      SCENE_ATTACKS,
    );
  } finally {
    await edge.close();
    plain.close();
    rmSync(dir, { recursive: true, force: true });
    g.__qsetuPlugin = false;
  }
}
