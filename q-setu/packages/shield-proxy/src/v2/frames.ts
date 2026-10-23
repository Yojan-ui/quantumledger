/**
 * Shield tunnel v2, record layer. Binary, streaming, no base64.
 *
 * Each proxied request is one HTTP/2 stream on a single long-lived connection between the two
 * Shield nodes. Both directions of a stream start with a 20-byte preamble and then carry frames:
 *
 *   preamble  streamNonce (16 bytes, chosen by the client) | epoch (u32)
 *   frame     length (u32, of what follows) | type (u8) | AES-256-GCM ciphertext + 16-byte tag
 *
 * Types: HEAD (the request or response line and headers, JSON), DATA (≤ 64 KiB of body), END.
 * The stream key is HKDF(epoch key of that direction, salt = streamNonce). The GCM nonce is the
 * frame's position in the stream (implicit: HTTP/2 delivers a stream in order), and the AAD binds
 * the direction, type and position, so frames can't be reordered, replayed, dropped, moved to
 * another stream or flipped between directions without failing authentication. A stream that ends
 * without an authenticated END frame is treated as truncated and fails.
 *
 * AES-256-GCM runs in OpenSSL (node:crypto), not JavaScript: bodies move at memory speed.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { Transform, type TransformCallback } from "node:stream";

export const FRAME = { HEAD: 1, DATA: 2, END: 3 } as const;
export type FrameType = (typeof FRAME)[keyof typeof FRAME];
export const MAX_PLAINTEXT = 64 * 1024;
const TAG = 16;
export const PREAMBLE_BYTES = 20;
/** Largest frame we accept: one max-size DATA frame plus type and tag. */
const MAX_FRAME = MAX_PLAINTEXT + 1 + TAG;

export type Dir = "c2s" | "s2c";

export function streamKey(epochKey: Uint8Array, nonce: Uint8Array, dir: Dir): Buffer {
  return Buffer.from(hkdfSync("sha256", epochKey, nonce, `qsetu-tunnel-v2/stream/${dir}`, 32));
}

const iv = (seq: number) => {
  const b = Buffer.alloc(12);
  b.writeUInt32BE(Math.floor(seq / 2 ** 32), 4);
  b.writeUInt32BE(seq >>> 0, 8);
  return b;
};
const aad = (dir: Dir, type: number, seq: number) => {
  const b = Buffer.alloc(7 + 1 + 8);
  b.write(dir === "c2s" ? "qt2-c2s" : "qt2-s2c", 0, "ascii");
  b[7] = type;
  b.writeUInt32BE(Math.floor(seq / 2 ** 32), 8);
  b.writeUInt32BE(seq >>> 0, 12);
  return b;
};

export function preamble(nonce: Uint8Array, epoch: number): Buffer {
  const b = Buffer.alloc(PREAMBLE_BYTES);
  Buffer.from(nonce).copy(b, 0);
  b.writeUInt32BE(epoch, 16);
  return b;
}

export const newStreamNonce = () => randomBytes(16);

/** Plaintext body bytes in, sealed frames out. Call head() first and finish with end(). */
export class Sealer extends Transform {
  private seq = 0;
  constructor(
    private readonly key: Buffer,
    private readonly dir: Dir,
    lead?: Buffer,
  ) {
    super();
    if (lead) this.push(lead);
  }

  frame(type: FrameType, plain: Buffer): Buffer {
    const c = createCipheriv("aes-256-gcm", this.key, iv(this.seq));
    c.setAAD(aad(this.dir, type, this.seq));
    const ct = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
    this.seq++;
    const h = Buffer.alloc(5);
    h.writeUInt32BE(ct.length + 1, 0);
    h[4] = type;
    return Buffer.concat([h, ct]);
  }

  head(value: unknown): void {
    this.push(this.frame(FRAME.HEAD, Buffer.from(JSON.stringify(value))));
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    for (let i = 0; i < chunk.length; i += MAX_PLAINTEXT)
      this.push(this.frame(FRAME.DATA, chunk.subarray(i, i + MAX_PLAINTEXT)));
    cb();
  }

  override _flush(cb: TransformCallback): void {
    this.push(this.frame(FRAME.END, Buffer.alloc(0)));
    cb();
  }
}

export class TunnelError extends Error {
  constructor(
    readonly reason: "auth" | "format" | "truncated" | "too_large",
    message: string,
  ) {
    super(message);
    this.name = "TunnelError";
  }
}

/**
 * Sealed frames in, plaintext body bytes out. Emits "preamble" (nonce, epoch) once and asks
 * `keyFor` for the stream key, then "head" with the decoded HEAD value. Fails on anything that
 * doesn't authenticate, and on a stream that ends without END.
 */
export class Opener extends Transform {
  private buf: Buffer = Buffer.alloc(0);
  private key?: Buffer;
  private seq = 0;
  private ended = false;
  private headSeen = false;

  constructor(
    private readonly dir: Dir,
    private readonly keyFor: (nonce: Buffer, epoch: number) => Buffer | undefined,
    /** If set, the preamble's nonce must equal this (the response to our own stream). */
    private readonly expectNonce?: Buffer,
  ) {
    super();
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    try {
      this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
      this.drain();
      cb();
    } catch (e) {
      cb(e as Error);
    }
  }

  private drain() {
    if (!this.key) {
      if (this.buf.length < PREAMBLE_BYTES) return;
      const nonce = this.buf.subarray(0, 16);
      const epoch = this.buf.readUInt32BE(16);
      if (this.expectNonce && !nonce.equals(this.expectNonce))
        throw new TunnelError("format", "Stream nonce mismatch");
      const key = this.keyFor(Buffer.from(nonce), epoch);
      if (!key) throw new TunnelError("auth", "Unknown or expired epoch");
      this.key = key;
      this.buf = this.buf.subarray(PREAMBLE_BYTES);
    }
    while (this.buf.length >= 5) {
      const len = this.buf.readUInt32BE(0);
      if (len < 1 + TAG || len > MAX_FRAME) throw new TunnelError("too_large", "Bad frame length");
      if (this.buf.length < 4 + len) return;
      if (this.ended) throw new TunnelError("format", "Data after END");
      const type = this.buf[4]!;
      const ct = this.buf.subarray(5, 4 + len);
      this.buf = this.buf.subarray(4 + len);
      const d = createDecipheriv("aes-256-gcm", this.key, iv(this.seq));
      d.setAAD(aad(this.dir, type, this.seq));
      d.setAuthTag(ct.subarray(ct.length - TAG));
      let plain: Buffer;
      try {
        plain = Buffer.concat([d.update(ct.subarray(0, ct.length - TAG)), d.final()]);
      } catch {
        throw new TunnelError("auth", "AES-GCM authentication failed: frame rejected");
      }
      this.seq++;
      if (type === FRAME.HEAD) {
        if (this.headSeen) throw new TunnelError("format", "Second HEAD");
        this.headSeen = true;
        this.emit("head", JSON.parse(plain.toString("utf8")));
      } else if (type === FRAME.DATA) {
        if (!this.headSeen) throw new TunnelError("format", "DATA before HEAD");
        this.push(plain);
      } else if (type === FRAME.END) {
        this.ended = true;
      } else throw new TunnelError("format", "Unknown frame type");
    }
  }

  override _flush(cb: TransformCallback): void {
    if (!this.ended || this.buf.length)
      return cb(new TunnelError("truncated", "Stream ended without END: truncated"));
    cb();
  }
}
