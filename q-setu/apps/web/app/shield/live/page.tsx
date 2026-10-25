import { LiveRun } from "@/components/shield/LiveRun";
import { Container, PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Shield, live under attack",
  description:
    "The same attacks against an old bank app twice: bare, and behind Shield Edge. A burst, a route scan, injection payloads, honeypots and a canary key, an AI crawler, and a TLS check.",
  path: "/shield/live",
});

export default function ShieldLive() {
  return (
    <PageShell>
      <PageHero
        label="Shield · live"
        title="Same app. Same attacks. One has Shield in front."
        lead="Press run: this server attacks its own copy of an unmodified legacy bank app, bare and behind Shield Edge, and shows what each attacker got."
      />
      <section className="border-b border-line py-12 md:py-16">
        <Container>
          <LiveRun />
        </Container>
      </section>
    </PageShell>
  );
}
