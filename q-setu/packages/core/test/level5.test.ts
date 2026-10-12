import { describe, expect, it } from "vitest";
import {
  clientFinish,
  clientHello,
  createIdentity,
  getKem,
  getProfile,
  getSig,
  open,
  seal,
  serverComplete,
  serverRespond,
  utf8ToBytes,
} from "../src";

// L5 (the `maximum` profile): NIST category 5, ML-KEM-1024 and ML-DSA-87.
describe("maximum profile (L5)", () => {
  it("pins category-5 algorithms with the FIPS sizes", () => {
    const p = getProfile("maximum");
    expect(p.kem).toBe("hybrid-x25519-mlkem1024");
    expect(p.sig).toBe("ml-dsa-87");
    const kem = getKem("ml-kem-1024");
    expect(kem.nistLevel).toBe(5);
    const kp = kem.keygen();
    expect(kp.publicKey.length).toBe(1568);
    const { ciphertext, sharedSecret } = kem.encapsulate(kp.publicKey);
    expect(ciphertext.length).toBe(1568);
    expect(kem.decapsulate(ciphertext, kp.secretKey)).toEqual(sharedSecret);
    const sig = getSig("ml-dsa-87");
    const k = sig.keygen();
    const s = sig.sign(utf8ToBytes("level 5"), k.secretKey);
    expect(s.length).toBe(4627);
    expect(sig.verify(s, utf8ToBytes("level 5"), k.publicKey)).toBe(true);
    expect(sig.verify(s, utf8ToBytes("level 6"), k.publicKey)).toBe(false);
  });

  it("runs a full hybrid handshake and a signed envelope", () => {
    const id = createIdentity("maximum");
    const c = clientHello("maximum");
    const s = serverRespond(c.hello, id);
    const f = clientFinish(c.state, s.serverHello, id.publicKey);
    const server = serverComplete(s.pending, f.finish);
    const m = f.session.seal(utf8ToBytes("hi"));
    expect(server.open(m)).toEqual(utf8ToBytes("hi"));
    const rcpt = getKem("hybrid-x25519-mlkem1024").keygen();
    const signer = getSig("ml-dsa-87").keygen();
    const env = seal(utf8ToBytes("record"), rcpt.publicKey, { profile: "maximum", signer });
    expect(open(env, rcpt, { senderPublicKey: signer.publicKey })).toEqual(utf8ToBytes("record"));
  });
});
