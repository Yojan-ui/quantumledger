import { scan } from "@qsetu/core";
import { describe, expect, it } from "vitest";
import { buildPlan, planToMarkdown } from "@/lib/live/plan";
import {
  describeTls,
  hostFromInput,
  isPrivateAddress,
  probeTls,
  type RawTls,
} from "@/lib/live/tls";

const hybrid: RawTls = {
  protocol: "TLSv1.3",
  cipher: { name: "TLS_AES_256_GCM_SHA384", standardName: "TLS_AES_256_GCM_SHA384" },
  ephemeral: { type: "TLSGroup", name: "X25519MLKEM768" },
  cert: {
    keyType: "ec",
    curve: "prime256v1",
    sigAlg: "ecdsa-with-SHA256",
    issuer: "C=US\nO=Example CA\nCN=E1",
    validTo: "Dec  4 23:29:33 2026 GMT",
  },
};
const classical: RawTls = {
  protocol: "TLSv1.2",
  cipher: {
    name: "ECDHE-RSA-AES128-GCM-SHA256",
    standardName: "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
  },
  ephemeral: { type: "ECDH", name: "X25519", size: 253 },
  cert: { keyType: "rsa", bits: 2048, sigAlg: "sha256WithRSAEncryption" },
};

describe("URL scan parsing", () => {
  it("recognises a negotiated hybrid post-quantum group", () => {
    const p = describeTls("example.com", "93.184.215.14", hybrid);
    expect(p).toMatchObject({
      hybridPq: true,
      group: "X25519MLKEM768",
      certKey: "ECDSA prime256v1",
      issuer: "Example CA",
    });
    const r = scan(p.report, p.host);
    expect(r.findings.some((f) => f.ruleId === "pqc")).toBe(true);
    expect(r.findings.some((f) => f.ruleId === "ecdh")).toBe(false);
    expect(r.findings.some((f) => f.ruleId === "ecdsa")).toBe(true);
  });

  it("flags classical key exchange and RSA certificates", () => {
    const p = describeTls("old.example", "93.184.215.14", classical);
    expect(p).toMatchObject({
      hybridPq: false,
      group: "X25519",
      certKey: "RSA 2048 bit",
      protocol: "TLSv1.2",
    });
    const r = scan(p.report, p.host);
    expect(r.findings.map((f) => f.ruleId)).toEqual(
      expect.arrayContaining(["ecdh", "rsa", "tls-suite"]),
    );
    expect(r.grade).not.toBe("Quantum-ready");
    const plan = buildPlan({
      findings: r.findings,
      dataLifetimeYears: 10,
      source: "url",
      hybridPq: false,
      year: 2026,
    });
    expect(plan.steps[0]).toMatchObject({ id: "tls-hybrid", priority: "P1", effort: "S" });
    expect(planToMarkdown(plan)).toContain("- [ ] **P1 · Turn on hybrid post-quantum key exchange");
  });

  it("only allows public hostnames and addresses", () => {
    expect(hostFromInput("https://Example.com/path?q=1")).toBe("example.com");
    expect(hostFromInput("example.com.")).toBe("example.com");
    for (const bad of [
      "localhost",
      "http://127.0.0.1",
      "10.0.0.5",
      "https://[::1]/",
      "printer.local",
      "intranet",
      "ftp://example.com",
      "https://u:p@example.com",
      "169.254.169.254",
    ])
      expect(() => hostFromInput(bad), bad).toThrow();
    for (const ip of [
      "192.168.1.1",
      "172.20.0.1",
      "100.64.0.1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "0.0.0.0",
      "224.0.0.1",
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.215.14", "1.1.1.1", "2606:4700::1111"])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("refuses hosts that resolve to private addresses (any record)", async () => {
    const connect = async () => hybrid;
    await expect(
      probeTls("rebind.example", {
        lookup: async () => [{ address: "93.184.215.14" }, { address: "10.1.2.3" }],
        connect,
      }),
    ).rejects.toThrow(/private/);
    const ok = await probeTls("safe.example", {
      lookup: async () => [{ address: "93.184.215.14" }],
      connect,
    });
    expect(ok.hybridPq).toBe(true);
  });
});
