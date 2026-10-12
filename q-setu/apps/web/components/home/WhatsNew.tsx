import Link from "next/link";
import { Container, SectionLabel } from "@/components/ui";
import { Copy, CopyHeading } from "@/components/ui/Copy";
import { ROLES, type Role } from "@/components/ui/Role";

/** What we built that's new, and, just as plainly, what we didn't invent. */
const NEW: {
  role: Role;
  title: { simple: string; technical: string };
  simple: string;
  technical: string;
  href: string;
}[] = [
  {
    role: "kem",
    title: { simple: "Add it without rebuilding", technical: "Zero-code deployment layer" },
    simple:
      "Five ways to add quantum-safe locks in front of systems that already run, from one line of setup.",
    technical:
      "Shield, Web, SDK, Edge and Vault adapters put hybrid ML-KEM and ML-DSA in front of unchanged servers, sites, apps, devices and databases.",
    href: "/platform",
  },
  {
    role: "ok",
    title: {
      simple: "A map of how ready India is",
      technical: "India Quantum Readiness Index",
    },
    simple:
      "We checked 100 public Indian websites in five sectors and show how many already use quantum-safe locks.",
    technical:
      "Sector aggregates from one TLS handshake per public domain: hybrid key-exchange share, TLS 1.3 share, RSA-2048 certificates.",
    href: "/index",
  },
  {
    role: "sig",
    title: {
      simple: "A record book nobody can quietly edit",
      technical: "Quantum-safe signed Q-Ledger",
    },
    simple:
      "Every action is written down, chained and signed, so a single changed entry is caught at once.",
    technical:
      "An append-only audit log: a SHA3-256 hash chain with every entry signed with ML-DSA-65, verified end to end on demand.",
    href: "/demo/ledger",
  },
  {
    role: "warn",
    title: { simple: "Proof you can watch", technical: "Live, visual proof" },
    simple:
      "The encryption you see here runs for real, right now, and you can try it yourself from your phone.",
    technical:
      "Every crypto timing and size is measured live (seal, open, sign, verify) and streamed to the globe; no demo is a recorded animation.",
    href: "/demos",
  },
];

export function WhatsNew({ index }: { index: string }) {
  return (
    <section id="whats-new" className="relative scroll-mt-14 py-24 md:py-40">
      <Container>
        <SectionLabel index={index} label="What's new here" role="sig" />
        <CopyHeading
          simple="What Q-Setu adds that's new."
          technical="What's new: deployment, measurement, audit and proof."
          className="max-w-text"
        />
        <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {NEW.map((n) => (
            <li
              key={n.href}
              data-tilt
              className="spotlight rounded-lg border border-line p-6 transition-colors duration-150 hover:border-line-strong"
            >
              <Link href={n.href} className="block h-full">
                <span
                  aria-hidden
                  className={`block h-dot w-dot rounded-full ${ROLES[n.role].bg}`}
                />
                <h3 className="mt-6 text-h3 font-medium text-fg">
                  <Copy simple={n.title.simple} technical={n.title.technical} />
                </h3>
                <p className="mt-3 text-small text-fg-2">
                  <Copy simple={n.simple} technical={n.technical} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-text text-small text-fg-3" data-not-invented>
          What we didn&apos;t invent: ML-KEM and ML-DSA are NIST standards (FIPS 203/204). We built
          on vetted open-source implementations.
        </p>
      </Container>
    </section>
  );
}
