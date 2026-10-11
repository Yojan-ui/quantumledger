/** Small byte helpers shared across modules. No cryptography lives here. */
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import type { Bytes } from "./types";

export { bytesToHex, concatBytes, hexToBytes, utf8ToBytes };

const decoder = new TextDecoder();

export function bytesToUtf8(bytes: Bytes): string {
  return decoder.decode(bytes);
}

/** Splits `bytes` into consecutive slices of the given lengths. Throws if lengths don't add up. */
export function splitBytes(bytes: Bytes, lengths: readonly number[]): Bytes[] {
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total !== bytes.length) {
    throw new Error(`splitBytes: expected ${total} bytes, got ${bytes.length}`);
  }
  const out: Bytes[] = [];
  let offset = 0;
  for (const len of lengths) {
    out.push(bytes.subarray(offset, offset + len));
    offset += len;
  }
  return out;
}

/** Length-prefixes each part (u32 big-endian) so concatenations are unambiguous. */
export function encodeParts(...parts: Bytes[]): Bytes {
  const chunks: Bytes[] = [];
  for (const part of parts) {
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, part.length);
    chunks.push(len, part);
  }
  return concatBytes(...chunks);
}

/** Base64 (standard alphabet). Uses atob/btoa, so it works in Node ≥ 16, browsers and workers. */
export function bytesToBase64(bytes: Bytes): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return globalThis.btoa(bin);
}

export function base64ToBytes(b64: string): Bytes {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Constant-time equality for MACs and confirmations. */
export function equalBytes(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function u32(n: number): Bytes {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

export function u64(n: number): Bytes {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n));
  return b;
}
