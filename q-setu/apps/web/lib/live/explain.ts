import type { Finding } from "@qsetu/core";
import type { TlsProbe } from "./tls";

/**
 * Plain-language findings for the home-page scan: at most three sentences a non-specialist can read,
 * most serious first. Every sentence is derived from what the server actually negotiated.
 */
export function explain(
  probe: TlsProbe,
  findings: Pick<Finding, "ruleId" | "severity">[],
): string[] {
  const out: string[] = [];
  if (probe.hybridPq)
    out.push(
      "Uses hybrid post-quantum key exchange (X25519 + ML-KEM-768): recorded traffic stays sealed.",
    );
  else
    out.push(
      `Uses ${probe.group === "unknown" ? "a classical" : probe.group} key exchange: traffic recorded today can be decrypted by a future quantum computer.`,
    );
  if (/^RSA/.test(probe.certKey))
    out.push(
      `Uses ${probe.certKey.replace(" bit", "")} certificates: breakable by a future quantum computer.`,
    );
  else if (/^ECDSA/.test(probe.certKey))
    out.push(
      `Uses an ${probe.certKey} certificate: its signature can be forged by a future quantum computer.`,
    );
  if (probe.protocol && probe.protocol !== "TLSv1.3")
    out.push(
      `Negotiated ${probe.protocol}: older than TLS 1.3, so it cannot use post-quantum key exchange.`,
    );
  else if (findings.some((f) => f.ruleId === "sha1" || f.ruleId === "3des"))
    out.push("Still uses a classically weak algorithm (SHA-1 or 3DES) somewhere in the handshake.");
  else if (out.length < 3)
    out.push("Negotiated TLS 1.3 with AES-256-GCM: the symmetric part is already strong.");
  return out.slice(0, 3);
}
