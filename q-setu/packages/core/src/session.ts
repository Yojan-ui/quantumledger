/**
 * QuantumLedger session: hybrid X25519 + ML-KEM (FIPS 203) handshake authenticated by ML-DSA (FIPS 204),
 * then AES-256-GCM (SP 800-38D) messages with counters, replay protection and ratcheting key rotation.
 *
 *   1. ClientHello  { profile, clientRandom, x25519 share }
 *   2. ServerHello  { sessionId, serverRandom, x25519 share, ephemeral ML-KEM pk, ML-DSA signature }
 *                   The signature covers the ClientHello too, so shares can't be swapped.
 *   3. ClientFinish { ML-KEM ciphertext, key confirmation }
 *      master = HKDF(ss_x25519 || ss_mlkem, "qsetu-v1" || SHA-256(transcript))   (see hybrid-kem.ts)
 *   4. Messages     AES-256-GCM, nonce = epoch-local counter, AAD = header.
 *
 * The expensive post-quantum work happens once per session. Each later message costs one AES-GCM
 * call and adds 44 bytes (28-byte header + 16-byte tag). Ephemeral keys give forward secrecy, and
 * the per-epoch key ratchet (rotate every N messages or T ms) limits what one leaked key reveals.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import {
  bytesToHex,
  concatBytes,
  encodeParts,
  equalBytes,
  u32,
  u64,
  utf8ToBytes,
} from "./encoding";
import { combineSecrets } from "./hybrid-kem";
import { getKem, getProfile, getSig, type ProfileId } from "./registry";
import type { Bytes, KeyPair } from "./types";

export const SESSION_VERSION = 1;
const HEADER_BYTES = 16 + 4 + 8;
const TAG_BYTES = 16;
export const MESSAGE_OVERHEAD_BYTES = HEADER_BYTES + TAG_BYTES;
const REPLAY_WINDOW = 64;
const MAX_EPOCH_SKIP = 8;

export class SessionError extends Error {
  constructor(
    readonly reason: "signature" | "confirm" | "replay" | "epoch" | "auth" | "format",
    message: string,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

// ── identities ─────────────────────────────────────────────────────────────────────────────

/** A server's long-term signing identity. Clients pin `publicKey` (or its key ID). */
export interface Identity {
  profile: ProfileId;
  publicKey: Bytes;
  secretKey: Bytes;
}

export function createIdentity(profile: ProfileId = "standard", seed?: Bytes): Identity {
  return { profile, ...getSig(getProfile(profile).sig).keygen(seed) };
}

/** Short, public fingerprint: first 8 bytes of SHA-256(publicKey), as hex. */
export function keyId(publicKey: Bytes): string {
  return bytesToHex(sha256(publicKey).subarray(0, 8));
}

// ── handshake messages ─────────────────────────────────────────────────────────────────────

export interface ClientHello {
  v: number;
  profile: ProfileId;
  clientRandom: Bytes;
  x25519: Bytes;
}

export interface ServerHello {
  v: number;
  profile: ProfileId;
  sessionId: Bytes;
  serverRandom: Bytes;
  x25519: Bytes;
  kemPublicKey: Bytes;
  identityKeyId: string;
  signature: Bytes;
}

export interface ClientFinish {
  sessionId: Bytes;
  kemCiphertext: Bytes;
  confirm: Bytes;
}

export interface ClientState {
  hello: ClientHello;
  x25519Secret: Bytes;
}

export interface ServerPending {
  hello: ClientHello;
  serverHello: ServerHello;
  x25519Secret: Bytes;
  kem: KeyPair;
}

const helloBytes = (h: ClientHello) =>
  encodeParts(u32(h.v), utf8ToBytes(h.profile), h.clientRandom, h.x25519);

