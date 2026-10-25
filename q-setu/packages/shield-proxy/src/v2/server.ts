/**
 * Shield tunnel v2, server node: accepts one long-lived HTTP/2 connection per client node (h2c: the
 * tunnel's own layer does the encryption), runs the QuantumLedger handshake on it once, then serves
 * each proxied request as one stream, forwarding to the unmodified upstream app over a pooled
 * keep-alive connection. Bodies stream through; nothing is buffered whole or base64-encoded.
 *
 * Put this node's port on a private network or behind a firewall: like v1, the tunnel authenticates
 * the server to the client (ML-DSA, pinned), not the client to the server.
 */
import http from "node:http";
import http2 from "node:http2";
import { x25519 } from "@noble/curves/ed25519.js";
import {
  bytesToBase64,
  codec,
  serverComplete,
  serverRespond,
  type Identity,
  type ServerPending,
} from "@qsetu/core";
import { cleanHeaders } from "../tunnel";
import { newStreamNonce, Opener, preamble, Sealer, streamKey } from "./frames";
import { keysFromBase, resumedBase, TicketKeys, type TunnelKeys } from "./keys";

export interface TunnelServerOptions {
  upstream: string;
  listen: number;
  host?: string;
  identity: Identity;
  /**
   * Serve the public key at /qsetu/identity so a demo client can fetch it. Off by default: real
   * clients pin the key from configuration (SHIELD_PEER_KEY). Fetching it over the same channel is
   * trust-on-first-use, which an attacker in the middle defeats.
   */
  demoIdentity?: boolean;
  log?: (line: string) => void;
}

const PENDING_TTL_MS = 30_000;
const MAX_PENDING = 1000;
const MAX_SESSIONS = 10_000;
const MAX_HANDSHAKE_BODY = 64 * 1024;

export interface RequestHead {
  method: string;
  path: string;
  headers: Record<string, string>;
}
export interface ResponseHead {
  status: number;
  headers: Record<string, string>;
}

const readBody = (s: http2.ServerHttp2Stream) =>
  new Promise<Buffer>((resolve, reject) => {
    const parts: Buffer[] = [];
    let n = 0;
    s.on("data", (c: Buffer) => {
      n += c.length;
      if (n > MAX_HANDSHAKE_BODY) {
        s.close(http2.constants.NGHTTP2_REFUSED_STREAM);
        reject(new Error("too large"));
      } else parts.push(c);
    });
    s.on("end", () => resolve(Buffer.concat(parts)));
    s.on("error", reject);
  });

