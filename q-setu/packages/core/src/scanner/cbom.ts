/**
 * Builds a CycloneDX 1.6 Cryptography Bill of Materials (CBOM) from scanner findings.
 * Spec: https://cyclonedx.org/docs/1.6/json/ (component type "cryptographic-asset").
 */
import type { Finding } from "./scanner";

export interface Cbom {
  bomFormat: "CycloneDX";
  specVersion: "1.6";
  serialNumber: string;
  version: number;
  metadata: Record<string, unknown>;
  components: Record<string, unknown>[];
}

const CDX_PRIMITIVE: Record<string, string> = {
  pke: "pke",
  signature: "signature",
  "key-agree": "key-agree",
  kem: "kem",
  hash: "hash",
  "block-cipher": "block-cipher",
};

function pqcLevel(f: Finding): number {
  if (!f.quantumSafe) return 0;
  const m = /(?:KEM|DSA)-?(\d+)/i.exec(f.match)?.[1];
  return (
    ({ "512": 1, "44": 2, "768": 3, "65": 3, "1024": 5, "87": 5 } as Record<string, number>)[
      m ?? ""
    ] ?? 3
  );
}

export function buildCbom(findings: Finding[], sourceName: string): Cbom {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = f.ruleId === "tls-suite" ? `tls:${f.match}` : `${f.ruleId}:${f.parameter ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  const components = [...groups.entries()].map(([key, fs]) => {
    const f = fs[0]!;
    const isProtocol = f.primitive === "protocol";
    const cryptoProperties = isProtocol
      ? {
          assetType: "protocol",
          protocolProperties: {
            type: "tls",
            ...(f.ruleId === "tls-suite" ? { cipherSuites: [{ name: f.match }] } : {}),
          },
        }
      : {
          assetType: "algorithm",
          algorithmProperties: {
            primitive: CDX_PRIMITIVE[f.primitive] ?? "other",
            ...(f.parameter ? { parameterSetIdentifier: f.parameter } : {}),
            nistQuantumSecurityLevel: pqcLevel(f),
          },
        };
    return {
      type: "cryptographic-asset",
      "bom-ref": `crypto:${key}`,
      name: f.ruleId === "tls-suite" ? f.match : f.algorithm,
      cryptoProperties,
      evidence: {
        occurrences: fs.map((o) => ({
          location: sourceName,
          line: o.line,
          offset: o.column,
          symbol: o.match,
        })),
      },
      properties: [
        { name: "qsetu:severity", value: f.severity },
        { name: "qsetu:quantumVulnerable", value: String(f.quantumVulnerable) },
        { name: "qsetu:recommendation", value: f.replacement },
      ],
    };
  });

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${globalThis.crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: {
        components: [{ type: "application", name: "Q-Setu Readiness Scanner", version: "0.1.0" }],
      },
      component: { type: "file", name: sourceName, "bom-ref": "scan-target" },
    },
    components,
  };
}
