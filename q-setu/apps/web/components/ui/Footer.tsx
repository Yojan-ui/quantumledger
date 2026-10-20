import Link from "next/link";
import { BENCH_NOTE, MAP_NOTE, SHOWN } from "@/data/facts";
import { Container, Grid } from "./layout";
import { Logo } from "./Logo";
import { Label } from "./type";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Product",
    links: [
      ["Platform", "/platform"],
      ["Pricing", "/pricing"],
      ["Readiness scanner", "/demo/scanner"],
      ["Changelog", "/changelog"],
    ],
  },
  {
    title: "Solutions",
    links: [
      ["Fintech", "/solutions/fintech"],
      ["Healthcare", "/solutions/healthcare"],
      ["Education", "/solutions/education"],
      ["Government", "/solutions/government"],
    ],
  },
  {
    title: "Developers",
    links: [
      ["Quickstart", "/docs"],
      ["Adapters", "/docs/adapters/shield"],
      ["API reference", "/docs/api"],
      ["Demos", "/demos"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Security", "/security"],
      ["Contact", "/contact"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line py-24">
      <Container>
        <Grid className="gap-y-12">
          <div className="col-span-12 md:col-span-4">
            <Logo />
          </div>
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title} className="col-span-6 md:col-span-2">
              <Label as="p" className="mb-4">
                {c.title}
              </Label>
              <ul className="space-y-2">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("http") || href.startsWith("/api/") ? (
                      <a
                        href={href}
                        className="link-u text-small text-fg-3 transition-colors duration-150 hover:text-fg"
                      >
                        {label}
                      </a>
                    ) : (
                      <Link
                        href={href}
                        className="link-u text-small text-fg-3 transition-colors duration-150 hover:text-fg"
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </Grid>
        <div className="mt-24 border-t border-line pt-8">
          <Label as="p" className="mb-4">
            Sources
          </Label>
          <ol className="space-y-2 text-small text-fg-3">
            {SHOWN.map((f, i) => (
              <li key={f.id} id={`fact-${i + 1}`}>
                {i + 1}. {f.claim} {f.source}, as of {f.asOf}.{" "}
                <a
                  href={f.url}
                  className="underline decoration-line-strong underline-offset-4 hover:text-fg"
                >
                  Source
                </a>
              </li>
            ))}
            <li id={`fact-${BENCH_NOTE}`}>
              {BENCH_NOTE}. Handshake, per-message and byte figures, and every number in the live
              strip and consoles: measured live by <span className="font-mono">/api/bench</span> and{" "}
              <span className="font-mono">/api/metrics</span> on the server serving this page.
            </li>
            <li id={`fact-${MAP_NOTE}`}>
              {MAP_NOTE}. Globe: Natural Earth admin-0 countries, India point of view (public
              domain).
            </li>
          </ol>
          <p className="mt-8 text-small text-fg-3">
            QuantumLedger is an early-stage project, not yet audited. Not affiliated with or
            endorsed by NIST, NPCI, NHA, MeitY or the National Quantum Mission.
          </p>
        </div>
      </Container>
    </footer>
  );
}
