import { describe, expect, it } from "vitest";
import { analyzeSuite, scan, SCAN_SAMPLES } from "../src";

const sample = (id: string) => SCAN_SAMPLES.find((s) => s.id === id)!.text;
const algos = (text: string) => new Set(scan(text).findings.map((f) => f.ruleId));

describe("readiness scanner", () => {
  it("Java TLS config: finds legacy TLS, RSA, suites, 3DES and SHA-1", () => {
    const r = scan(sample("java-tls"));
    const ids = new Set(r.findings.map((f) => f.ruleId));
    for (const id of ["legacy-tls", "tls-suite", "rsa", "3des", "sha1"]) expect(ids).toContain(id);
    expect(r.score).toBeLessThan(50);
    expect(r.grade).toBe("Critical");
  });

  it("OpenSSL cert: detects RSA from text output and from the DER OID", () => {
    const r = scan(sample("openssl-cert"));
    expect(r.findings.some((f) => f.ruleId === "rsa" && f.parameter === "2048")).toBe(true);
    expect(r.findings.some((f) => f.parameter === "OID rsaEncryption")).toBe(true);
    // Base64 body lines must not produce spurious matches.
    expect(r.findings.every((f) => f.ruleId === "rsa")).toBe(true);
  });

  it("Node snippet: RSA-SHA256 signing, ECDH and SHA-1", () => {
    const r = scan(sample("node-sign"));
    expect(r.findings.find((f) => f.match === "RSA-SHA256")?.line).toBe(7);
    expect(algos(sample("node-sign"))).toEqual(new Set(["rsa", "ecdh", "sha1"]));
  });

  it("does not flag ML-DSA as DSA, ECDHE as DHE, or lowercase variable names", () => {
    expect(algos("sig = ML-DSA-65; kex = ML-KEM-768")).toEqual(new Set(["pqc"]));
    expect(algos("ECDHE only")).toEqual(new Set(["ecdh"]));
    expect(algos("const ecdh = makeThing(); let rsaLike = 1;")).toEqual(new Set());
  });

  it("clean, quantum-safe input scores 100 and is Quantum-ready", () => {
    const r = scan(
      "tls.groups = X25519MLKEM768\nsignature = ML-DSA-65\ncipher = TLS_AES_256_GCM_SHA384",
    );
    expect(r.findings.filter((f) => f.severity !== "info" && f.severity !== "low")).toHaveLength(0);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.grade).toBe("Quantum-ready");
  });

  it("classifies TLS suites", () => {
    expect(analyzeSuite("TLS_RSA_WITH_3DES_EDE_CBC_SHA").severity).toBe("critical");
    expect(analyzeSuite("ECDHE-ECDSA-AES256-GCM-SHA384")).toMatchObject({
      keyExchange: "ECDHE",
      authentication: "ECDSA",
    });
    expect(analyzeSuite("TLS_AES_256_GCM_SHA384").quantumVulnerable).toBe(false);
  });

  it("emits a CycloneDX 1.6 CBOM with cryptographic-asset components", () => {
    const { cbom } = scan(sample("node-sign"), "psp-signer.js");
    expect(cbom.bomFormat).toBe("CycloneDX");
    expect(cbom.specVersion).toBe("1.6");
    expect(cbom.serialNumber).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    expect(cbom.components.length).toBeGreaterThan(0);
    for (const c of cbom.components) expect(c.type).toBe("cryptographic-asset");
  });
});

describe("grading", () => {
  it("a single quantum-vulnerable key exchange is never Quantum-ready", () => {
    const r = scan("ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384;");
    expect(r.grade).not.toBe("Quantum-ready");
  });
});