function serverSigned(ch: ClientHello, sh: Omit<ServerHello, "signature">): Bytes {
  return concatBytes(
    utf8ToBytes("qsetu-v1/server-hello"),
    encodeParts(
      helloBytes(ch),
      sh.sessionId,
      sh.serverRandom,
      sh.x25519,
      sh.kemPublicKey,
      utf8ToBytes(sh.identityKeyId),
    ),
  );
}

const transcriptOf = (ch: ClientHello, sh: ServerHello, kemCt: Bytes) =>
  encodeParts(serverSigned(ch, sh), sh.signature, kemCt);

const confirmKey = (master: Bytes) =>
  hkdf(sha256, master, undefined, utf8ToBytes("qsetu-v1/confirm"), 32);

export function clientHello(profile: ProfileId = "standard"): {
  hello: ClientHello;
  state: ClientState;
} {
  const eph = x25519.keygen();
  const hello: ClientHello = {
    v: SESSION_VERSION,
    profile,
    clientRandom: randomBytes(32),
    x25519: eph.publicKey,
  };
  return { hello, state: { hello, x25519Secret: eph.secretKey } };
}

export function serverRespond(
  hello: ClientHello,
  identity: Identity,
): { serverHello: ServerHello; pending: ServerPending } {
  if (hello.v !== SESSION_VERSION)
    throw new SessionError("format", `Unsupported session version ${hello.v}`);
  if (hello.profile !== identity.profile)
    throw new SessionError("format", `Server only speaks profile "${identity.profile}"`);
  const profile = getProfile(hello.profile);
  const eph = x25519.keygen();
  const kem = getKem(profile.pqKem).keygen(); // ephemeral, so each session has forward secrecy
  const unsigned = {
    v: SESSION_VERSION,
    profile: hello.profile,
    sessionId: randomBytes(16),
    serverRandom: randomBytes(32),
    x25519: eph.publicKey,
    kemPublicKey: kem.publicKey,
    identityKeyId: keyId(identity.publicKey),
  };
  const signature = getSig(profile.sig).sign(serverSigned(hello, unsigned), identity.secretKey);
  const serverHello = { ...unsigned, signature };
  return { serverHello, pending: { hello, serverHello, x25519Secret: eph.secretKey, kem } };
}

export interface SessionOptions {
  /** Ratchet to a fresh key after this many messages per direction (default 1000). */
  rotateEvery?: number;
  /** ...or after this many milliseconds (default 10 minutes). */
  rotateAfterMs?: number;
  now?: () => number;
}

export function clientFinish(
  state: ClientState,
  sh: ServerHello,
  serverIdentityPublicKey: Bytes,
  opts: SessionOptions = {},
): { finish: ClientFinish; session: Session } {
  const profile = getProfile(state.hello.profile);
  if (sh.profile !== state.hello.profile) throw new SessionError("format", "Profile mismatch");
  if (sh.identityKeyId !== keyId(serverIdentityPublicKey))
    throw new SessionError("signature", "Unexpected server identity");
  const { signature, ...unsigned } = sh;
  if (
    !getSig(profile.sig).verify(
      signature,
      serverSigned(state.hello, unsigned),
      serverIdentityPublicKey,
    )
  ) {
    throw new SessionError(
      "signature",
      `${getSig(profile.sig).name} verification failed: server hello rejected`,
    );
  }
  const ssX = x25519.getSharedSecret(state.x25519Secret, sh.x25519);
  const { ciphertext, sharedSecret: ssM } = getKem(profile.pqKem).encapsulate(sh.kemPublicKey);
  state.x25519Secret.fill(0);
  const { session, confirm } = sessionFromSecrets(
    state.hello,
    sh,
    ciphertext,
    ssX,
    ssM,
    "client",
    opts,
  );
  return { finish: { sessionId: sh.sessionId, kemCiphertext: ciphertext, confirm }, session };
}

