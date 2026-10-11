"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { demoOnPage, resetAll, sendPresent } from "@/lib/client/present";

const KEY = "qsetu:present";
/** 1–5 jump between the demos. */
const DEMOS = ["/demo/how-it-works", "/demo/deploy", "/demo/qday", "/demo/ledger", "/demo/scanner"];

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Scrolls to the next/previous top-level section (pages without a steppable demo). */
function stepSections(dir: 1 | -1) {
  const sections = [...document.querySelectorAll<HTMLElement>("main section[id], main > section")];
  const y = window.scrollY + 80;
  const tops = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
  const target = dir > 0 ? tops.find((t) => t > y + 4) : [...tops].reverse().find((t) => t < y - 4);
  if (target !== undefined) window.scrollTo({ top: target - 56, behavior: "smooth" });
}

function PresenterInner() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [on, setOn] = useState(false);
  const [note, setNote] = useState<string>();

  // ?present=1 turns presenter mode on for the session; ?present=0 or Esc turns it off.
  useEffect(() => {
    const q = params.get("present");
    if (q === "1") sessionStorage.setItem(KEY, "1");
    if (q === "0") sessionStorage.removeItem(KEY);
    setOn(sessionStorage.getItem(KEY) === "1");
  }, [params]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-present", on);
  }, [on]);

  useEffect(() => {
    if (!on) return;
    const flash = (s: string) => {
      setNote(s);
      setTimeout(() => setNote(undefined), 1400);
    };
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if (path === "/pitch") return; // the pitch deck handles its own arrows
        if (demoOnPage()) sendPresent(dir > 0 ? "next" : "prev");
        else stepSections(dir);
      } else if (/^[1-5]$/.test(e.key)) {
        router.push(DEMOS[Number(e.key) - 1]!);
      } else if (e.key === "r" || e.key === "R") {
        flash("Resetting every demo…");
        void resetAll().then(() => flash("Everything reset ✓"));
      } else if (e.key === "Escape") {
        sessionStorage.removeItem(KEY);
        setOn(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [on, path, router]);

  if (!on) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed right-4 top-20 z-50 rounded-sm border border-line bg-raised px-3 py-2 font-mono text-label uppercase text-fg-3"
    >
      {note ?? "Presenting · ←/→ step · 1–5 demos · R reset · Esc exit"}
    </div>
  );
}

/** Presenter mode: bigger type, no nav clutter, keyboard control of every demo. */
export function Presenter() {
  return (
    <Suspense fallback={null}>
      <PresenterInner />
    </Suspense>
  );
}
