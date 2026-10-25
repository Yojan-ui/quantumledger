"use client";

/**
 * What the global Q-Day switch shows across the page: sample intercepted classical traffic,
 * clearly labelled "(sim)", scrambling from ciphertext into readable text, and a banner saying
 * what's happening. Pointer-transparent; it fades after 6 s. Reduced motion: each line as a static
 * before → after pair.
 */
import { useEffect, useRef, useState } from "react";
import { endQday, QDAY_MS, useQday } from "@/lib/client/qday-switch";

/** Sample lines (simulated traffic, not real data), each tagged "(sim)". */
const LINES = [
  "UPI ₹2,400.00 → priya.k@okbank · ref 4471",
  "OTP 482913 for account ****7741",
  "Diagnosis: type 2 diabetes · patient no. 20931",
  "Salary credit ₹86,500 · acct ****2210",
  "Exam result 87.4% · roll 2041177",
  "Password reset link for r.sharma@…",
] as const;
/** Where each line sits (percent of the viewport), clear of the centre. */
const AT: [number, number][] = [
  [6, 22],
  [58, 16],
  [10, 48],
  [60, 44],
  [8, 74],
  [56, 72],
];
const HEX = "0123456789abcdef";

function Scramble({ text, delay, still }: { text: string; delay: number; still: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (still) return;
    const t0 = performance.now() + delay;
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, Math.max(0, (performance.now() - t0) / 1400));
      const n = Math.floor(text.length * k);
      let out = text.slice(0, n);
      for (let i = n; i < text.length; i++)
        out += text[i] === " " ? " " : HEX[Math.floor(Math.random() * 16)]!;
      if (el.current) el.current.textContent = out;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, still]);
  return <span ref={el}>{still ? text : ""}</span>;
}

export function QDayOverlay() {
  const on = useQday();
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  if (!on) return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 animate-reveal"
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-x-0 top-20 flex justify-center px-5">
        <p className="pointer-events-auto flex items-center gap-3 border border-warn bg-base px-4 py-2 font-mono text-label uppercase text-warn">
          Q-Day (sim) · recorded classical traffic opens · QuantumLedger stays sealed
          <button
            type="button"
            onClick={endQday}
            className="text-fg-3 transition-colors duration-150 hover:text-fg"
            aria-label="End the Q-Day simulation"
          >
            ×
          </button>
        </p>
      </div>
      {LINES.map((line, i) => (
        <p
          key={line}
          className="absolute max-w-label border border-warn bg-base px-3 py-2 font-mono text-label text-warn"
          style={{ left: `${AT[i]![0]}%`, top: `${AT[i]![1]}%` }}
        >
          {reduce ? (
            <>
              <span className="block text-fg-3 line-through">
                {Array.from(line, (ch, k) => (ch === " " ? " " : HEX[(k * 7) % 16])).join("")}
              </span>
              <span className="block">{line}</span>
            </>
          ) : (
            <Scramble text={line} delay={250 + i * 180} still={false} />
          )}
          <span className="ml-2 text-fg-3">(sim)</span>
        </p>
      ))}
      <span className="sr-only">
        Simulated Q-Day for {QDAY_MS / 1000} seconds: sample classical traffic decrypts; everything
        QuantumLedger protects stays sealed.
      </span>
    </div>
  );
}
