import { describe, expect, it } from "vitest";
import {
  bytesToUtf8,
  envelopeFromJSON,
  envelopeToJSON,
  EnvelopeError,
  getKem,
  getProfile,
  getSig,
  kemComponents,
  open,
  seal,
  utf8ToBytes,
  verifyEnvelope,
  type Envelope,
  type ProfileId,
} from "../src";

const payload = utf8ToBytes(
  JSON.stringify({
    payerVPA: "ravi@bharatbank",
    payeeVPA: "anjali@sahyadri",
    amountINR: "2450.00",
  }),
);

function setup(profile: ProfileId = "standard") {
  const p = getProfile(profile);
  const recipient = getKem(p.kem).keygen();
  const signer = getSig(p.sig).keygen();
  return { recipient, signer, env: seal(payload, recipient.publicKey, { profile, signer }) };
}

function expectFail(fn: () => unknown, reason: EnvelopeError["reason"]) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(EnvelopeError);
    expect((e as EnvelopeError).reason).toBe(reason);
    return;
  }
  throw new Error("expected failure");
}

describe("envelope", () => {
  it.each(["standard", "edge"] as const)("round-trips with the %s profile", (profile) => {
    const s = setup(profile);
    expect(s.env).toMatchObject({
      v: 1,
      profile,
      algIds: { kem: getProfile(profile).kem, sig: getProfile(profile).sig },
    });
    expect(kemComponents(s.env).map((c) => c.alg)).toEqual(["x25519", getProfile(profile).pqKem]);
    expect(bytesToUtf8(open(s.env, s.recipient, { senderPublicKey: s.signer.publicKey }))).toBe(
      bytesToUtf8(payload),
    );
  });

  it("supports anonymous (unsigned) senders, as used by the Web shield", () => {
    const r = getKem("hybrid-x25519-mlkem768").keygen();
    const env = seal(payload, r.publicKey);
    expect(env.sig).toBeNull();
    expect(open(env, r)).toEqual(payload);
  });

  it("binds AAD: the same ciphertext under a different record ID fails", () => {
    const r = getKem("hybrid-x25519-mlkem768").keygen();
    const env = seal(payload, r.publicKey, { aad: utf8ToBytes("record-1") });
    expect(open(env, r, { aad: utf8ToBytes("record-1") })).toEqual(payload);
    expectFail(() => open(env, r, { aad: utf8ToBytes("record-2") }), "decrypt");
  });

  it("survives JSON serialisation", () => {
    const s = setup();
    const wire = JSON.parse(JSON.stringify(envelopeToJSON(s.env)));
    expect(
      open(envelopeFromJSON(wire), s.recipient, { senderPublicKey: s.signer.publicKey }),
    ).toEqual(payload);
  });

  it("an intermediary can verify without the recipient key", () => {
    const s = setup();
    expect(verifyEnvelope(s.env, s.signer.publicKey)).toBe(true);
    expect(verifyEnvelope(s.env, getSig("ml-dsa-65").keygen().publicKey)).toBe(false);
  });

  describe("tamper detection: flipping one byte makes open() fail", () => {
    for (const field of ["ct", "nonce", "sig", "kemCt"] as const) {
      it(field, () => {
        const s = setup();
        const bad = { ...s.env, [field]: s.env[field]!.slice() } as Envelope;
        bad[field]![field === "kemCt" ? 40 : 0]! ^= 0x01;
        expectFail(
          () => open(bad, s.recipient, { senderPublicKey: s.signer.publicKey }),
          "signature",
        );
      });
    }

    it("stripping the signature is rejected when a sender key is expected", () => {
      const s = setup();
      expectFail(
        () => open({ ...s.env, sig: null }, s.recipient, { senderPublicKey: s.signer.publicKey }),
        "signature",
      );
    });

    it("algorithm downgrade in the header", () => {
      const s = setup();
      const bad: Envelope = { ...s.env, algIds: { ...s.env.algIds, sig: "ed25519" } };
      expectFail(
        () => open(bad, s.recipient, { senderPublicKey: s.signer.publicKey }),
        "algorithm",
      );
    });
  });

  it("rejects an envelope addressed to someone else", () => {
    const s = setup();
    expectFail(() => open(s.env, getKem("hybrid-x25519-mlkem768").keygen()), "recipient");
  });
});
