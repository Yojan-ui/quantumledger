/**
 * "Phone in the room": the audience seals real messages to this server.
 *
 * The room holds one hybrid X25519 + ML-KEM-768 key pair per process (its secret key never leaves
 * this object and is never logged). A phone joins with the public half of a key pair it generated in
 * its own browser, seals a short message to the room's public key with the Q-Setu envelope, and
 * posts it. The room opens it (KEM decapsulation + AES-256-GCM, whose tag check rejects any change
 * to the packet) and seals a receipt back to the phone's key: the SHA3-256 digest of what it read.
 * The phone opens the receipt and compares the digest with its own message before showing ✓.
 *
 * No personal data: a visitor is a random bearer ID, a generic name ("Visitor 7"), a colour and a
 * random Indian city for the globe. The big screen never shows message text, only sizes and timings.
 */
import { EventEmitter } from "node:events";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { randomBytes } from "@noble/hashes/utils.js";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  envelopeFromJSON,
  envelopeToJSON,
  getKem,
  keyId,
  open,
  seal,
  utf8ToBytes,
  type EnvelopeJSON,
  type KeyPair,
} from "@qsetu/core";
import { MAX_MESSAGE_BYTES } from "./room-limits";
import { ROOM_CITIES, ROOM_HUB, VISITOR_COLOURS } from "@/data/room";

export const ROOM_KEM = "hybrid-x25519-mlkem768";
const MAX_VISITORS = 2000;
/** One message per visitor per this many ms. */
const SEND_GAP_MS = 1200;

/** Associated data that binds a message to the visitor who sent it. */
export const roomAad = (visitorId: string) => utf8ToBytes(`qsetu-room/v1|${visitorId}`);
export const receiptAad = (visitorId: string) => utf8ToBytes(`qsetu-room/v1/receipt|${visitorId}`);

export interface PublicVisitor {
  n: number;
  name: string;
  /** Index into VISITOR_COLOURS. */
  colour: number;
  city: string;
}

interface Visitor extends PublicVisitor {
  id: string;
  publicKey: Uint8Array;
  lastSend: number;
}

export type RoomEvent =
  | { kind: "join"; at: number; visitor: PublicVisitor; visitors: number }
  | {
      kind: "sealed";
      at: number;
      seq: number;
      visitor: PublicVisitor;
      /** Envelope size on the wire (KEM ciphertext + nonce + AEAD ciphertext and tag). */
      bytes: number;
      /** Seal time measured on the phone (reported by it). */
      sealMs: number;
      /** Open time measured here. */
      openMs: number;
      /** The message, only when it is one of the fixed emoji (free text is never broadcast). */
      emoji?: string;
      chars: number;
      sealed: number;
    }
  | {
      kind: "rejected";
      at: number;
      seq: number;
      visitor: PublicVisitor;
      bytes: number;
      reason: string;
      openMs: number;
      rejected: number;
    };

export interface RoomStats {
  visitors: number;
  sealed: number;
  rejected: number;
  hub: string;
}

export class RoomError extends Error {
  constructor(
    readonly code: "unknown_visitor" | "invalid_key" | "too_fast" | "invalid_input",
    message: string,
  ) {
    super(message);
  }
}

export interface Receipt {
  ok: true;
  /** The room's receipt, sealed to the phone's own public key. */
  receipt: EnvelopeJSON;
  openMs: number;
  bytes: number;
}

export interface Rejection {
  ok: false;
  reason: string;
  openMs: number;
  bytes: number;
}

const envBytes = (j: EnvelopeJSON) =>
  base64ToBytes(j.kemCt).length + base64ToBytes(j.nonce).length + base64ToBytes(j.ct).length;

export class Room {
  private readonly ee = new EventEmitter();
  private readonly keys: KeyPair;
  private readonly visitors = new Map<string, Visitor>();
  private joined = 0;
  private seq = 0;
  private sealed = 0;
  private rejected = 0;
  private readonly recent: RoomEvent[] = [];

  constructor(
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
    private readonly emoji: readonly string[] = [],
  ) {
    this.ee.setMaxListeners(0);
    this.keys = getKem(ROOM_KEM).keygen();
  }

  publicKey(): { publicKey: string; kid: string; kem: typeof ROOM_KEM } {
    return {
      publicKey: bytesToBase64(this.keys.publicKey),
      kid: keyId(this.keys.publicKey),
      kem: ROOM_KEM,
    };
  }

