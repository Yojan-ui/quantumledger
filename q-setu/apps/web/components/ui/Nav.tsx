"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "./Button";
import { openCommandMenu } from "./CommandMenu";
import { Container } from "./layout";
import { Logo } from "./Logo";

export const NAV_LINKS = [
  { href: "/platform", label: "Platform" },
  { href: "/solutions", label: "Solutions" },
  { href: "/demos", label: "Demos" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * 56px sticky nav, the site's only translucent surface. On the home page its primary button hides
 * while the hero (which has its own primary) is on screen: never two primaries in one viewport.
 */
export function Nav() {
  const path = usePathname();
  const [heroVisible, setHeroVisible] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const hero = document.querySelector("[data-hero]");
    if (!hero) return setHeroVisible(false);
    const io = new IntersectionObserver(([e]) => setHeroVisible(!!e?.isIntersecting), {
      threshold: 0.2,
    });
    io.observe(hero);
    return () => io.disconnect();
  }, [path]);
  useEffect(() => setOpen(false), [path]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-fg focus:px-4 focus:py-2 focus:text-base"
      >
        Skip to content
      </a>
      <header
        data-chrome
        className="sticky top-0 z-40 h-14 border-b border-line bg-nav backdrop-blur-nav"
      >
        <Container className="flex h-full items-center justify-between gap-6">
          <Logo />
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-8">
              {NAV_LINKS.map((l) => {
                const on = path === l.href || path.startsWith(`${l.href}/`);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={on ? "page" : undefined}
                      className={`text-small transition-colors duration-150 hover:text-fg ${on ? "text-fg" : "text-fg-2"}`}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openCommandMenu}
              className="hidden h-8 items-center gap-2 rounded-sm border border-line px-2 font-mono text-label text-fg-3 transition-colors duration-150 hover:text-fg lg:flex"
              aria-label="Open command menu"
            >
              ⌘K
            </button>
            <div
              className={`transition-opacity duration-300 ${heroVisible ? "pointer-events-none opacity-0" : "opacity-100"}`}
              aria-hidden={heroVisible}
              inert={heroVisible || undefined}
            >
              <ButtonLink href="/#early-access" className="hidden md:inline-flex">
                Get early access
              </ButtonLink>
            </div>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="flex h-10 items-center px-2 text-small text-fg md:hidden"
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </Container>
        {open && (
          <nav
            id="mobile-menu"
            aria-label="Main"
            className="border-b border-line bg-base md:hidden"
          >
            <Container className="space-y-1 py-4">
              {NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="block py-2 text-body text-fg">
                  {l.label}
                </Link>
              ))}
              <div className="pt-3">
                <ButtonLink href="/#early-access">Get early access</ButtonLink>
              </div>
            </Container>
          </nav>
        )}
      </header>
    </>
  );
}
