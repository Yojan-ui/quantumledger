import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Container, Grid } from "./layout";
import { Nav } from "./Nav";
import { Label, Text } from "./type";
import { Breadcrumb, NextStep, PagePurpose } from "./Wayfinding";

/** Every content page: nav, main, its next step, footer. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main">{children}</main>
      <NextStep />
      <Footer />
    </>
  );
}

/**
 * Page header: mono label, one-sentence h1, a short lead. With `globe`, the right columns become the
 * page's globe area (the camera eases to this page's pose).
 */
export function PageHero({
  label,
  title,
  lead,
  children,
  globe = false,
}: {
  label: string;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
  globe?: boolean;
}) {
  return (
    <section className="border-b border-line">
      <Container>
        <Grid className="gap-y-8 py-24 md:py-32">
          <div className={`col-span-12 ${globe ? "md:col-span-7" : "lg:col-span-8"}`}>
            <Breadcrumb className="mb-6" />
            <Label>{label}</Label>
            <h1 className="mt-4 max-w-text text-h1-sm font-medium text-fg md:text-h1">{title}</h1>
            <PagePurpose className="mt-3" />
            {lead && <Text className="mt-4 max-w-text">{lead}</Text>}
            {children && <div className="mt-8">{children}</div>}
          </div>
          {globe && (
            <div
              data-world-focus
              data-world-drag
              aria-hidden
              className="col-span-12 h-globe md:col-span-5 md:h-stage-sm"
            />
          )}
        </Grid>
      </Container>
    </section>
  );
}

/** A titled block of long-form content on a content page. */
export function Block({
  id,
  label,
  title,
  children,
}: {
  id?: string;
  label?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-line py-16 md:py-24">
      <Container>
        <Grid className="gap-y-6">
          <div className="col-span-12 md:col-span-4">
            {label && <Label className="mb-3 block">{label}</Label>}
            <h2 className="max-w-text text-h2 font-medium text-fg">{title}</h2>
          </div>
          <div className="col-span-12 space-y-4 text-body text-fg-2 md:col-span-8">{children}</div>
        </Grid>
      </Container>
    </section>
  );
}

/** A plain list with hairline separators. */
export function Lines({ items }: { items: ReactNode[] }) {
  return (
    <ul className="border-b border-line">
      {items.map((it, i) => (
        <li key={i} className="border-t border-line py-3 text-body text-fg-2">
          {it}
        </li>
      ))}
    </ul>
  );
}