  stats(): RoomStats {
    return {
      visitors: this.visitors.size,
      sealed: this.sealed,
      rejected: this.rejected,
      hub: ROOM_HUB,
    };
  }

  history(): RoomEvent[] {
    return [...this.recent];
  }

  subscribe(fn: (e: RoomEvent) => void): () => void {
    this.ee.on("event", fn);
    return () => void this.ee.off("event", fn);
  }

  /** A phone joins with the public half of a key pair it generated itself. */
  join(publicKeyB64: string): { id: string; visitor: PublicVisitor } {
    let publicKey: Uint8Array;
    try {
      publicKey = base64ToBytes(publicKeyB64);
    } catch {
      throw new RoomError("invalid_key", "Public key must be base64");
    }
    if (publicKey.length !== getKem(ROOM_KEM).sizes.publicKey)
      throw new RoomError("invalid_key", "Expected an X25519 + ML-KEM-768 public key");
    const n = ++this.joined;
    const v: Visitor = {
      id: bytesToHex(randomBytes(16)),
      n,
      name: `Visitor ${n}`,
      colour: (n - 1) % VISITOR_COLOURS.length,
      city: ROOM_CITIES[Math.floor(this.random() * ROOM_CITIES.length)]!.id,
      publicKey,
      lastSend: -Infinity,
    };
    this.visitors.set(v.id, v);
    if (this.visitors.size > MAX_VISITORS) this.visitors.delete(this.visitors.keys().next().value!);
    const pub = this.public(v);
    this.emit({ kind: "join", at: this.now(), visitor: pub, visitors: this.visitors.size });
    return { id: v.id, visitor: pub };
  }

  /**
   * Opens a sealed message. A valid one is answered with a receipt sealed to the phone's key; a
   * modified one fails the AEAD tag (or the header checks) and is rejected, in public.
   */
  receive(visitorId: string, env: EnvelopeJSON, sealMs: number): Receipt | Rejection {
    const v = this.visitors.get(visitorId);
    if (!v) throw new RoomError("unknown_visitor", "Unknown visitor: scan the code again");
    const t = this.now();
    if (t - v.lastSend < SEND_GAP_MS)
      throw new RoomError("too_fast", "One message at a time, please");
    v.lastSend = t;
    let bytes = 0;
    const t0 = performance.now();
    let plain: Uint8Array;
    try {
      bytes = envBytes(env);
      plain = open(envelopeFromJSON(env), this.keys, { aad: roomAad(v.id) });
      if (plain.length === 0 || plain.length > MAX_MESSAGE_BYTES)
        throw new Error(`Message must be 1–${MAX_MESSAGE_BYTES} bytes`);
    } catch (e) {
      const openMs = performance.now() - t0;
      const reason = (e as Error).message;
      this.rejected++;
      this.emit({
        kind: "rejected",
        at: this.now(),
        seq: ++this.seq,
        visitor: this.public(v),
        bytes,
        reason,
        openMs,
        rejected: this.rejected,
      });
      return { ok: false, reason, openMs, bytes };
    }
    const openMs = performance.now() - t0;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(plain);
    const digest = bytesToHex(sha3_256(plain));
    const receipt = seal(
      utf8ToBytes(JSON.stringify({ opened: true, sha3: digest, n: this.sealed + 1, by: "Q-Setu" })),
      v.publicKey,
      { aad: receiptAad(v.id) },
    );
    this.sealed++;
    this.emit({
      kind: "sealed",
      at: this.now(),
      seq: ++this.seq,
      visitor: this.public(v),
      bytes,
      sealMs: Number.isFinite(sealMs) ? Math.max(0, Math.min(sealMs, 60_000)) : 0,
      openMs,
      emoji: this.emoji.includes(text) ? text : undefined,
      chars: [...text].length,
      sealed: this.sealed,
    });
    return { ok: true, receipt: envelopeToJSON(receipt), openMs, bytes };
  }

  private public(v: Visitor): PublicVisitor {
    return { n: v.n, name: v.name, colour: v.colour, city: v.city };
  }

  private emit(e: RoomEvent) {
    this.recent.push(e);
    if (this.recent.length > 30) this.recent.shift();
    this.ee.emit("event", e);
  }
}