export function serverComplete(
  pending: ServerPending,
  finish: ClientFinish,
  opts: SessionOptions = {},
): Session {
  const profile = getProfile(pending.hello.profile);
  if (!equalBytes(finish.sessionId, pending.serverHello.sessionId))
    throw new SessionError("format", "Session ID mismatch");
  const ssX = x25519.getSharedSecret(pending.x25519Secret, pending.hello.x25519);
  const ssM = getKem(profile.pqKem).decapsulate(finish.kemCiphertext, pending.kem.secretKey);
  pending.x25519Secret.fill(0);
  pending.kem.secretKey.fill(0);
  const { session, confirm } = sessionFromSecrets(
    pending.hello,
    pending.serverHello,
    finish.kemCiphertext,
    ssX,
    ssM,
    "server",
    opts,
  );
  if (!equalBytes(finish.confirm, confirm))
    throw new SessionError("confirm", "Key confirmation failed: client finish rejected");
  return session;
}

/**
 * The key schedule: both shared secrets plus the full transcript give a session and its key
 * confirmation. Endpoints use this after the handshake. The Q-Day simulation also uses it, to
 * show that an attacker holding only ss_x25519 derives the wrong keys.
 */
export function sessionFromSecrets(
  hello: ClientHello,
  serverHello: ServerHello,
  kemCiphertext: Bytes,
  ssX25519: Bytes,
  ssMlKem: Bytes,
  role: "client" | "server",
  opts: SessionOptions = {},
): { session: Session; confirm: Bytes } {
  const transcript = transcriptOf(hello, serverHello, kemCiphertext);
  const master = combineSecrets(ssX25519, ssMlKem, transcript);
  const confirm = hmac(sha256, confirmKey(master), transcript);
  return { session: new Session(serverHello.sessionId, master, role, opts), confirm };
}

// ── record layer ───────────────────────────────────────────────────────────────────────────

export interface SessionMessage {
  sessionId: Bytes;
  epoch: number;
  seq: number;
  ciphertext: Bytes;
}

interface Direction {
  key: Bytes;
  epoch: number;
  startedAt: number;
}

const directionKey = (master: Bytes, dir: "c2s" | "s2c") =>
  hkdf(sha256, master, undefined, utf8ToBytes(`qsetu-v1/${dir}/epoch0`), 32);
const ratchet = (key: Bytes) => hkdf(sha256, key, undefined, utf8ToBytes("qsetu-v1/ratchet"), 32);
const nonceFor = (seq: number) => concatBytes(new Uint8Array(4), u64(seq));
const aadFor = (sid: Bytes, epoch: number, seq: number, aad: Bytes) =>
  concatBytes(sid, u32(epoch), u64(seq), aad);

export class Session {
  readonly id: string;
  private send: Direction & { seq: number };
  private recv: Direction & {
    previous?: { epoch: number; key: Bytes; seen: Set<number>; max: number };
  };
  private seen = new Set<number>();
  private maxSeq = -1;
  private readonly rotateEvery: number;
  private readonly rotateAfterMs: number;
  private readonly now: () => number;
  readonly stats = { sent: 0, received: 0, rotations: 0, rejected: 0 };

  constructor(
    readonly sessionId: Bytes,
    master: Bytes,
    readonly role: "client" | "server",
    opts: SessionOptions = {},
  ) {
    this.id = bytesToHex(sessionId);
    this.rotateEvery = opts.rotateEvery ?? 1000;
    this.rotateAfterMs = opts.rotateAfterMs ?? 10 * 60_000;
    this.now = opts.now ?? Date.now;
    const out = role === "client" ? "c2s" : "s2c";
    const inn = role === "client" ? "s2c" : "c2s";
    const t = this.now();
    this.send = { key: directionKey(master, out), epoch: 0, seq: 0, startedAt: t };
    this.recv = { key: directionKey(master, inn), epoch: 0, startedAt: t };
    master.fill(0);
  }

  get epoch(): number {
    return this.send.epoch;
  }

