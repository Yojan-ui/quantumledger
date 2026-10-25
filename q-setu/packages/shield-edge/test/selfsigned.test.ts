import { X509Certificate } from "node:crypto";
import tls from "node:tls";
import { describe, expect, it } from "vitest";
import { selfSignedCert } from "../src/selfsigned";

describe("selfSignedCert", () => {
  it("makes a certificate Node parses, valid now, with every name, signed by its own key", () => {
    const { key, cert } = selfSignedCert(["a.test", "b.test"]);
    const x = new X509Certificate(cert);
    expect(x.subject).toBe("CN=a.test");
    expect(x.subjectAltName).toBe("DNS:a.test, DNS:b.test");
    expect(x.checkHost("b.test")).toBe("b.test");
    expect(new Date(x.validFrom).getTime()).toBeLessThan(Date.now());
    expect(new Date(x.validTo).getTime()).toBeGreaterThan(Date.now());
    expect(x.verify(x.publicKey)).toBe(true);
    expect(x.publicKey.asymmetricKeyDetails?.namedCurve).toBe("prime256v1");
    expect(() => tls.createSecureContext({ key, cert })).not.toThrow();
  });
});
