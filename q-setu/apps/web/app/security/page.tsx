import Link from "next/link";
import { Block, Lines, PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Security",
  description:
    "What's real and what's simulated in QuantumLedger, the threat model, the libraries it builds on and their audit status, and how to report a vulnerability.",
  path: "/security",
});

const LIBS: [string, string][] = [
  [
    "@noble/post-quantum 0.7 (ML-KEM, ML-DSA, SLH-DSA)",
    "Not independently audited. Self-audited by its author at 0.6.1 (April 2026). Does not claim constant-time execution.",
  ],
  [
    "@noble/curves 2.4 (X25519, Ed25519, P-256)",
    "Audited by Trail of Bits (2.3.0, 2026), Cure53 (1.6.0, 2024) and Kudelski Security (1.2.0, 2023).",
  ],
  ["@noble/hashes 2.4 (SHA-2, SHA-3, HKDF)", "Audited by Cure53 (1.0.0, 2022)."],
  ["@noble/ciphers 2.4 (AES-256-GCM)", "Audited by Cure53 (1.0.0, 2024)."],
];

export default function Security() {
  return (
    <PageShell>
      <PageHero
        label="Security"
        title="What we protect, what we don’t, and what’s simulated."
        lead="QuantumLedger is early-stage and has not had an independent security audit. This page says exactly what that means."
      />
      <Block label="Real" title="What runs for real.">
        <Lines
          items={[
            "Every post-quantum and classical primitive, from the @noble libraries below; no cryptography written from scratch",
            "The hybrid combiner, the ML-DSA-authenticated handshake, the AES-256-GCM record layer, replay protection and the key ratchet",
            "All five adapters, the Proof Chain hash chain and signatures, the KMS key wrapping and rotation, the URL scanner",
            "Every number on the site: measured on the serving machine, or cited with a source",
          ]}
        />
      </Block>
      <Block label="Simulated" title="What is a demonstration.">
        <Lines
          items={[
            "The classical “today” system in Demo 3 uses a deliberately tiny ~40-bit RSA key (packages/sim/src/classical, INSECURE_DEMO_ONLY) so a browser can factor it. It stands in for Shor’s algorithm on RSA-2048.",
            "A simulated Shor oracle hands the attacker the X25519 secrets. The attack on QuantumLedger traffic then runs the real key schedule and fails.",
            "Edge device budgets are accounted, not enforced by hardware. Demo institutions and people are fictional.",
            "The ledger’s “tamper” button is a demo-only endpoint. The demo KMS keeps its key-encryption key on disk unless QSETU_KMS_KEK is set; production should use an HSM.",
          ]}
        />
      </Block>
      <Block label="Threat model" title="Who we defend against.">
        <p>
          <span className="text-fg">In scope:</span> a network adversary who records encrypted
          traffic today and gains a cryptographically relevant quantum computer later (harvest now,
          decrypt later); an active on-path attacker who tampers with or replays messages; an
          insider with database access who edits stored records or audit logs.
        </p>
        <p>
          <span className="text-fg">Out of scope:</span> a compromised endpoint (malware on the
          client or server sees plaintext), side channels against the JavaScript implementations
          (they are not constant-time), denial of service, and attacks on the certificate PKI that
          TLS itself relies on.
        </p>
      </Block>
      <Block label="Libraries" title="What we build on, and their audit status.">
        <div className="border-b border-line">
          {LIBS.map(([lib, status]) => (
            <div
              key={lib}
              className="grid grid-cols-1 gap-1 border-t border-line py-4 md:grid-cols-2 md:gap-6"
            >
              <p className="font-mono text-small text-fg">{lib}</p>
              <p className="text-small text-fg-2">{status}</p>
            </div>
          ))}
        </div>
        <p className="text-small">
          Statuses are taken from each library’s own security notes, as of October 2026.
        </p>
      </Block>
      <Block label="Responsible disclosure" title="Found something? Tell us first.">
        <p>
          Email the address in our{" "}
          <Link href="/.well-known/security.txt" className="text-fg underline underline-offset-4">
            security.txt
          </Link>{" "}
          with steps to reproduce. We’ll acknowledge within three working days, keep you updated,
          and credit you when the fix ships, unless you’d rather we didn’t. Please don’t test
          against other people’s data, and give us reasonable time to fix before disclosure.
        </p>
      </Block>
    </PageShell>
  );
}
