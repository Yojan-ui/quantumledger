import { describe, expect, it } from "vitest";
import { SEVERITY_WEIGHT } from "@qsetu/core";
import { quantumBreaks, recommendedFixes, SCORE_WEIGHTS } from "@/lib/scan-explain";

const base = {
  host: "example.com",
  address: "93.184.216.34",
  protocol: "TLSv1.3",
  cipher: "TLS_AES_256_GCM_SHA384",
  group: "X25519",
  hybridPq: false,
  certKey: "ECDSA P-256",
  certSigAlg: "ecdsa-with-SHA256",
  issuer: "Example CA",
  validTo: "Jan 20 23:59:59 2027 GMT",
};

describe("scan explanation", () => {
  it("shows the scanner's real weights", () => expect(SCORE_WEIGHTS).toEqual(SEVERITY_WEIGHT));
  it("classical key exchange: harvest now, decrypt later; ML-KEM and ML-DSA fixes", () => {
    expect(quantumBreaks(base).map((b) => [b.part, b.safe])).toEqual([
      ["Key exchange", false],
      ["Certificate", false],
    ]);
    const f = recommendedFixes(base).join(" ");
    expect(f).toMatch(/ML-KEM-768.*FIPS 203/);
    expect(f).toMatch(/ML-DSA-65.*FIPS 204/);
  });
  it("hybrid PQ: key exchange safe, only the certificate fix; TLS 1.2 adds the protocol line", () => {
    const pq = { ...base, group: "X25519MLKEM768", hybridPq: true };
    expect(quantumBreaks(pq)[0]).toMatchObject({ part: "Key exchange", safe: true });
    expect(recommendedFixes(pq)).toHaveLength(1);
    expect(quantumBreaks({ ...base, protocol: "TLSv1.2" }).at(-1)?.part).toBe("Protocol");
  });
});
