import results from "@qsetu/shield-edge/bench-results";
import { Block, ButtonLink, Code, Container, Lines, PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Shield",
  description:
    "Quantum-safe encryption (X25519MLKEM768) and AI-agent defence in front of any website: one DNS change, one container, or one line of code.",
  path: "/shield",
});

const DNS = `# 1. Prove you own the name (token from the dashboard)
TXT    _qsetu-challenge.www.example.com   "qsetu-verify=<token>"
# 2. Send the traffic through Shield Edge
CNAME  www.example.com                    edge.quantumledger.app`;

const DOCKER = `docker run -p 443:8443 -p 80:8080 -v shield:/data \\
  -e EDGE_ORIGIN=http://your-app:3000 -e EDGE_DOMAINS=www.example.com \\
  -e SHIELD_KEK="$(openssl rand -base64 48)" -e ACME_EMAIL=you@example.com \\
  quantumledger/shield`;

const CODE = `import { shield } from "@qsetu/shield";
app.use(shield({ siteKey: process.env.QSETU_SITE_KEY }));   // Express, Fastify, Next.js`;

const ms = (n: number) => `${n.toFixed(n < 1 ? 3 : 2)} ms`;

export default function ShieldPage() {
  const r = results;
  return (
    <PageShell>
      <PageHero
        label="Shield"
        title="Quantum-safe encryption and AI-agent defence in front of any website."
        lead={`One DNS change. Adds under 2 ms: measured +${ms(r.warm.added.p50)} median and +${ms(r.warm.added.p95)} at p95 on a warm connection, on loopback (network distance to the edge not included).`}
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/app">Open the dashboard</ButtonLink>
          <ButtonLink href="/shield/live" variant="secondary">
            Watch it under attack
          </ButtonLink>
        </div>
      </PageHero>

      <Block label="Install" title="Three ways in. Pick one.">
        <p>
          1 · DNS: Shield Edge terminates TLS for you. Post-quantum TLS and defence, nothing to
          install.
        </p>
        <Code code={DNS} className="mt-3" wrap />
        <p className="mt-8">2 · Container: the same edge on your own server.</p>
        <Code code={DOCKER} className="mt-3" wrap />
        <p className="mt-8">
          3 · One line in your app: the defence engine only. A middleware runs after TLS has ended,
          so the post-quantum key exchange needs route 1 or 2.
        </p>
        <Code code={CODE} className="mt-3" wrap />
      </Block>

      <Block label="Honest scope" title="What it does, and what it doesn't.">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-medium text-fg">Does</p>
            <Lines
              items={[
                "TLS 1.3 with X25519MLKEM768 for every browser that offers it (current Chrome, Edge, Firefox, Safari); X25519 or P-256 for the rest",
                "Counts, per connection, which key exchange was used: the dashboard shows the % quantum-safe",
                "Scores behaviour (rate, routes walked, failures, bursts, header and TLS fingerprint consistency) and acts in steps: limit, proof-of-work challenge, block",
                "Honeypot routes, a hidden trap link and a canary API key that block and alert on first touch",
                "Lets search engines through only when DNS confirms they are who they claim",
                "New sites start in Monitor: nothing is blocked until you switch",
              ]}
            />
          </div>
          <div>
            <p className="font-medium text-fg">Does not</p>
            <Lines
              items={[
                "Make certificates post-quantum: browsers don't accept those yet, so certificates stay ECDSA",
                "Protect the hop from the edge to your origin beyond that hop's own TLS (keep it private, or use https to the origin)",
                "Stop a patient agent that drives a real browser at human speed: it looks like a person",
                "Replace a WAF for injection payloads: the OWASP Core Rule Set runs as an optional container beside the edge",
                "Absorb volumetric DDoS: that needs your provider's network-level protection",
                "Make a site unattackable. It makes attacks slower, noisier and caught sooner",
              ]}
            />
          </div>
        </div>
      </Block>

      <Block label="Measured" title="What it costs.">
        <p>
          {r.cpu}, Node {r.node}, OpenSSL {r.openssl}, everything on loopback, the legacy bank app
          as origin. The benchmark fails the build if a budget is missed.
        </p>
        <Lines
          items={[
            `Added latency, warm connection: +${ms(r.warm.added.p50)} median, +${ms(r.warm.added.p95)} p95 (budget ≤ 2 ms / ≤ 10 ms)`,
            `Extra server CPU for a post-quantum handshake vs X25519 alone: +${ms(r.handshake.extraCpuMs)} (budget ≤ 1.5 ms)`,
            `Edge CPU at a steady 1,000 requests a second: ${(r.load.edgeCpuShareOfOneCore * 100).toFixed(1)}% of one core (budget ≤ 10%)`,
            `A returning visitor's resumed connection, connect to response: ${ms(r.resumed.p50)} median`,
            `Memory per idle connection: about ${r.idle.rssPerConnectionKiB} KiB (a noisy measurement; an upper bound)`,
          ]}
        />
        <p className="mt-4">
          Each number is re-measured by <code>pnpm --filter @qsetu/shield-edge bench</code>; the
          method is in the repository&apos;s docs/real/benchmarks.md.
        </p>
      </Block>

      <section className="border-t border-line py-16 md:py-24">
        <Container className="flex flex-wrap gap-3">
          <ButtonLink href="/shield/live">Run the attack suite</ButtonLink>
          <ButtonLink href="/app" variant="secondary">
            Add your site
          </ButtonLink>
        </Container>
      </section>
    </PageShell>
  );
}
