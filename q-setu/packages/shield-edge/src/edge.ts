/**
 * Shield Edge: a reverse proxy that terminates TLS with a hybrid post-quantum key exchange
 * (X25519MLKEM768, falling back to X25519 for clients that don't offer it) and forwards to the
 * customer's origin over a pooled keep-alive connection. Bodies stream in both directions; nothing
 * is buffered or re-encoded. It is native OpenSSL (3.5+) via Node's TLS, not JavaScript crypto.
 *
 *   client ──TLS 1.3, X25519MLKEM768──▶ edge ──keep-alive HTTP or TLS──▶ origin
 *
 * Each TCP connection's first TLS record (the ClientHello) is read before Node's TLS server sees it,
 * to record which key exchange the connection will use and its JA4 fingerprint (see hello.ts).
 *
 * What it does not do: certificates stay classical (ECDSA), because browsers don't accept
 * post-quantum ones yet; the hop to the origin is only as strong as that hop's own TLS (use https://
 * to a PQ-capable origin, or keep the origin on the same private network).
 */
import { randomBytes } from "node:crypto";
import http, { type IncomingHttpHeaders, type OutgoingHttpHeaders } from "node:http";
import http2 from "node:http2";
import https from "node:https";
import net from "node:net";
import { createSecureContext, type TLSSocket } from "node:tls";
import { type CertPair, CertStore } from "./certs";
import { type ClientHello, ja4, negotiatedGroup, parseClientHello, recordLength } from "./hello";
import { EdgeMetrics, type KxClass } from "./metrics";

/**
 * OpenSSL 3.5 group tuples ("/" separates tuples, in order of preference): X25519MLKEM768 whenever
 * the client supports it, else X25519 or P-256 (old clients without X25519).
 */
export const PQ_GROUPS = "X25519MLKEM768/X25519:P-256";
export const TICKET_ROTATE_MS = 12 * 60 * 60 * 1000;
const HELLO_TIMEOUT_MS = 5_000;
const HELLO_MAX_BYTES = 16 * 1024 + 5;

/** What the edge knows about a connection, from its ClientHello. */
export interface ConnInfo {
  kx: KxClass;
  ja4?: string;
  sni?: string;
  hello?: ClientHello;
}

/** A request as the defence engine (C2) sees it, before it's forwarded. */
export interface GuardInput {
  ip: string;
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  conn: ConnInfo;
  httpVersion: string;
}
export type GuardVerdict =
  | { action: "allow"; headers?: Record<string, string> }
  | {
      action: "respond";
      status: number;
      headers?: Record<string, string>;
      body?: string;
      delayMs?: number;
    };

export interface EdgeOptions {
  /** Public TLS port. */
  port: number;
  host?: string;
  /** e.g. http://127.0.0.1:4000 (same private network) or https://origin.internal */
  origin: string;
  /**
   * Several sites on one edge: domain → origin. A request goes to the origin of the name it asked
   * for in TLS (SNI), and its Host header must be that same name, else 421 Misdirected Request: one
   * site's visitors can never be steered to another site's origin (domain fronting).
   */
  routes?: Record<string, string>;
  certs: CertStore;
  /** Served when the client sends no SNI or an unknown name. */
  fallbackCert?: CertPair;
  groups?: string;
  /** Lowest TLS version accepted. Default TLS 1.2 (classical only; 1.3 gets the hybrid group). */
  minVersion?: "TLSv1.2" | "TLSv1.3";
  ticketRotateMs?: number;
  /** Extra TLS options for an https:// origin (a private CA, a pinned name). */
  originTls?: { ca?: string | Buffer; servername?: string; rejectUnauthorized?: boolean };
  /** Max sockets kept open to the origin. */
  originSockets?: number;
  /** The defence engine hook; absent = allow everything. */
  guard?: (req: GuardInput) => GuardVerdict | Promise<GuardVerdict>;
  /** A small POST the edge answers itself (the challenge endpoint), body capped at `maxBytes`. */
  intercept?: {
    path: string;
    maxBytes: number;
    handle(
      body: string,
      req: GuardInput,
    ): { status: number; headers: Record<string, string>; body: string };
  };
  /** Told every response's status (the engine's error-ratio signal, and its in-flight count). */
  onResponse?: (req: GuardInput, status: number) => void;
  /** Called with one line of structured JSON per notable event. Never receives key material. */
  log?: (event: Record<string, unknown>) => void;
  /**
   * Security headers added to every proxied response the origin didn't set itself: `true` for
   * HARDENED_HEADERS, or your own map. Absent = the edge adds nothing (it still strips Server and
   * X-Powered-By).
   */
  harden?: boolean | Record<string, string>;
}

