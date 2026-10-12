/**
 * JSON wire codec for QuantumLedger session messages (FIPS 203/204 handshake, AES-256-GCM records).
 * Byte fields are base64, so messages can travel over plain HTTP/JSON or postMessage.
 */
import { base64ToBytes, bytesToBase64 } from "./encoding";
import type { ProfileId } from "./registry";
import type { ClientFinish, ClientHello, ServerHello, SessionMessage } from "./session";

export interface ClientHelloJSON {
  v: number;
  profile: ProfileId;
  clientRandom: string;
  x25519: string;
}
export interface ServerHelloJSON {
  v: number;
  profile: ProfileId;
  sessionId: string;
  serverRandom: string;
  x25519: string;
  kemPublicKey: string;
  identityKeyId: string;
  signature: string;
}
export interface ClientFinishJSON {
  sessionId: string;
  kemCiphertext: string;
  confirm: string;
}
export interface SessionMessageJSON {
  sessionId: string;
  epoch: number;
  seq: number;
  ciphertext: string;
}

const b = bytesToBase64;
const u = base64ToBytes;

export const codec = {
  clientHello: {
    toJSON: (h: ClientHello): ClientHelloJSON => ({
      v: h.v,
      profile: h.profile,
      clientRandom: b(h.clientRandom),
      x25519: b(h.x25519),
    }),
    fromJSON: (j: ClientHelloJSON): ClientHello => ({
      v: j.v,
      profile: j.profile,
      clientRandom: u(j.clientRandom),
      x25519: u(j.x25519),
    }),
  },
  serverHello: {
    toJSON: (h: ServerHello): ServerHelloJSON => ({
      v: h.v,
      profile: h.profile,
      sessionId: b(h.sessionId),
      serverRandom: b(h.serverRandom),
      x25519: b(h.x25519),
      kemPublicKey: b(h.kemPublicKey),
      identityKeyId: h.identityKeyId,
      signature: b(h.signature),
    }),
    fromJSON: (j: ServerHelloJSON): ServerHello => ({
      v: j.v,
      profile: j.profile,
      sessionId: u(j.sessionId),
      serverRandom: u(j.serverRandom),
      x25519: u(j.x25519),
      kemPublicKey: u(j.kemPublicKey),
      identityKeyId: j.identityKeyId,
      signature: u(j.signature),
    }),
  },
  clientFinish: {
    toJSON: (f: ClientFinish): ClientFinishJSON => ({
      sessionId: b(f.sessionId),
      kemCiphertext: b(f.kemCiphertext),
      confirm: b(f.confirm),
    }),
    fromJSON: (j: ClientFinishJSON): ClientFinish => ({
      sessionId: u(j.sessionId),
      kemCiphertext: u(j.kemCiphertext),
      confirm: u(j.confirm),
    }),
  },
  message: {
    toJSON: (m: SessionMessage): SessionMessageJSON => ({
      sessionId: b(m.sessionId),
      epoch: m.epoch,
      seq: m.seq,
      ciphertext: b(m.ciphertext),
    }),
    fromJSON: (j: SessionMessageJSON): SessionMessage => ({
      sessionId: u(j.sessionId),
      epoch: j.epoch,
      seq: j.seq,
      ciphertext: u(j.ciphertext),
    }),
  },
};

/** Size in bytes of a handshake message once binary-encoded (for the Compute Meter). */
export const handshakeBytes = {
  clientHello: (h: ClientHello) => 4 + h.clientRandom.length + h.x25519.length,
  serverHello: (h: ServerHello) =>
    4 +
    h.sessionId.length +
    h.serverRandom.length +
    h.x25519.length +
    h.kemPublicKey.length +
    8 +
    h.signature.length,
  clientFinish: (f: ClientFinish) => f.sessionId.length + f.kemCiphertext.length + f.confirm.length,
};
