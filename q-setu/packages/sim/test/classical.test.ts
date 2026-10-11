import { describe, expect, it } from "vitest";
import { classical } from "../src";

const { tinyRsaKeygen, tinyRsaEncrypt, tinyRsaDecrypt, pollardRho, isProbablePrime, modInverse } =
  classical;

describe("INSECURE_DEMO_ONLY tiny RSA", () => {
  it("generates a 40-bit modulus and round-trips data", () => {
    const kp = tinyRsaKeygen();
    expect(kp.publicKey.n.toString(2)).toHaveLength(40);
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 250, 251, 252]);
    expect(
      tinyRsaDecrypt(kp.publicKey.n, kp.d, tinyRsaEncrypt(kp.publicKey, data), data.length),
    ).toEqual(data);
  });

  it("Pollard's rho factors the modulus and recovers a working private exponent", () => {
    const kp = tinyRsaKeygen();
    const { p, q } = pollardRho(kp.publicKey.n);
    expect(p * q).toBe(kp.publicKey.n);
    expect(isProbablePrime(p) && isProbablePrime(q)).toBe(true);
    const d = modInverse(kp.publicKey.e, (p - 1n) * (q - 1n));
    const data = new Uint8Array([9, 8, 7]);
    expect(tinyRsaDecrypt(kp.publicKey.n, d, tinyRsaEncrypt(kp.publicKey, data), 3)).toEqual(data);
  });
});
