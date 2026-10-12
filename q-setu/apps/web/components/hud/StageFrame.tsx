"use client";

/**
 * The frame around the 3D stage: a "LIVE WEBGL · NN fps" tag (measured), the bracketed title that
 * decodes from scrambled glyphs in 300 ms when the state changes, the numbered caption revealed
 * through a line mask, and interaction hints that fade after the first drag, scroll or click.
 * A visually hidden live region announces each stage for screen readers.
 */
import { useEffect, useRef, useState } from "react";
import { stageText, STAGES, usePipeline } from "@/lib/client/pipeline";

const GLYPHS = "▓▒░<>/\\|#$%&*+=?01";
const TONE: Record<string, string> = {
  danger: "text-danger",
  warn: "text-warn",
  kem: "text-kem",
  sig: "text-sig",
  ok: "text-ok",
  muted: "text-fg-2",
};

function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let n = 0;
    let t0 = performance.now();
    const tick = (now: number) => {
      n++;
      if (now - t0 >= 500) {
        setFps(Math.round((n * 1000) / (now - t0)));
        n = 0;
        t0 = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

/** Decodes `text` from random glyphs, left to right, over `ms`. */
function useScramble(text: string, ms = 300) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setOut(text);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const fixed = Math.floor(text.length * k);
      setOut(
        text
          .split("")
          .map((c, i) =>
            i < fixed || c === " " ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          )
          .join(""),
      );
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, ms]);
  return out;
}

export function StageFrame({ compact = false }: { compact?: boolean }) {
  const s = usePipeline((x) => x);
  const t = stageText(s);
  const title = useScramble(`[ QuantumLedger: ${t.title} ]`);
  const fps = useFps();
  const [hints, setHints] = useState(true);
  const used = useRef(false);
  useEffect(() => {
    const off = () => {
      if (used.current) return;
      used.current = true;
      setTimeout(() => setHints(false), 1200);
    };
    const el = document.querySelector("[data-hud-stage]");
    el?.addEventListener("pointerdown", off);
    el?.addEventListener("wheel", off, { passive: true });
    return () => {
      el?.removeEventListener("pointerdown", off);
      el?.removeEventListener("wheel", off);
    };
  }, []);
  const status = s.stage >= 0 ? s.status[s.stage] : "idle";
  return (
    <div className="pointer-events-none absolute inset-0 p-3 md:p-4">
      <p className="font-mono text-micro uppercase text-fg-3">
        <span className="text-ok">●</span> LIVE WEBGL · <span className="tabular">{fps}</span> fps
      </p>
      <p
        className={`mt-2 font-mono text-small uppercase tracking-widest md:text-h3 ${TONE[t.role]}`}
        aria-hidden
        data-stage-title={t.title}
      >
        {title}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {s.stage >= 0
          ? `Stage ${s.stage + 1} of 5, ${STAGES[s.stage]!.name}: ${t.title.toLowerCase()}, ${status}. ${t.caption}`
          : t.caption}
      </p>
      <div className="absolute bottom-3 left-3 max-w-text overflow-hidden md:bottom-4 md:left-4">
        <p
          key={t.caption}
          className="animate-mask-up font-mono text-small text-fg md:text-body"
          data-stage-caption
        >
          {t.caption}
        </p>
      </div>
      {!compact && (
        <p
          className={`absolute right-3 top-3 hidden max-w-label text-right font-mono text-micro uppercase text-fg-3 transition-opacity duration-700 md:right-4 md:top-4 md:block ${hints ? "opacity-60" : "opacity-0"}`}
          aria-hidden
        >
          hover: inspect · drag: orbit · scroll: zoom · double-click: re-frame
        </p>
      )}
    </div>
  );
}
