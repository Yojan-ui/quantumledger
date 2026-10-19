/**
 * Shield tunnel v2, client node: accepts plain HTTP from local apps and carries each request to the
 * peer Shield as one stream on a single long-lived HTTP/2 connection. The QuantumLedger handshake runs
 * once per connection (or is resumed with a ticket: two X25519 operations instead of ML-KEM and
 * ML-DSA). The peer's ML-DSA key must be pinned (SHIELD_PEER_KEY); there is no fetch-on-first-use.
 */
import { randomBytes } from "node:crypto";
import http from "node:http";
import http2 from "node:http2";
import { x25519 } from "@noble/curves/ed25519.js";
import { base64ToBytes, clientFinish, clientHello, codec } from "@qsetu/core";
import { cleanHeaders } from "../tunnel";
import { newStreamNonce, Opener, preamble, Sealer, streamKey } from "./frames";
import { keysFromBase, resumedBase, type TunnelKeys } from "./keys";
import type { RequestHead, ResponseHead } from "./server";

export interface TunnelClientOptions {
  peer: string;
  listen: number;
  host?: string;
  /** The peer Shield's ML-DSA public key, base64 (pinned). */
  serverKey: string;
  log?: (line: string) => void;
}

interface Conn {
  h2: http2.ClientHttp2Session;
  keys: TunnelKeys;
}

