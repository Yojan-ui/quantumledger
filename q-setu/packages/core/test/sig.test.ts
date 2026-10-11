import { describe, expect, it } from "vitest";
import { registry, utf8ToBytes } from "../src";

describe("signatures", () => {
  const msg = utf8ToBytes('{"txnId":"QST1","amountINR":"500.00"}');

  for (const alg of Object.values(registry.sig)) {
    it(`${alg.id}: valid signature verifies`, () => {
      const kp = alg.keygen();
      const sig = alg.sign(msg, kp.secretKey);
      expect(sig.length).toBe(alg.sizes.output);
      expect(alg.verify(sig, msg, kp.publicKey)).toBe(true);
    });

    it(`${alg.id}: tampered message, tampered signature and wrong key all fail`, () => {
      const kp = alg.keygen();
      const sig = alg.sign(msg, kp.secretKey);
      const badMsg = msg.slice();
      badMsg[3]! ^= 0xff;
      const badSig = sig.slice();
      badSig[10]! ^= 0x01;
      expect(alg.verify(sig, badMsg, kp.publicKey)).toBe(false);
      expect(alg.verify(badSig, msg, kp.publicKey)).toBe(false);
      expect(alg.verify(sig, msg, alg.keygen().publicKey)).toBe(false);
    });
  }
});