/**
 * The edge's hardening preset. Everything here is safe to enforce on a site the edge knows nothing
 * about, except a full content policy: that one ships Report-Only, so it reports what it would block
 * without breaking a page, until the site owner switches it on.
 */
export const HARDENED_HEADERS: Readonly<Record<string, string>> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "frame-ancestors 'none'",
  "content-security-policy-report-only":
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'",
};

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
  "http2-settings",
  "host",
]);

/** The origin must not see spoofed forwarding headers from the client: the edge sets its own. */
const CLIENT_SET_STRIPPED = new Set([
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
  "x-real-ip",
  "forwarded",
  "x-qsetu-kx",
  "x-qsetu-ja4",
]);

function requestHeaders(h: IncomingHttpHeaders): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = {};
  const named = new Set(
    String(h.connection ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase()),
  );
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined || k.startsWith(":") || HOP_BY_HOP.has(k) || named.has(k)) continue;
    if (CLIENT_SET_STRIPPED.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Response headers that would reveal the stack, and hop-by-hop ones HTTP/2 forbids. */
const RESPONSE_STRIPPED = new Set([...HOP_BY_HOP, "server", "x-powered-by", "x-aspnet-version"]);

function responseHeaders(
  h: IncomingHttpHeaders,
  add?: Readonly<Record<string, string>>,
): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = {};
  // The origin's own value wins: the edge only fills in what is missing.
  for (const [k, v] of Object.entries(add ?? {})) if (h[k] === undefined) out[k] = v;
  const named = new Set(
    String(h.connection ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase()),
  );
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined || RESPONSE_STRIPPED.has(k) || named.has(k)) continue;
    out[k] = v;
  }
  return out;
}

const connInfo = new WeakMap<net.Socket, ConnInfo>();
/** The raw TCP socket under a TLS socket (Node keeps it as `_parent`). */
const rawOf = (s: unknown) => (s as { _parent?: net.Socket })._parent;
const infoOf = (s: unknown): ConnInfo => {
  const raw = rawOf(s);
  return (raw && connInfo.get(raw)) ?? { kx: "unknown" };
};

/** Startup check: this Node's OpenSSL must know the hybrid group. Throws with a clear reason if not. */
export function assertPqSupport(groups = PQ_GROUPS): { openssl: string } {
  const openssl = process.versions.openssl ?? "unknown";
  const [maj = 0, min = 0] = openssl.split(".").map(Number);
  if (maj < 3 || (maj === 3 && min < 5))
    throw new Error(
      `Shield Edge needs OpenSSL 3.5 or newer for X25519MLKEM768; this Node has ${openssl}`,
    );
  try {
    // createSecureContext throws if any named group is unknown to this OpenSSL.
    createSecureContext({ ecdhCurve: groups });
  } catch {
    throw new Error(`This OpenSSL (${openssl}) rejects the groups "${groups}"`);
  }
  return { openssl };
}

export interface Edge {
  server: net.Server;
  metrics: EdgeMetrics;
  /** Rotates the session-ticket key now (it also rotates every 12 h by itself). */
  rotateTickets(): void;
  close(): Promise<void>;
  address(): net.AddressInfo;
}

