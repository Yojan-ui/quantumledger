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
import { NAV_GROUPS, PRICING_LINK, isOn, type NavGroup } from "@/data/site-map";
import { Label } from "./type";

/**
 * One nav group (Product, Solutions, Learn): a button that opens its links below it, on click or
 * hover. Closes on Escape, on a click elsewhere and on navigation.
 */
function NavMenu({
  group,
  path,
  open,
  setOpen,
}: {
  group: NavGroup;
  path: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const on = group.items.some((l) => isOn(path, l.href));
  const id = `nav-${group.id}`;
  return (
    <li
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        data-current={on || undefined}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 text-small transition-colors duration-150 hover:text-fg ${on || open ? "text-fg" : "text-fg-2"}`}
      >
        {group.label}
        <span
          aria-hidden
          className={`text-fg-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {/* pt bridges the gap to the button, so moving the mouse down doesn't close the menu. */}
      <div id={id} hidden={!open} className="absolute left-0 top-full pt-3">
        <ul className="w-max border border-line-strong bg-raised py-2">
          {group.items.map((l) => {
            const here = isOn(path, l.href) && (l.href !== "/solutions" || path === l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={here ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2 text-small transition-colors duration-150 hover:bg-base hover:text-fg ${here ? "text-fg" : "text-fg-2"}`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

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
  // Which desktop group is open (one at a time).
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    setOpen(false);
    setMenu(null);
  }, [path]);
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const away = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", away);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", away);
    };
  }, [menu]);

  // A 1px KEM underline slides to the active item (300 ms).
  const list = useRef<HTMLUListElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const place = () => {
      const a = list.current?.querySelector<HTMLElement>(
        ':scope > li > [data-current], :scope > li > [aria-current="page"]',
      );
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
          <nav aria-label="Main" className="hidden lg:block">
            <ul ref={list} className="relative flex items-center gap-8">
              {NAV_GROUPS.map((g) => (
                <NavMenu
                  key={g.id}
                  group={g}
                  path={path}
                  open={menu === g.id}
                  setOpen={(o) => setMenu(o ? g.id : null)}
                />
              ))}
              <li>
                <Link
                  href={PRICING_LINK.href}
                  aria-current={isOn(path, PRICING_LINK.href) ? "page" : undefined}
                  className={`text-small transition-colors duration-150 hover:text-fg ${isOn(path, PRICING_LINK.href) ? "text-fg" : "text-fg-2"}`}
                >
                  {PRICING_LINK.label}
                </Link>
              </li>
              <span
                aria-hidden
                className={`absolute -bottom-2 left-0 h-px w-px origin-left bg-kem transition duration-300 ${bar ? "opacity-100" : "opacity-0"}`}
                style={{ transform: `translateX(${bar?.x ?? 0}px) scaleX(${bar?.w ?? 0})` }}
              />
            </ul>
          </nav>
          <div className="flex items-center gap-3">
            <QDayToggle className="hidden xl:flex" />
            {/* Below lg the toggle lives in the menu: the header row must fit a 360 px phone. */}
            <CopyToggle className="hidden lg:flex" />
            <button
              type="button"
              onClick={openCommandMenu}
              className="hidden h-8 items-center gap-2 rounded-sm border border-line px-2 font-mono text-label text-fg-3 transition-colors duration-150 hover:text-fg xl:flex"
              aria-label="Open command menu"
            >
              ⌘K
            </button>
            <div
              className={`transition-opacity duration-300 ${heroVisible ? "pointer-events-none opacity-0" : "opacity-100"}`}
              aria-hidden={heroVisible}
              inert={heroVisible || undefined}
            >
              <ButtonLink href="/#early-access" className="hidden lg:inline-flex">
                Get early access
              </ButtonLink>
            </div>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="flex h-10 shrink-0 items-center px-2 text-small text-fg lg:hidden"
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </Container>
        {open && (
          <nav
            id="mobile-menu"
            aria-label="Main"
            className="overflow-y-auto overscroll-contain border-b border-line bg-base lg:hidden"
            style={{ maxHeight: "calc(100svh - 56px)" }}
          >
            <Container className="space-y-1 py-4">
              {NAV_GROUPS.map((g) => (
                <div key={g.id} className="pb-3">
                  <Label as="p" className="block pb-1">
                    {g.label}
                  </Label>
                  {g.items.map((l) => (
                    <Link key={l.href} href={l.href} className="block py-2 text-body text-fg">
                      {l.label}
                    </Link>
                  ))}
                </div>
              ))}
              <Link href={PRICING_LINK.href} className="block py-2 text-body text-fg">
                {PRICING_LINK.label}
              </Link>
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <CopyToggle />
                <QDayToggle className="flex" />
              </div>
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
