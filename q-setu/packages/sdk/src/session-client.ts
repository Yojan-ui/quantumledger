/**
 * HTTP session client: runs the QuantumLedger handshake (hybrid X25519 + ML-KEM, ML-DSA-authenticated)
 * against a session server, then sends AES-256-GCM-sealed messages.
 */
import {
  base64ToBytes,
  clientFinish,
  clientHello,
  codec,
  handshakeBytes,
  type ProfileId,
  type ServerHelloJSON,
  type Session,
  type SessionMessageJSON,
  type SessionOptions,
} from "@qsetu/core";
import { asJSON, toBytes, type Data } from "./data";

export interface CreateSessionOptions extends SessionOptions {
  /** Base URL of a QuantumLedger session server, e.g. "https://bank.example/qsetu". */
  url: string;
  /** The server's pinned ML-DSA identity public key (base64 or bytes). */
  serverKey: string | Uint8Array;
  profile?: ProfileId;
  fetch?: typeof fetch;
}

export interface HandshakeStats {
  ms: number;
  bytesSent: number;
  bytesReceived: number;
}

export interface ClientSession {
  readonly id: string;
  readonly session: Session;
  readonly handshake: HandshakeStats;
  /** Seal `data`, POST it, and return the server's decrypted JSON reply. */
  send<T = unknown>(data: Data): Promise<T>;
}

async function post<T>(f: typeof fetch, url: string, body: unknown): Promise<T> {
  const res = await f(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`QuantumLedger ${url} → HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function createSession(opts: CreateSessionOptions): Promise<ClientSession> {
  const f = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const base = opts.url.replace(/\/$/, "");
  const serverKey =
    typeof opts.serverKey === "string" ? base64ToBytes(opts.serverKey) : opts.serverKey;

  const t0 = performance.now();
  const { hello, state } = clientHello(opts.profile ?? "standard");
  const shJSON = await post<ServerHelloJSON>(f, `${base}/hello`, codec.clientHello.toJSON(hello));
  const serverHello = codec.serverHello.fromJSON(shJSON);
  const { finish, session } = clientFinish(state, serverHello, serverKey, opts);
  await post(f, `${base}/finish`, codec.clientFinish.toJSON(finish));
  const handshake = {
    ms: performance.now() - t0,
    bytesSent: handshakeBytes.clientHello(hello) + handshakeBytes.clientFinish(finish),
    bytesReceived: handshakeBytes.serverHello(serverHello),
  };

  return {
    id: session.id,
    session,
    handshake,
    async send<T>(data: Data): Promise<T> {
      const reply = await post<SessionMessageJSON>(
        f,
        `${base}/message`,
        codec.message.toJSON(session.seal(toBytes(data))),
      );
      return asJSON<T>(session.open(codec.message.fromJSON(reply)));
    },
  };
}
