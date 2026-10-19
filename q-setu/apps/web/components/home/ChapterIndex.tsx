"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Container } from "@/components/ui";
import { scrollToY } from "@/lib/client/scroll";

/** The homepage's four chapters, in story order. Each wraps a run of the existing sections. */
export const CHAPTERS = [
  {
    id: "problem",
    num: "01",
    name: "The problem",
    line: "Locked data can be copied today and opened later by a quantum computer.",
  },
  {
    id: "how",
    num: "02",
    name: "How it works",
    line: "Scan what you run, add quantum-safe locks without a rewrite, and seal what you send.",
  },
  {
    id: "proof",
    num: "03",
    name: "Proof",
    line: "Live evidence: messages sealed on real phones, India's readiness index, and what shipped.",
  },
  {
    id: "start",
    num: "04",
    name: "Who it's for and getting started",
    line: "The sectors it protects, why QuantumLedger, and how to start a pilot.",
  },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

function Head({ num, name, line }: { num: string; name: string; line: string }) {
  return (
    <>
      <h2 className="font-mono text-label uppercase text-fg-3">
        <span className="text-fg">{num}</span> {name}
      </h2>
      <p className="mt-2 max-w-label text-small text-fg-2 lg:max-w-text">{line}</p>
    </>
  );
}

/**
 * One chapter: its label and one plain sentence, then its sections. The first chapter opens on the
 * full-screen hero, so on desktop its label sits over the hero's top-left corner instead of pushing
 * it down; below lg the hero's status readout fills that corner, so the page places a
 * <ChapterHead id="problem" /> right after the hero instead.
 */
export function Chapter({
  id,
  overlay = false,
  children,
}: {
  id: ChapterId;
  overlay?: boolean;
  children: ReactNode;
}) {
  const c = CHAPTERS.find((x) => x.id === id)!;
  return (
    <div id={`chapter-${id}`} data-chapter={id} className="relative">
      {overlay ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-10 hidden lg:block">
          <Container>
            <Head {...c} />
          </Container>
        </div>
      ) : (
        <ChapterHead id={id} />
      )}
      {children}
    </div>
  );
}

export function ChapterHead({ id, className = "" }: { id: ChapterId; className?: string }) {
  const c = CHAPTERS.find((x) => x.id === id)!;
  return (
    <header className={`border-t border-line ${className}`}>
      <Container className="py-12 md:py-16">
        <Head {...c} />
      </Container>
    </header>
  );
}

const jumpTo = (id: ChapterId) => {
  const el = document.getElementById(`chapter-${id}`);
  if (!el) return;
  // Under the 56 px sticky nav; the first chapter goes to the very top.
  scrollToY(id === "problem" ? 0 : el.getBoundingClientRect().top + window.scrollY - 56);
};

/**
 * The sticky chapter index. Desktop: a slim dot rail on the right (left of the zero-trust rail) that
 * follows the scroll; the names show on hover or focus. Phone: a small "Jump to" pill, shown once
 * the hero is scrolled past.
 */
export function ChapterIndex() {
  const [active, setActive] = useState<ChapterId>("problem");
  const [pastHero, setPastHero] = useState(false);
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A line across the middle of the viewport: the chapter it crosses is the current one.
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es)
          if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.chapter as ChapterId);
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    document.querySelectorAll("[data-chapter]").forEach((el) => io.observe(el));
    const hero = document.getElementById("top");
    const ho = new IntersectionObserver(([e]) => setPastHero(!e?.isIntersecting));
    if (hero) ho.observe(hero);
    return () => {
      io.disconnect();
      ho.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!pill.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <>
      <nav
        aria-label="Chapters"
        className="group fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 lg:block"
      >
        <ol className="flex flex-col items-end gap-4">
          {CHAPTERS.map((c) => {
            const on = c.id === active;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(c.id)}
                  aria-current={on ? "step" : undefined}
                  className="flex items-center gap-3 font-mono text-micro uppercase"
                >
                  <span
                    className={`bg-base/70 px-1 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 ${on ? "text-fg" : "text-fg-3 opacity-0"}`}
                  >
                    {c.num}
                    <span
                      className={`transition-opacity duration-150 group-focus-within:inline group-hover:inline ${on ? "hidden" : ""}`}
                    >
                      {" "}
                      {c.name}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`block rounded-full transition-colors duration-300 ${on ? "h-2 w-2 bg-fg" : "h-dot w-dot bg-fg-3"}`}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div
        ref={pill}
        className={`fixed bottom-4 left-4 z-30 transition-opacity duration-300 lg:hidden ${pastHero ? "opacity-100" : "pointer-events-none opacity-0"}`}
        inert={!pastHero || undefined}
      >
        {open && (
          <ol
            id="chapter-jump"
            className="absolute bottom-full left-0 mb-2 w-max max-w-label border border-line-strong bg-raised py-2"
          >
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    jumpTo(c.id);
                  }}
                  aria-current={c.id === active ? "step" : undefined}
                  className={`block w-full px-4 py-2 text-left text-small ${c.id === active ? "text-fg" : "text-fg-2"}`}
                >
                  <span className="font-mono text-fg-3">{c.num}</span> {c.name}
                </button>
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="chapter-jump"
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 items-center gap-2 rounded-full border border-line-strong bg-raised px-3 font-mono text-label uppercase text-fg-2"
        >
          Jump to
          <span className="text-fg">{CHAPTERS.find((c) => c.id === active)?.num}</span>
        </button>
      </div>
    </>
  );
}
