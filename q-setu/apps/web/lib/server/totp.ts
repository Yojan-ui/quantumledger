/**
 * Time-based one-time passwords (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits), the admin's second
 * factor. Accepts the current step and one either side (clock drift), and refuses a code whose step
 * was already used, so a code seen over someone's shoulder can't be replayed.
 *
 * The secret is ADMIN_TOTP_SECRET (base32, as authenticator apps expect). Make one with
 * `node scripts/admin-totp.mjs`.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totp(secret: Buffer, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  msg.writeUInt32BE(step >>> 0, 4);
  const h = createHmac("sha1", secret).update(msg).digest();
  const o = h[h.length - 1]! & 0xf;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, "0");
}

/** The last step used, per secret (keyed by a hash of it), so one account's login can't block another's. */
const g = globalThis as unknown as { __qlTotpUsed?: Map<string, number> };
const used = (g.__qlTotpUsed ??= new Map());

/** True if `code` is valid now and its step hasn't been used before (then marks it used). */
export function verifyTotp(secretB32: string, code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  let secret: Buffer;
  try {
    secret = base32Decode(secretB32);
  } catch {
    return false;
  }
  if (secret.length < 10) return false;
  const step = Math.floor(now / 30_000);
  let hit: number | undefined;
  for (const s of [step - 1, step, step + 1]) {
    // Compare every candidate (no early exit), in constant time.
    if (timingSafeEqual(Buffer.from(totp(secret, s)), Buffer.from(code)) && hit === undefined)
      hit = s;
  }
  const id = createHash("sha256").update(secret).digest("base64url").slice(0, 22);
  if (hit === undefined || hit <= (used.get(id) ?? -1)) return false;
  used.set(id, hit);
  if (used.size > 100_000) used.delete(used.keys().next().value!);
  return true;
}