export async function startEdge(opts: EdgeOptions): Promise<Edge> {
  const harden = opts.harden === true ? HARDENED_HEADERS : opts.harden || undefined;
  const groups = opts.groups ?? PQ_GROUPS;
  const minVersion = opts.minVersion ?? "TLSv1.2";
  const log = opts.log ?? (() => {});
  const metrics = new EdgeMetrics();
  const agentOpts = {
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets: opts.originSockets ?? 256,
    maxFreeSockets: 64,
    scheduling: "lifo" as const,
  };
  /** One pooled connection set per origin, never shared between sites. */
  interface Upstream {
    url: URL;
    https: boolean;
    agent: http.Agent;
    request: typeof http.request;
  }
  const upstreams = new Map<string, Upstream>();
  const upstream = (u: string): Upstream => {
    let x = upstreams.get(u);
    if (!x) {
      const url = new URL(u);
      const secure = url.protocol === "https:";
      x = {
        url,
        https: secure,
        agent: secure
          ? new https.Agent({ ...agentOpts, ...opts.originTls })
          : new http.Agent(agentOpts),
        request: secure ? https.request : http.request,
      };
      upstreams.set(u, x);
    }
    return x;
  };
  const routes = opts.routes
    ? new Map(Object.entries(opts.routes).map(([d, u]) => [d.toLowerCase(), u]))
    : undefined;

  const tlsServer = http2.createSecureServer({
    allowHTTP1: true,
    ...(opts.fallbackCert ?? {}),
    ecdhCurve: groups,
    minVersion,
    honorCipherOrder: true,
    // AES-GCM first; ChaCha20 stays for phones without AES instructions.
    ciphers:
      "TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256",
    sessionTimeout: TICKET_ROTATE_MS / 1000,
    SNICallback: (name, cb) => {
      try {
        cb(null, opts.certs.lookup(name));
      } catch (e) {
        log({ ev: "sni_error", name, error: (e as Error).message });
        cb(null, undefined);
      }
    },
    settings: { maxConcurrentStreams: 128 },
    maxSessionMemory: 16,
  });

  // Session tickets: one key, rotated every 12 h, applied to the default context and every
  // per-domain one (each SecureContext has its own ticket keys).
  let ticketKey = randomBytes(48);
  const applyTickets = () => {
    tlsServer.setTicketKeys(ticketKey);
    opts.certs.setTicketKeys(ticketKey);
  };
  const rotateTickets = () => {
    ticketKey = randomBytes(48);
    applyTickets();
  };
  applyTickets();
  const rot = setInterval(rotateTickets, opts.ticketRotateMs ?? TICKET_ROTATE_MS);
  rot.unref();

  tlsServer.on("secureConnection", (s: TLSSocket) => {
    metrics.handshakes++;
    if (s.isSessionReused()) metrics.resumed++;
    metrics.connection(infoOf(s).kx);
  });
  tlsServer.on("tlsClientError", () => {
    metrics.tlsErrors++;
  });

  const handle = async (
    req: http.IncomingMessage | http2.Http2ServerRequest,
    res2: http.ServerResponse | http2.Http2ServerResponse,
  ) => {
    // Both response kinds share writeHead/end/destroy; TypeScript can't call a union of overloads.
    const res = res2 as http.ServerResponse;
    const t0 = performance.now();
    const conn = infoOf(req.socket);
    const ip = req.socket.remoteAddress ?? "";
    const path = req.url ?? "/";
    const host =
      (req as http2.Http2ServerRequest).authority ?? (req.headers.host as string | undefined) ?? "";
    const input: GuardInput = {
      ip,
      method: req.method ?? "GET",
      path,
      headers: req.headers,
      conn,
      httpVersion: req.httpVersion,
    };
    const done = (status: number) => {
      metrics.request(status, performance.now() - t0);
      opts.onResponse?.(input, status);
    };
    const ic = opts.intercept;
    if (ic && input.method === "POST" && path.split("?")[0] === ic.path) {
      let body = "";
      let tooBig = false;
      for await (const chunk of req as AsyncIterable<Buffer>) {
        body += chunk.toString();
        if (body.length > ic.maxBytes) {
          tooBig = true;
          break;
        }
      }
      const r = tooBig
        ? {
            status: 413,
            headers: { "content-type": "text/plain; charset=utf-8" },
            body: "Too large\n",
          }
        : ic.handle(body, input);
      res.writeHead(r.status, r.headers);
      res.end(r.body);
      return done(r.status);
    }
    if (opts.guard) {
      let v: GuardVerdict;
      try {
        v = await opts.guard(input);
      } catch (e) {
        // The engine failing must not take the site down: allow, and say so.
        log({ ev: "guard_error", error: (e as Error).message });
        v = { action: "allow" };
      }
      if (v.action === "respond") {
        if (v.delayMs) await new Promise((r) => setTimeout(r, v.delayMs));
        if (!res.headersSent && !res.destroyed) {
          res.writeHead(v.status, { "content-type": "text/plain; charset=utf-8", ...v.headers });
          res.end(v.body ?? "");
        }
        req.resume();
        return done(v.status);
      }
    }
    let target = opts.origin;
    if (routes) {
      const sni = conn.sni?.toLowerCase();
      const asked = host.replace(/:\d+$/, "").toLowerCase();
      const routed = sni ? routes.get(sni) : undefined;
      if (!routed || asked !== sni) {
        res.writeHead(421, { "content-type": "text/plain; charset=utf-8" });
        res.end("Misdirected request\n");
        req.resume();
        return done(421);
      }
      target = routed;
    }
    const { url: origin, https: originHttps, agent, request } = upstream(target);
    // The client's own X-Forwarded-For was dropped: only the edge's view of the IP counts.
    const headers = requestHeaders(req.headers);
    headers["x-forwarded-for"] = ip;
    headers["x-forwarded-proto"] = "https";
    headers["x-forwarded-host"] = host;
    headers["x-qsetu-kx"] = conn.kx;
    if (conn.ja4) headers["x-qsetu-ja4"] = conn.ja4;
    headers.host = originHttps ? (opts.originTls?.servername ?? origin.host) : host || origin.host;

    const up = request({
      agent,
      protocol: origin.protocol,
      hostname: origin.hostname,
      port: origin.port || (originHttps ? 443 : 80),
      method: req.method,
      path,
      headers,
    });
    let settled = false;
    const fail = (status: number) => {
      if (settled) return;
      settled = true;
      metrics.originErrors++;
      if (!res.headersSent) {
        res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
        res.end(status === 504 ? "Gateway timeout\n" : "Bad gateway\n");
      } else res.destroy();
      done(status);
    };
    up.setTimeout(60_000, () => {
      up.destroy();
      fail(504);
    });
    up.on("error", () => fail(502));
    up.on("response", (ores) => {
      if (settled) return;
      settled = true;
      const status = ores.statusCode ?? 502;
      res.writeHead(status, responseHeaders(ores.headers, harden));
      done(status);
      ores.pipe(res as NodeJS.WritableStream);
      ores.on("error", () => res.destroy());
    });
    req.on("aborted", () => up.destroy());
    (req as NodeJS.ReadableStream).pipe(up);
  };
  tlsServer.on("request", (req, res) => void handle(req, res));

  // Raw TCP first: read the ClientHello, note what it offers, then hand the socket to TLS.
  const server = net.createServer({ pauseOnConnect: true }, (sock) => {
    metrics.openConnections++;
    sock.once("close", () => metrics.openConnections--);
    sock.setNoDelay(true);
    let buf: Buffer = Buffer.alloc(0);
    const timer = setTimeout(() => sock.destroy(), HELLO_TIMEOUT_MS);
    const onData = (chunk: Buffer) => {
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
      const need = recordLength(buf);
      if (need === 0 && buf.length < 5) return;
      if (need !== undefined && buf.length < need && buf.length < HELLO_MAX_BYTES) return;
      clearTimeout(timer);
      sock.off("data", onData);
      sock.off("error", onErr);
      sock.pause();
      const hello = need === undefined ? undefined : parseClientHello(buf);
      connInfo.set(
        sock,
        hello
          ? {
              kx: negotiatedGroup(hello),
              ja4: ja4(hello),
              ...(hello.sni ? { sni: hello.sni } : {}),
              hello,
            }
          : { kx: "unknown" },
      );
      sock.unshift(buf);
      tlsServer.emit("connection", sock);
    };
    const onErr = () => {
      clearTimeout(timer);
      sock.destroy();
    };
    sock.on("data", onData);
    sock.on("error", onErr);
    sock.resume();
  });
  server.maxConnections = 50_000;

  await new Promise<void>((r) => server.listen(opts.port, opts.host ?? "0.0.0.0", r));
  log({ ev: "edge_listening", port: (server.address() as net.AddressInfo).port, groups });

  return {
    server,
    metrics,
    rotateTickets,
    address: () => server.address() as net.AddressInfo,
    close: () =>
      new Promise<void>((r) => {
        clearInterval(rot);
        for (const u of upstreams.values()) u.agent.destroy();
        tlsServer.close();
        server.close(() => r());
        // Idle keep-alive client sockets would hold close() open.
        setTimeout(r, 1000).unref();
      }),
  };
}