export async function startTunnelServer(opts: TunnelServerOptions) {
  const log = opts.log ?? console.log;
  const upstream = new URL(opts.upstream);
  const agent = new http.Agent({ keepAlive: true, maxSockets: 256, maxFreeSockets: 64 });
  const pending = new Map<string, { p: ServerPending; at: number }>();
  const sessions = new Map<string, TunnelKeys>();
  const tickets = new TicketKeys();
  const stats = { handshakes: 0, resumptions: 0, streams: 0, rejected: 0 };

  const remember = (k: TunnelKeys) => {
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
    sessions.set(k.sid, k);
  };
  const json = (s: http2.ServerHttp2Stream, status: number, v: unknown) => {
    s.respond({ ":status": status, "content-type": "application/json" });
    s.end(JSON.stringify(v));
  };

  if (opts.demoIdentity)
    log(
      "[shield-server] WARNING: demo mode serves the identity key at /qsetu/identity. Clients that fetch it there trust whoever answers first. Pin SHIELD_PEER_KEY in production.",
    );

  const server = http2.createServer({ settings: { maxConcurrentStreams: 256 } });
  server.on("stream", (s, h) => {
    const path = h[":path"] ?? "";
    const method = h[":method"];
    void (async () => {
      try {
        if (method === "GET" && path === "/healthz")
          return json(s, 200, { ok: true, role: "shield-server", v: 2 });
        if (method === "GET" && path === "/qsetu/identity" && opts.demoIdentity)
          return json(s, 200, {
            profile: opts.identity.profile,
            publicKey: bytesToBase64(opts.identity.publicKey),
            demo: true,
          });
        if (method !== "POST") return json(s, 404, { error: "not found" });

        if (path === "/qsetu/v2/hello") {
          const hello = codec.clientHello.fromJSON(JSON.parse((await readBody(s)).toString()));
          const { serverHello, pending: p } = serverRespond(hello, opts.identity);
          const now = Date.now();
          for (const [k, v] of pending) if (now - v.at > PENDING_TTL_MS) pending.delete(k);
          if (pending.size >= MAX_PENDING) return json(s, 503, { error: "busy" });
          pending.set(Buffer.from(serverHello.sessionId).toString("hex"), { p, at: now });
          return json(s, 200, codec.serverHello.toJSON(serverHello));
        }
        if (path === "/qsetu/v2/finish") {
          const finish = codec.clientFinish.fromJSON(JSON.parse((await readBody(s)).toString()));
          const sid = Buffer.from(finish.sessionId).toString("hex");
          const p = pending.get(sid);
          pending.delete(sid);
          if (!p) return json(s, 400, { error: "unknown handshake" });
          const session = serverComplete(p.p, finish);
          const k = keysFromBase(
            sid,
            "server",
            Buffer.from(session.exportKey("tunnel-v2/c2s")),
            Buffer.from(session.exportKey("tunnel-v2/s2c")),
            Buffer.from(session.exportKey("tunnel-v2/resumption")),
          );
          remember(k);
          stats.handshakes++;
          return json(s, 200, { ok: true, ticket: tickets.seal(k.resumption).toString("base64") });
        }
        if (path === "/qsetu/v2/resume") {
          const body = JSON.parse((await readBody(s)).toString()) as {
            ticket: string;
            x25519: string;
            random: string;
          };
          const psk = tickets.open(Buffer.from(body.ticket, "base64"));
          const clientShare = Buffer.from(body.x25519, "base64");
          const clientRandom = Buffer.from(body.random, "base64");
          if (!psk || clientShare.length !== 32 || clientRandom.length !== 32)
            return json(s, 401, { error: "resume refused" });
          const eph = x25519.keygen();
          const sidBytes = newStreamNonce();
          const sid = sidBytes.toString("hex");
          const transcript = Buffer.concat([
            clientRandom,
            clientShare,
            Buffer.from(eph.publicKey),
            sidBytes,
          ]);
          const base = resumedBase(
            psk,
            x25519.getSharedSecret(eph.secretKey, clientShare),
            transcript,
          );
          eph.secretKey.fill(0);
          remember(keysFromBase(sid, "server", base.c2s, base.s2c, base.resumption));
          stats.resumptions++;
          return json(s, 200, {
            sid,
            x25519: Buffer.from(eph.publicKey).toString("base64"),
            confirm: base.confirm.toString("base64"),
            ticket: tickets.seal(base.resumption).toString("base64"),
          });
        }
        if (path === "/qsetu/v2/x") {
          const k = sessions.get(String(h["qsetu-sid"] ?? ""));
          if (!k) return json(s, 401, { error: "unknown session" });
          stats.streams++;
          return proxy(s, k);
        }
        return json(s, 404, { error: "not found" });
      } catch (e) {
        stats.rejected++;
        log(`[shield-server] rejected: ${(e as Error).message}`);
        if (!s.headersSent && !s.destroyed) json(s, 400, { error: "rejected" });
        else s.close(http2.constants.NGHTTP2_CANCEL);
      }
    })();
  });

  function proxy(s: http2.ServerHttp2Stream, k: TunnelKeys) {
    let nonce: Buffer | undefined;
    const opener = new Opener("c2s", (n, epoch) => {
      nonce = n;
      const ek = k.recv.keyFor(epoch);
      return ek && streamKey(ek, n, "c2s");
    });
    const abort = (why: string) => {
      stats.rejected++;
      log(`[shield-server] stream rejected: ${why}`);
      if (!s.destroyed) s.close(http2.constants.NGHTTP2_CANCEL);
    };
    opener.on("error", (e) => abort(e.message));
    s.on("error", () => opener.destroy());
    opener.once("head", (head: RequestHead) => {
      if (
        typeof head?.path !== "string" ||
        !head.path.startsWith("/") ||
        typeof head.method !== "string"
      )
        return abort("bad request head");
      const up = http.request({
        agent,
        protocol: upstream.protocol,
        hostname: upstream.hostname,
        port: upstream.port || 80,
        method: head.method,
        path: head.path,
        headers: { ...head.headers, host: upstream.host },
      });
      up.on("error", () => respondWith(502, {}, "Bad gateway\n"));
      up.on("response", (ores) => {
        const { epoch, key } = k.send.next();
        const sealer = new Sealer(streamKey(key, nonce!, "s2c"), "s2c", preamble(nonce!, epoch));
        s.respond({ ":status": 200, "content-type": "application/octet-stream" });
        sealer.head({
          status: ores.statusCode ?? 502,
          headers: cleanHeaders(ores.headers),
        } satisfies ResponseHead);
        sealer.pipe(s);
        ores.pipe(sealer);
      });
      opener.pipe(up);
      function respondWith(status: number, headers: Record<string, string>, body: string) {
        if (s.headersSent) return void s.close(http2.constants.NGHTTP2_CANCEL);
        const { epoch, key } = k.send.next();
        const sealer = new Sealer(streamKey(key, nonce!, "s2c"), "s2c", preamble(nonce!, epoch));
        s.respond({ ":status": 200, "content-type": "application/octet-stream" });
        sealer.head({ status, headers } satisfies ResponseHead);
        sealer.pipe(s);
        sealer.end(Buffer.from(body));
      }
    });
    s.pipe(opener);
  }

  await new Promise<void>((r) => server.listen(opts.listen, opts.host ?? "127.0.0.1", r));
  log(
    `[shield-server] v2 :${opts.listen} → ${upstream.origin} · identity ${bytesToBase64(opts.identity.publicKey).slice(0, 12)}… (ML-DSA public key)`,
  );
  return {
    server,
    stats,
    port: () => (server.address() as { port: number }).port,
    close: () =>
      new Promise<void>((r) => {
        tickets.stop();
        agent.destroy();
        server.close(() => r());
        setTimeout(r, 500).unref();
      }),
  };
}
