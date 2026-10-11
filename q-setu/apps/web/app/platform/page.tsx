import { Architecture } from "@/components/platform/Architecture";
import { Features } from "@/components/platform/Features";
import {
  Block,
  ButtonLink,
  Code,
  Container,
  Lines,
  PageHero,
  PageShell,
  TextLink,
} from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Platform",
  description:
    "One core, five adapters, one algorithm registry: how Q-Setu adds hybrid ML-KEM key exchange and ML-DSA signatures to any system.",
  path: "/platform",
});

const PROFILES = `// packages/core/src/registry.ts
standard: hybrid-x25519-mlkem768 · ml-dsa-65   // NIST category 3
edge:     hybrid-x25519-mlkem512 · ml-dsa-44   // categories 1–2, for devices
// signatures can be swapped to slh-dsa-sha2-128f (FIPS 205) at runtime`;

export default function Platform() {
  return (
    <PageShell>
      <PageHero
        label="Platform"
        title="One core. Five ways in."
        lead="Every adapter shares one crypto core and one algorithm registry, so adopting post-quantum cryptography is a deployment, not a rewrite."
        globe
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/docs">Read the quickstart</ButtonLink>
          <ButtonLink href="/demos" variant="secondary">
            See it live
          </ButtonLink>
        </div>
      </PageHero>
      <section className="border-b border-line py-16 md:py-24">
        <Container>
          <Architecture />
        </Container>
      </section>
      <Block label="The core" title="Hybrid by default.">
        <p>
          Sessions start with an X25519 + ML-KEM-768 key exchange (FIPS 203), authenticated by an
          ML-DSA-65 signature (FIPS 204). Both shared secrets feed HKDF, so the session stays safe
          if either half holds. After the handshake every message is AES-256-GCM: microseconds, 44
          bytes of overhead.
        </p>
        <Lines
          items={[
            "Forward secrecy: ephemeral keys per session, erased after the handshake",
            "Replay protection and a per-epoch key ratchet",
            "One-shot envelopes for forms, files and records; detached ML-DSA signatures",
          ]}
        />
      </Block>
      <Block label="Crypto agility" title="Change algorithms without a restart.">
        <p>
          Call sites ask the registry for a profile, never for an algorithm. A policy change (for
          example, standard → edge, or ML-DSA → SLH-DSA) reaches live sessions at their next key
          rotation.
        </p>
        <Code code={PROFILES} copy={false} />
        <TextLink href="/demo/how-it-works">Try the hot-swap in Demo 1 →</TextLink>
      </Block>
      <Features />
    </PageShell>
  );
}
