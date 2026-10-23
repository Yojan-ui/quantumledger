/**
 * Shield server node: terminates the QuantumLedger session (ML-DSA-signed hybrid ML-KEM handshake,
 * AES-256-GCM records) and replays each decrypted request to the unmodified upstream app.
 */
import { createSessionServer } from "@qsetu/sdk";
import { bytesToBase64, type Identity } from "@qsetu/core";
import Fastify from "fastify";
import { b64, cleanHeaders, unb64, type TunnelRequest, type TunnelResponse } from "./tunnel";
import { previewB64, WireLog } from "./wire";

export interface ShieldServerOptions {
  upstream: string;
  listen: number;
  host?: string;
  identity: Identity;
  /** Publish the identity key at /qsetu/identity for demo clients (trust on first use). Off by default. */
  demoIdentity?: boolean;
  log?: (line: string) => void;
}

export async function startShieldServer(opts: ShieldServerOptions) {
  const log = opts.log ?? console.log;
  const upstream = opts.upstream.replace(/\/$/, "");
  const sessions = createSessionServer({ identity: opts.identity });
  const wire = new WireLog();
  const app = Fastify({ bodyLimit: 10 * 1024 * 1024 });

  app.get("/healthz", async () => ({ ok: true, role: "shield-server", upstream }));
  // Bootstrap for demos only: real clients pin this key from configuration (SHIELD_PEER_KEY).
  if (opts.demoIdentity) {
    log(
      "[shield-server] WARNING: demo mode serves the identity key at /qsetu/identity. Clients that fetch it there trust whoever answers first. Pin SHIELD_PEER_KEY in production.",
    );
    app.get("/qsetu/identity", async () => ({
      profile: opts.identity.profile,
      publicKey: bytesToBase64(opts.identity.publicKey),
      demo: true,
    }));
  }
  app.get("/qsetu/wire", async () => ({ frames: wire.list() }));

  app.post("/qsetu/hello", async (req) => {
    const out = sessions.hello(req.body as never);
    wire.push({
      kind: "client-hello",
      bytes: JSON.stringify(req.body).length,
      preview: previewB64((req.body as { x25519: string }).x25519),
    });
    wire.push({
      kind: "server-hello",
      bytes: JSON.stringify(out).length,
      preview: previewB64(out.kemPublicKey),
    });
    return out;
  });

  app.post("/qsetu/finish", async (req) => {
    const body = req.body as { kemCiphertext: string };
    wire.push({
      kind: "client-finish",
      bytes: JSON.stringify(body).length,
      preview: previewB64(body.kemCiphertext),
    });
    const out = sessions.finish(req.body as never);
    log(
      `[shield-server] session ${out.sessionId.slice(0, 8)}… established (${opts.identity.profile} profile)`,
    );
    return out;
  });

  app.post("/qsetu/message", async (req, reply) => {
    const body = req.body as { ciphertext: string; epoch: number; seq: number };
    wire.push({
      kind: "request",
      bytes: Math.floor((body.ciphertext.length * 3) / 4) + 28,
      preview: previewB64(body.ciphertext),
      epoch: body.epoch,
      seq: body.seq,
    });
    try {
      const out = await sessions.message(req.body as never, async (request) => {
        const r = request as TunnelRequest;
        if (!r.path.startsWith("/")) throw new Error("Bad path");
        const res = await fetch(upstream + r.path, {
          method: r.method,
          headers: r.headers,
          body: r.body && !["GET", "HEAD"].includes(r.method) ? unb64(r.body) : undefined,
        });
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => (headers[k] = v));
        const resp: TunnelResponse = {
          status: res.status,
          headers: cleanHeaders(headers),
          body: b64(new Uint8Array(await res.arrayBuffer())),
        };
        return resp;
      });
      wire.push({
        kind: "response",
        bytes: Math.floor((out.ciphertext.length * 3) / 4) + 28,
        preview: previewB64(out.ciphertext),
        epoch: out.epoch,
        seq: out.seq,
      });
      return out;
    } catch (e) {
      log(`[shield-server] rejected message: ${(e as Error).message}`);
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  await app.listen({ port: opts.listen, host: opts.host ?? "127.0.0.1" });
  log(
    `[shield-server] :${opts.listen} → ${upstream} · identity ${bytesToBase64(opts.identity.publicKey).slice(0, 12)}… (ML-DSA public key)`,
  );
  return { app, wire, close: () => app.close() };
}
