import { describe, expect, it } from "vitest";
import {
  demoWebShieldKeys,
  isSealed,
  openSealedBody,
  publicKeysOf,
  sealBody,
  signResponse,
  SEALED_CONTENT_TYPE,
  verifyResponse,
} from "../src";

const enc = new TextEncoder();

describe("Q-Setu Web", () => {
  const keys = demoWebShieldKeys();
  const pub = publicKeysOf(keys);

  it("demo keys are stable, so a static page can pin the key ID", () => {
    expect(publicKeysOf(demoWebShieldKeys()).kid).toBe(pub.kid);
  });

  it("browser seals a form body; server opens it and restores the content type", () => {
    const form = enc.encode("name=Asha+Rao&aadhaarLast4=1234&amount=5000");
    const sealed = sealBody(form, "application/x-www-form-urlencoded", pub);
    expect(sealed.body).not.toContain("Asha");
    expect(isSealed(SEALED_CONTENT_TYPE)).toBe(true);
    const opened = openSealedBody(sealed.body, keys);
    expect(opened.bytes).toEqual(form);
    expect(opened.contentType).toBe("application/x-www-form-urlencoded");
  });

  it("signed response verifies only for the matching request and body", () => {
    const sealed = sealBody(enc.encode("x=1"), "text/plain", pub);
    const opened = openSealedBody(sealed.body, keys);
    const body = enc.encode('{"ok":true}');
    const sig = signResponse(body, opened.nonce, keys);
    expect(verifyResponse(body, sig, sealed.nonce, pub)).toBe(true);
    expect(verifyResponse(enc.encode('{"ok":false}'), sig, sealed.nonce, pub)).toBe(false);
    expect(verifyResponse(body, sig, new Uint8Array(12), pub)).toBe(false);
  });

  it("a flipped byte in the sealed body is rejected", () => {
    const sealed = JSON.parse(sealBody(enc.encode("x=1"), "text/plain", pub).body);
    const ct = Buffer.from(sealed.envelope.ct, "base64");
    ct[0]! ^= 1;
    sealed.envelope.ct = ct.toString("base64");
    expect(() => openSealedBody(JSON.stringify(sealed), keys)).toThrow(/Decryption failed/);
  });
});
