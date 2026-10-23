/**
 * Shield tunnel v2, key schedule.
 *
 * A full handshake is the existing QuantumLedger one (hybrid X25519 + ML-KEM-768, server signed with
 * ML-DSA-65, pinned by the client). Its session exports two base keys, one per direction, and a
 * resumption secret. Each direction's key ratchets forward (HKDF) every 1,000 streams or 10 minutes;
 * the sender wipes the old key, so a key taken from memory later can't open earlier traffic. The
 * receiver keeps the current and previous epoch, so streams in flight across a ratchet still open.
 *
 * Resumption: after a full handshake the server hands the client a ticket (the resumption secret,
 * sealed under a server-only key that rotates every 12 h). Reconnecting, the client sends the ticket
 * with a fresh X25519 share; both sides derive new base keys from the resumption secret AND the new
 * X25519 secret (like TLS 1.3 psk_dhe_ke). That costs two X25519 operations instead of ML-KEM and
 * ML-DSA, keeps forward secrecy for the resumed session, and stays quantum-safe because the
 * resumption secret itself came out of the ML-KEM exchange.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ROTATE_STREAMS = 1000;
const ROTATE_MS = 10 * 60_000;
const MAX_SKIP = 8;
export const TICKET_LIFETIME_MS = 12 * 3_600_000;

const ratchet = (k: Buffer) =>
  Buffer.from(hkdfSync("sha256", k, Buffer.alloc(0), "qsetu-tunnel-v2/ratchet", 32));

/** One direction's epoch keys, from the side that sends with them. */
export class SendKeys {
  epoch = 0;
  private uses = 0;
  private startedAt = Date.now();
  constructor(private key: Buffer) {}
  /** The current epoch and its key, ratcheting first if this epoch is used up. */
  next(): { epoch: number; key: Buffer } {
    if (this.uses >= ROTATE_STREAMS || Date.now() - this.startedAt >= ROTATE_MS) {
      const old = this.key;
      this.key = ratchet(old);
      old.fill(0);
      this.epoch++;
      this.uses = 0;
      this.startedAt = Date.now();
    }
    this.uses++;
    return { epoch: this.epoch, key: this.key };
  }
}

/** One direction's epoch keys, from the receiving side: current and previous epoch. */
export class RecvKeys {
  private epoch = 0;
  private prev?: { epoch: number; key: Buffer };
  constructor(private key: Buffer) {}
  keyFor(epoch: number): Buffer | undefined {
    if (epoch === this.epoch) return this.key;
    if (this.prev && epoch === this.prev.epoch) return this.prev.key;
    if (epoch > this.epoch && epoch - this.epoch <= MAX_SKIP) {
      // Walk forward; keep the epoch just before the new one as "previous", wipe the rest.
      let before = this.key;
      let k = ratchet(before);
      for (let e = this.epoch + 1; e < epoch; e++) {
        if (before !== this.key) before.fill(0);
        before = k;
        k = ratchet(k);
      }
      this.prev?.key.fill(0);
      if (before !== this.key) this.key.fill(0);
      this.prev = { epoch: epoch - 1, key: before };
      this.key = k;
      this.epoch = epoch;
      return k;
    }
    return undefined; // stale (older than previous) or too far ahead
  }
}

export interface TunnelKeys {
  sid: string;
  send: SendKeys;
  recv: RecvKeys;
  /** For resumption tickets (server side) or to store with the ticket (client side). */
  resumption: Buffer;
}

export function keysFromBase(
  sid: string,
  role: "client" | "server",
  c2s: Buffer,
  s2c: Buffer,
  resumption: Buffer,
): TunnelKeys {
  return role === "client"
    ? { sid, send: new SendKeys(c2s), recv: new RecvKeys(s2c), resumption }
    : { sid, send: new SendKeys(s2c), recv: new RecvKeys(c2s), resumption };
}

/** Base keys for a resumed session: the resumption secret and a fresh X25519 secret, together. */
export function resumedBase(
  resumption: Buffer,
  x25519Shared: Uint8Array,
  transcript: Buffer,
): { c2s: Buffer; s2c: Buffer; resumption: Buffer; confirm: Buffer } {
  const ikm = Buffer.concat([resumption, Buffer.from(x25519Shared)]);
  const k = (label: string) =>
    Buffer.from(hkdfSync("sha256", ikm, transcript, `qsetu-tunnel-v2/resume/${label}`, 32));
  return { c2s: k("c2s"), s2c: k("s2c"), resumption: k("resumption"), confirm: k("confirm") };
}

/** The server's ticket sealer: AES-256-GCM, key rotated every 12 h, previous key kept to decrypt. */
export class TicketKeys {
  private current = randomBytes(32);
  private previous?: Buffer;
  private readonly timer: NodeJS.Timeout;
  constructor() {
    this.timer = setInterval(() => this.rotate(), TICKET_LIFETIME_MS);
    this.timer.unref();
  }
  rotate() {
    this.previous?.fill(0);
    this.previous = this.current;
    this.current = randomBytes(32);
  }
  stop() {
    clearInterval(this.timer);
  }
  seal(resumption: Buffer): Buffer {
    const iv = randomBytes(12);
    const body = Buffer.alloc(8 + 32);
    body.writeBigUInt64BE(BigInt(Date.now() + TICKET_LIFETIME_MS), 0);
    resumption.copy(body, 8);
    const c = createCipheriv("aes-256-gcm", this.current, iv);
    c.setAAD(Buffer.from("qsetu-tunnel-v2/ticket"));
    return Buffer.concat([iv, c.update(body), c.final(), c.getAuthTag()]);
  }
  open(ticket: Buffer): Buffer | undefined {
    if (ticket.length !== 12 + 40 + 16) return undefined;
    for (const key of [this.current, this.previous]) {
      if (!key) continue;
      try {
        const d = createDecipheriv("aes-256-gcm", key, ticket.subarray(0, 12));
        d.setAAD(Buffer.from("qsetu-tunnel-v2/ticket"));
        d.setAuthTag(ticket.subarray(52));
        const body = Buffer.concat([d.update(ticket.subarray(12, 52)), d.final()]);
        if (Number(body.readBigUInt64BE(0)) < Date.now()) return undefined;
        return body.subarray(8);
      } catch {
        // try the previous key
      }
    }
    return undefined;
  }
}
