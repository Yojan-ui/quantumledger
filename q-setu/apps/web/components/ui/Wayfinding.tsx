"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pageInfo } from "@/data/site-map";
import { Container } from "./layout";

/**
 * The same top and bottom on every content page (data/site-map): a breadcrumb above the title, one
 * line under it saying what the page is for, and a "Next step" link at the bottom. Pages without an
 * entry (home, tools, admin) render none of them.
 */
export function Breadcrumb({ current, className = "" }: { current?: string; className?: string }) {
  const info = pageInfo(usePathname());
  if (!info) return null;
  const trail = current ? [...info.trail, { label: current }] : info.trail;
  return (
    <nav
      aria-label="Breadcrumb"
      className={`font-mono text-label uppercase text-fg-3 ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="transition-colors duration-150 hover:text-fg">
            Home
          </Link>
        </li>
        {trail.map((t, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              <span aria-hidden>/</span>
              {t.href && !last ? (
                <Link href={t.href} className="transition-colors duration-150 hover:text-fg">
                  {t.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-fg-2" : ""}>
                  {t.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PagePurpose({ className = "" }: { className?: string }) {
  const info = pageInfo(usePathname());
  if (!info) return null;
  return (
    <p className={`max-w-text text-small text-fg-3 ${className}`}>
      <span className="text-fg-2">What this page is for:</span> {info.purpose}
    </p>
  );
}

export function NextStep() {
  const info = pageInfo(usePathname());
  if (!info) return null;
  return (
    <section aria-label="Next step" className="border-t border-line">
      <Container className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-10">
        <span className="font-mono text-label uppercase text-fg-3">Next step</span>
        <Link
          href={info.next.href}
          className="text-h3 font-medium text-fg transition-colors duration-150 hover:text-kem"
        >
          {info.next.label} →
        </Link>
      </Container>
    </section>
  );
}
