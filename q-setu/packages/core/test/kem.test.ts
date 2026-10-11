import { describe, expect, it } from "vitest";
import { combineSecrets, getKem, registry } from "../src";

describe("KEM round-trip", () => {
  for (const alg of Object.values(registry.kem)) {
    it(`${alg.id}: decapsulate(encapsulate(pk)) yields the same 32-byte secret`, () => {
      const kp = alg.keygen();
      const { ciphertext, sharedSecret } = alg.encapsulate(kp.publicKey);
      expect(ciphertext.length).toBe(alg.sizes.output);
      expect(kp.publicKey.length).toBe(alg.sizes.publicKey);
      expect(sharedSecret.length).toBe(32);
      expect(alg.decapsulate(ciphertext, kp.secretKey)).toEqual(sharedSecret);
    });

    it(`${alg.id}: a different recipient derives a different secret`, () => {
      const a = alg.keygen();
      const b = alg.keygen();
      const { ciphertext, sharedSecret } = alg.encapsulate(a.publicKey);
      expect(alg.decapsulate(ciphertext, b.secretKey)).not.toEqual(sharedSecret);
    });
  }

  it.each(["hybrid-x25519-mlkem768", "hybrid-x25519-mlkem512"])(
    "%s: tampering with either component changes the key",
    (id) => {
      const kem = getKem(id);
      const kp = kem.keygen();
      const { ciphertext, sharedSecret } = kem.encapsulate(kp.publicKey);
      for (const idx of [5, 32 + 100]) {
        const bad = ciphertext.slice();
        bad[idx]! ^= 0x01;
        expect(kem.decapsulate(bad, kp.secretKey)).not.toEqual(sharedSecret);
      }
    },
  );

  it("combiner: output depends on both secrets", () => {
    const zero = new Uint8Array(32);
    const one = new Uint8Array(32).fill(1);
    const t = new Uint8Array(0);
    const base = combineSecrets(zero, zero, t);
    expect(combineSecrets(one, zero, t)).not.toEqual(base);
    expect(combineSecrets(zero, one, t)).not.toEqual(base);
  });
});

describe("seeded keygen", () => {
  it("same seed → same keys; different seed → different keys", () => {
    const seed = new Uint8Array(32).fill(1);
    for (const alg of [...Object.values(registry.kem), ...Object.values(registry.sig)]) {
      expect(alg.keygen(seed).publicKey).toEqual(alg.keygen(seed).publicKey);
      expect(alg.keygen(new Uint8Array(32).fill(2)).publicKey).not.toEqual(
        alg.keygen(seed).publicKey,
      );
    }
  });
});
