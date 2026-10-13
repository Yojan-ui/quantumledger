"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "./Button";
import { openCommandMenu } from "./CommandMenu";
import { setCopyMode, useCopyMode } from "@/lib/client/copy-mode";
import { Container } from "./layout";
import { Logo } from "./Logo";
import { endQday, throwQday, useQday } from "@/lib/client/qday-switch";

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
/** The global Q-Day switch: 6 s of simulated Q-Day across the whole site (lib/client/qday-switch). */
function QDayToggle({ className = "" }: { className?: string }) {
  const on = useQday();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => (on ? endQday() : throwQday())}
      title="Simulate Q-Day for 6 seconds"
      className={`h-8 items-center rounded-sm border px-2 font-mono text-label uppercase transition-colors duration-150 ${on ? "border-warn text-warn" : "border-line text-fg-3 hover:text-fg"} ${className}`}
    >
      Q-Day
    </button>
  );
}

/** Simple / Technical: every section has both versions of its copy. Remembered in localStorage. */
function CopyToggle({ className = "" }: { className?: string }) {
  const mode = useCopyMode();
  return (
    <div
      role="group"
      aria-label="Explanation level"
      className={`flex h-8 items-center rounded-sm border border-line p-px ${className}`}
    >
      {(["simple", "technical"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setCopyMode(m)}
          className={`h-full rounded-sm px-2 font-mono text-label uppercase transition-colors duration-150 ${mode === m ? "bg-raised text-fg" : "text-fg-3 hover:text-fg"}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

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

  // A 1px KEM underline slides to the active item (300 ms).
  const list = useRef<HTMLUListElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const place = () => {
      const a = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
      const ul = list.current;
      if (!a || !ul) return setBar(null);
      setBar({ x: a.offsetLeft, w: a.offsetWidth });
    };
    place();
    // ResizeObserver (not a window resize listener): fires once per layout change, not per pixel.
    const ro = new ResizeObserver(place);
    if (list.current) ro.observe(list.current);
    return () => ro.disconnect();
  }, [path]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-fg focus:px-4 focus:py-2 focus:text-base"
      >
        Skip to content
      </a>
      <header data-chrome className="sticky top-0 z-40 h-14 border-b border-line bg-nav">
        <Container className="flex h-full items-center justify-between gap-6">
          <Logo />
          <nav aria-label="Main" className="hidden md:block">
            <ul ref={list} className="relative flex items-center gap-8">
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
              <span
                aria-hidden
                className={`absolute -bottom-2 left-0 h-px w-px origin-left bg-kem transition duration-300 ${bar ? "opacity-100" : "opacity-0"}`}
                style={{ transform: `translateX(${bar?.x ?? 0}px) scaleX(${bar?.w ?? 0})` }}
              />
            </ul>
          </nav>
          <div className="flex items-center gap-3">
            <QDayToggle className="hidden md:flex" />
            <CopyToggle />
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
