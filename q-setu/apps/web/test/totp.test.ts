import { describe, expect, it } from "vitest";
import { base32Decode, totp, verifyTotp } from "@/lib/server/totp";

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 appendix B, SHA-1 secret "12345678901234567890", last 6 digits.
  const secret = Buffer.from("12345678901234567890");
  it("matches the RFC test vectors", () => {
    expect(totp(secret, Math.floor(59 / 30))).toBe("287082");
    expect(totp(secret, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totp(secret, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totp(secret, Math.floor(2000000000 / 30))).toBe("279037");
  });
  it("accepts the current code once, with one step of drift, and never twice", () => {
    const b32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // base32 of the same secret
    expect(base32Decode(b32).equals(secret)).toBe(true);
    const now = 1_900_000_000_000;
    const code = totp(secret, Math.floor(now / 30_000));
    expect(verifyTotp(b32, code, now + 25_000)).toBe(true);
    expect(verifyTotp(b32, code, now + 25_000)).toBe(false); // replay
    expect(verifyTotp(b32, "000000", now)).toBe(false);
    expect(verifyTotp(b32, "12345", now)).toBe(false);
    const later = totp(secret, Math.floor(now / 30_000) + 3);
    expect(verifyTotp(b32, later, now)).toBe(false); // too far ahead
  });
  it("tracks used codes per secret: two accounts can sign in within the same 30 s", () => {
    const now = 1_950_000_000_000;
    const step = Math.floor(now / 30_000);
    const a = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    const b = "KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU";
    expect(verifyTotp(a, totp(base32Decode(a), step), now)).toBe(true);
    expect(verifyTotp(b, totp(base32Decode(b), step), now)).toBe(true);
  });
});
