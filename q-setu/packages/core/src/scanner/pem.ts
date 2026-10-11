/**
 * Peeks inside PEM blocks (certificates, keys, CSRs) by base64-decoding them and looking
 * for well-known algorithm OIDs in the DER bytes. This isn't a full ASN.1 parse, but it
 * reliably tells RSA, EC and ML-DSA keys apart without any dependency.
 */

export interface PemHit {
  line: number;
  label: string;
  oids: { name: string; ruleId: string }[];
}

// DER-encoded OBJECT IDENTIFIER values (tag 06 + length + body), as hex.
const OIDS: { hex: string; name: string; ruleId: string }[] = [
  { hex: "06092a864886f70d010101", name: "rsaEncryption", ruleId: "rsa" },
  { hex: "06092a864886f70d01010b", name: "sha256WithRSAEncryption", ruleId: "rsa" },
  { hex: "06092a864886f70d010105", name: "sha1WithRSAEncryption", ruleId: "sha1" },
  { hex: "06092a864886f70d01010a", name: "RSASSA-PSS", ruleId: "rsa" },
  { hex: "06072a8648ce3d0201", name: "id-ecPublicKey", ruleId: "ecdsa" },
  { hex: "06082a8648ce3d040302", name: "ecdsa-with-SHA256", ruleId: "ecdsa" },
  { hex: "06082a8648ce3d040303", name: "ecdsa-with-SHA384", ruleId: "ecdsa" },
  { hex: "06072a8648ce380401", name: "id-dsa", ruleId: "dsa" },
  { hex: "0609608648016503040312", name: "id-ml-dsa-65", ruleId: "pqc" },
  { hex: "0609608648016503040402", name: "id-alg-ml-kem-768", ruleId: "pqc" },
];

function base64ToHex(b64: string): string | undefined {
  try {
    const bin = globalThis.atob(b64);
    let hex = "";
    for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
    return hex;
  } catch {
    return undefined;
  }
}

export function scanPemBlocks(lines: string[]): PemHit[] {
  const hits: PemHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const begin = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(lines[i]!);
    if (!begin) continue;
    const label = begin[1]!;
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && !lines[j]!.includes("-----END")) body.push(lines[j++]!.trim());
    const hex = base64ToHex(body.join(""));
    if (hex) {
      const oids = OIDS.filter((o) => hex.includes(o.hex)).map(({ name, ruleId }) => ({
        name,
        ruleId,
      }));
      hits.push({ line: i + 1, label, oids });
    }
    i = j;
  }
  return hits;
}

/** True for lines that are just base64 payload, which would otherwise cause false positives. */
export const isBase64Body = (line: string) => /^[A-Za-z0-9+/=]{40,}$/.test(line.trim());
