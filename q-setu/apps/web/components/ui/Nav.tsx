"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "./Button";
import { Container } from "./layout";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#why-now", label: "Why now" },
  { href: "/demo", label: "Demos" },
  { href: "/#industries", label: "Industries" },
  { href: "/docs", label: "Docs" },
];

/**
 * 56px sticky nav, the site's only translucent surface. The primary button hides while the hero
 * (which has its own primary) is on screen, so there's never more than one primary per viewport.
 */
export function Nav() {
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => {
    const hero = document.querySelector("[data-hero]");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setHeroVisible(!!e?.isIntersecting), {
      threshold: 0.2,
    });
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-fg focus:px-4 focus:py-2 focus:text-base"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 h-14 border-b border-line bg-nav backdrop-blur-nav">
        <Container className="flex h-full items-center justify-between">
          <Logo />
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-8">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-small text-fg-2 transition-colors duration-150 hover:text-fg"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div
            className={`transition-opacity duration-300 ${heroVisible ? "pointer-events-none opacity-0" : "opacity-100"}`}
            aria-hidden={heroVisible}
          >
            <ButtonLink href="/demo">Launch demo</ButtonLink>
          </div>
        </Container>
      </header>
    </>
  );
}
