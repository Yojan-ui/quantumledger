/**
 * Makes an admin TOTP secret: prints ADMIN_TOTP_SECRET for your environment and an otpauth:// URL to
 * add to an authenticator app (paste it, or turn it into a QR code locally). Keep both private.
 *
 *   node scripts/admin-totp.mjs [label]
 */
import { randomBytes } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bytes = randomBytes(20);
let bits = 0;
let value = 0;
let out = "";
for (const b of bytes) {
  value = (value << 8) | b;
  bits += 8;
  while (bits >= 5) {
    out += B32[(value >>> (bits - 5)) & 31];
    bits -= 5;
  }
}
if (bits > 0) out += B32[(value << (5 - bits)) & 31];
const label = encodeURIComponent(process.argv[2] ?? "admin");
console.log(`ADMIN_TOTP_SECRET=${out}`);
console.log(
  `otpauth://totp/QuantumLedger:${label}?secret=${out}&issuer=QuantumLedger&algorithm=SHA1&digits=6&period=30`,
);
