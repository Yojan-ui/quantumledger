/**
 * Shield client node: accepts plain HTTP from local apps and forwards each request to the peer
 * Shield over a QuantumLedger session (hybrid X25519 + ML-KEM, ML-DSA-pinned, AES-256-GCM records).
 */
import { createSession, type ClientSession } from "@qsetu/sdk";
import Fastify from "fastify";
import { b64, cleanHeaders, unb64, type TunnelRequest, type TunnelResponse } from "./tunnel";

export interface ShieldClientOptions {
  peer: string;
  listen: number;
  host?: string;
  /** Pinned ML-DSA identity of the peer Shield (base64). */
  serverKey: string;
  rotateEvery?: number;
  log?: (line: string) => void;
}

export async function startShieldClient(opts: ShieldClientOptions) {
  const log = opts.log ?? console.log;
  const peer = opts.peer.replace(/\/$/, "");
  let session: ClientSession | undefined;
  let connecting: Promise<ClientSession> | undefined;
  const stats = { requests: 0, handshakes: 0, lastHandshakeMs: 0 };

  async function getSession(): Promise<ClientSession> {
    if (session) return session;
    connecting ??= createSession({
      url: `${peer}/qsetu`,
      serverKey: opts.serverKey,
      rotateEvery: opts.rotateEvery,
    })
      .then((s) => {
        session = s;
        stats.handshakes++;
        stats.lastHandshakeMs = s.handshake.ms;
        log(
          `[shield-client] handshake with ${peer} in ${s.handshake.ms.toFixed(1)} ms · session ${s.id.slice(0, 8)}…`,
        );
        return s;
      })
      .finally(() => (connecting = undefined));
    return connecting;
  }

  const app = Fastify({ bodyLimit: 10 * 1024 * 1024 });
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.get("/healthz", async () => ({
    ok: true,
    role: "shield-client",
    peer,
    session: session?.id ?? null,
    stats,
  }));

  app.all("/*", async (req, reply) => {
    const body =
      req.body instanceof Buffer && req.body.length ? b64(new Uint8Array(req.body)) : undefined;
    const tunnelled: TunnelRequest = {
      method: req.method,
      path: req.url,
      headers: cleanHeaders(req.headers),
      body,
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const s = await getSession();
        const res = await s.send<TunnelResponse>(tunnelled);
        stats.requests++;
        reply.code(res.status).headers({
          ...res.headers,
          "x-qsetu-session": s.id.slice(0, 16),
          "x-qsetu-epoch": String(s.session.epoch),
        });
        return reply.send(Buffer.from(unb64(res.body)));
      } catch (e) {
        session = undefined; // e.g. the peer restarted: re-handshake once
        if (attempt === 1)
          return reply
            .code(502)
            .send({ error: `QuantumLedger tunnel failed: ${(e as Error).message}` });
      }
    }
  });

  await app.listen({ port: opts.listen, host: opts.host ?? "127.0.0.1" });
  log(`[shield-client] :${opts.listen} → peer ${peer} (all traffic hybrid PQC)`);
  return { app, stats, close: () => app.close(), getSession };
}
