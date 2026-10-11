/**
 * Framework-agnostic session server: answers the handshake (ML-DSA-signed hybrid key exchange)
 * and opens/seals AES-256-GCM messages. Wire `hello`, `finish` and `message` to any HTTP router.
 */
import {
  bytesToHex,
  codec,
  serverComplete,
  serverRespond,
  type ClientFinishJSON,
  type ClientHelloJSON,
  type Identity,
  type ServerHelloJSON,
  type ServerPending,
  type Session,
  type SessionMessageJSON,
  type SessionOptions,
} from "@qsetu/core";
import { asJSON, toBytes, type Data } from "./data";

export interface SessionServerOptions extends SessionOptions {
  identity: Identity;
  /** Drop idle sessions after this long (default 30 minutes). */
  ttlMs?: number;
  maxSessions?: number;
}

export type MessageHandler = (request: unknown, session: Session) => Data | Promise<Data>;

export function createSessionServer(opts: SessionServerOptions) {
  const pending = new Map<string, { p: ServerPending; at: number }>();
  const sessions = new Map<string, { s: Session; at: number }>();
  const ttl = opts.ttlMs ?? 30 * 60_000;
  const max = opts.maxSessions ?? 10_000;

  function sweep() {
    const now = Date.now();
    for (const [k, v] of pending) if (now - v.at > 60_000) pending.delete(k);
    for (const [k, v] of sessions) if (now - v.at > ttl) sessions.delete(k);
    while (sessions.size > max) sessions.delete(sessions.keys().next().value!);
  }

  return {
    identity: opts.identity,
    sessions,

    hello(body: ClientHelloJSON): ServerHelloJSON {
      sweep();
      const { serverHello, pending: p } = serverRespond(
        codec.clientHello.fromJSON(body),
        opts.identity,
      );
      pending.set(bytesToHex(serverHello.sessionId), { p, at: Date.now() });
      return codec.serverHello.toJSON(serverHello);
    },

    finish(body: ClientFinishJSON): { sessionId: string } {
      const fin = codec.clientFinish.fromJSON(body);
      const id = bytesToHex(fin.sessionId);
      const entry = pending.get(id);
      if (!entry) throw new Error("Unknown or expired handshake");
      pending.delete(id);
      sessions.set(id, { s: serverComplete(entry.p, fin, opts), at: Date.now() });
      return { sessionId: id };
    },

    /** Decrypts the request, runs `handler`, and seals its reply. */
    async message(body: SessionMessageJSON, handler: MessageHandler): Promise<SessionMessageJSON> {
      const msg = codec.message.fromJSON(body);
      const entry = sessions.get(bytesToHex(msg.sessionId));
      if (!entry) throw new Error("Unknown session");
      entry.at = Date.now();
      const request = asJSON(entry.s.open(msg));
      const reply = await handler(request, entry.s);
      return codec.message.toJSON(entry.s.seal(toBytes(reply)));
    },
  };
}

export type SessionServer = ReturnType<typeof createSessionServer>;