  seal(plaintext: Bytes, aad: Bytes = new Uint8Array(0)): SessionMessage {
    if (this.send.seq >= this.rotateEvery || this.now() - this.send.startedAt >= this.rotateAfterMs)
      this.rotateSend();
    const { epoch, seq, key } = this.send;
    const ciphertext = gcm(key, nonceFor(seq), aadFor(this.sessionId, epoch, seq, aad)).encrypt(
      plaintext,
    );
    this.send.seq++;
    this.stats.sent++;
    return { sessionId: this.sessionId, epoch, seq, ciphertext };
  }

  open(msg: SessionMessage, aad: Bytes = new Uint8Array(0)): Bytes {
    try {
      return this.openInner(msg, aad);
    } catch (e) {
      this.stats.rejected++;
      throw e;
    }
  }

  private openInner(msg: SessionMessage, aad: Bytes): Bytes {
    if (!equalBytes(msg.sessionId, this.sessionId))
      throw new SessionError("format", "Wrong session");
    let key: Bytes;
    let seen: Set<number>;
    let max: number;
    const prev = this.recv.previous;
    if (msg.epoch === this.recv.epoch) {
      ({ key } = this.recv);
      seen = this.seen;
      max = this.maxSeq;
    } else if (prev && msg.epoch === prev.epoch) {
      ({ key, seen, max } = prev);
    } else if (msg.epoch > this.recv.epoch && msg.epoch - this.recv.epoch <= MAX_EPOCH_SKIP) {
      let k = this.recv.key;
      for (let e = this.recv.epoch; e < msg.epoch; e++) k = ratchet(k);
      key = k;
      seen = new Set();
      max = -1;
    } else {
      throw new SessionError("epoch", `Stale or out-of-range epoch ${msg.epoch}`);
    }
    if (msg.seq <= max - REPLAY_WINDOW || seen.has(msg.seq)) {
      throw new SessionError(
        "replay",
        `Replayed message (epoch ${msg.epoch}, seq ${msg.seq}) rejected`,
      );
    }
    let plaintext: Bytes;
    try {
      plaintext = gcm(
        key,
        nonceFor(msg.seq),
        aadFor(this.sessionId, msg.epoch, msg.seq, aad),
      ).decrypt(msg.ciphertext);
    } catch {
      throw new SessionError("auth", "AES-GCM authentication failed: message rejected");
    }
    // Only commit state after authentication succeeds.
    if (msg.epoch > this.recv.epoch) {
      this.recv.previous = {
        epoch: this.recv.epoch,
        key: this.recv.key,
        seen: this.seen,
        max: this.maxSeq,
      };
      this.recv.key = key;
      this.recv.epoch = msg.epoch;
      this.seen = seen;
      this.maxSeq = max;
      this.stats.rotations++;
    }
    seen.add(msg.seq);
    const newMax = Math.max(max, msg.seq);
    for (const s of seen) if (s <= newMax - REPLAY_WINDOW) seen.delete(s);
    if (msg.epoch === this.recv.epoch) this.maxSeq = newMax;
    else if (prev && msg.epoch === prev.epoch) prev.max = newMax;
    this.stats.received++;
    return plaintext;
  }

  private rotateSend(): void {
    const old = this.send.key;
    this.send = { key: ratchet(old), epoch: this.send.epoch + 1, seq: 0, startedAt: this.now() };
    old.fill(0); // forward secrecy: the previous epoch key is gone
    this.stats.rotations++;
  }
}

// ── wire encoding ──────────────────────────────────────────────────────────────────────────

export function encodeMessage(m: SessionMessage): Bytes {
  return concatBytes(m.sessionId, u32(m.epoch), u64(m.seq), m.ciphertext);
}

export function decodeMessage(bytes: Bytes): SessionMessage {
  if (bytes.length < HEADER_BYTES + TAG_BYTES)
    throw new SessionError("format", "Message too short");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    sessionId: bytes.slice(0, 16),
    epoch: view.getUint32(16),
    seq: Number(view.getBigUint64(20)),
    ciphertext: bytes.slice(HEADER_BYTES),
  };
}