export async function startTunnelClient(opts: TunnelClientOptions) {
  const log = opts.log ?? console.log;
  if (!opts.serverKey)
    throw new Error("SHIELD_PEER_KEY (the peer's pinned ML-DSA public key) is required");
  const serverKey = base64ToBytes(opts.serverKey);
  const stats = { requests: 0, handshakes: 0, resumptions: 0, lastHandshakeMs: 0, failures: 0 };
  let ticket: { value: string; resumption: Buffer } | undefined;
  let conn: Conn | undefined;
  let connecting: Promise<Conn> | undefined;

  const call = (h2: http2.ClientHttp2Session, path: string, body: unknown) =>
    new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
      const s = h2.request({
        ":method": "POST",
        ":path": path,
        "content-type": "application/json",
      });
      let status = 0;
      const parts: Buffer[] = [];
      s.on("response", (h) => (status = Number(h[":status"])));
      s.on("data", (c: Buffer) => parts.push(c));
      s.on("end", () => {
        try {
          resolve({ status, json: JSON.parse(Buffer.concat(parts).toString() || "{}") });
        } catch (e) {
          reject(e);
        }
      });
      s.on("error", reject);
      s.end(JSON.stringify(body));
    });

  async function fullHandshake(h2: http2.ClientHttp2Session): Promise<TunnelKeys> {
    const { hello, state } = clientHello("standard");
    const r1 = await call(h2, "/qsetu/v2/hello", codec.clientHello.toJSON(hello));
    if (r1.status !== 200) throw new Error(`hello refused (${r1.status})`);
    const sh = codec.serverHello.fromJSON(r1.json as never);
    // Verifies the ML-DSA signature against the pinned key; throws on any mismatch.
    const { finish, session } = clientFinish(state, sh, serverKey);
    const r2 = await call(h2, "/qsetu/v2/finish", codec.clientFinish.toJSON(finish));
    if (r2.status !== 200) throw new Error(`finish refused (${r2.status})`);
    const keys = keysFromBase(
      Buffer.from(sh.sessionId).toString("hex"),
      "client",
      Buffer.from(session.exportKey("tunnel-v2/c2s")),
      Buffer.from(session.exportKey("tunnel-v2/s2c")),
      Buffer.from(session.exportKey("tunnel-v2/resumption")),
    );
    ticket = { value: String(r2.json.ticket), resumption: keys.resumption };
    stats.handshakes++;
    return keys;
  }

  async function resume(h2: http2.ClientHttp2Session): Promise<TunnelKeys | undefined> {
    if (!ticket) return undefined;
    const eph = x25519.keygen();
    const random32 = randomBytes(32);
    const r = await call(h2, "/qsetu/v2/resume", {
      ticket: ticket.value,
      x25519: Buffer.from(eph.publicKey).toString("base64"),
      random: random32.toString("base64"),
    });
    if (r.status !== 200) {
      ticket = undefined;
      return undefined;
    }
    const serverShare = Buffer.from(String(r.json.x25519), "base64");
    const sid = String(r.json.sid);
    const transcript = Buffer.concat([
      random32,
      Buffer.from(eph.publicKey),
      serverShare,
      Buffer.from(sid, "hex"),
    ]);
    const base = resumedBase(
      ticket.resumption,
      x25519.getSharedSecret(eph.secretKey, serverShare),
      transcript,
    );
    eph.secretKey.fill(0);
    // Only the server that holds the ticket key could derive this: it proves the peer is the same one.
    if (!base.confirm.equals(Buffer.from(String(r.json.confirm), "base64"))) {
      ticket = undefined;
      throw new Error("resumption confirm failed");
    }
    ticket = { value: String(r.json.ticket), resumption: base.resumption };
    stats.resumptions++;
    return keysFromBase(sid, "client", base.c2s, base.s2c, base.resumption);
  }

  function getConn(): Promise<Conn> {
    if (conn && !conn.h2.closed && !conn.h2.destroyed) return Promise.resolve(conn);
    connecting ??= (async () => {
      const h2 = http2.connect(opts.peer);
      h2.on("error", () => {});
      h2.on("close", () => {
        if (conn?.h2 === h2) conn = undefined;
      });
      h2.setTimeout(0);
      const t = performance.now();
      const resumed = await resume(h2).catch(() => undefined);
      const keys = resumed ?? (await fullHandshake(h2));
      stats.lastHandshakeMs = performance.now() - t;
      log(
        `[shield-client] v2 ${resumed ? "resumed" : "full handshake"} with ${opts.peer} in ${stats.lastHandshakeMs.toFixed(1)} ms · ${keys.sid.slice(0, 8)}…`,
      );
      conn = { h2, keys };
      return conn;
    })().finally(() => (connecting = undefined));
    return connecting;
  }

  /** Sends one request through the tunnel; resolves when the response head arrives. */
  function forward(req: http.IncomingMessage, res: http.ServerResponse, c: Conn): Promise<number> {
    return new Promise((resolve, reject) => {
      const nonce = newStreamNonce();
      const { epoch, key } = c.keys.send.next();
      const s = c.h2.request({
        ":method": "POST",
        ":path": "/qsetu/v2/x",
        "qsetu-sid": c.keys.sid,
      });
      const sealer = new Sealer(streamKey(key, nonce, "c2s"), "c2s", preamble(nonce, epoch));
      sealer.head({
        method: req.method ?? "GET",
        path: req.url ?? "/",
        headers: cleanHeaders(req.headers),
      } satisfies RequestHead);
      sealer.pipe(s);
      req.pipe(sealer);
      s.on("response", (h) => {
        const status = Number(h[":status"]);
        if (status !== 200) {
          s.resume();
          reject(Object.assign(new Error(`peer answered ${status}`), { status }));
          return;
        }
        const opener = new Opener(
          "s2c",
          (n, ep) => {
            const ek = c.keys.recv.keyFor(ep);
            return ek && streamKey(ek, n, "s2c");
          },
          nonce,
        );
        opener.once("head", (head: ResponseHead) => {
          res.writeHead(head.status, {
            ...head.headers,
            "x-qsetu-session": c.keys.sid.slice(0, 16),
          });
          resolve(head.status);
        });
        opener.on("error", (e) => {
          stats.failures++;
          if (!res.headersSent) reject(e);
          else res.destroy(e);
        });
        s.pipe(opener).pipe(res);
      });
      s.on("error", reject);
    });
  }

  const app = http.createServer(async (req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(
        JSON.stringify({ ok: true, role: "shield-client", v: 2, peer: opts.peer, stats }),
      );
    }
    const replayable = req.method === "GET" || req.method === "HEAD";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const c = await getConn();
        await forward(req, res, c);
        stats.requests++;
        return;
      } catch (e) {
        log(`[shield-client] request failed: ${(e as Error).message}`);
        // 401: the peer restarted and lost the session. Reconnect; retry once if safe to.
        if ((e as { status?: number }).status === 401) conn = undefined;
        if (attempt === 1 || !replayable || res.headersSent) {
          stats.failures++;
          if (!res.headersSent) {
            res.writeHead(502, { "content-type": "text/plain" });
            res.end("Bad gateway\n");
          }
          return;
        }
      }
    }
  });
  app.keepAliveTimeout = 65_000;
  await new Promise<void>((r) => app.listen(opts.listen, opts.host ?? "127.0.0.1", r));
  log(`[shield-client] v2 :${opts.listen} → peer ${opts.peer} (one HTTP/2 connection, hybrid PQC)`);
  return {
    server: app,
    stats,
    port: () => (app.address() as { port: number }).port,
    /** Drop the connection (the next request reconnects, resuming with the ticket). */
    disconnect: () => {
      conn?.h2.close();
      conn = undefined;
    },
    close: () =>
      new Promise<void>((r) => {
        conn?.h2.close();
        app.close(() => r());
        app.closeAllConnections();
      }),
  };
}
