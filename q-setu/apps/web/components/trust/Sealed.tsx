"use client";

/**
 * A sealed headline's visible layer. Until the browser holds its ciphertext the text is blank; then
 * it shows the real AES-256-GCM ciphertext (hex, Geist Mono); once it scrolls in, the keys worker
 * verifies the site's ML-DSA-65 signature and decrypts it, and the hex resolves into the decrypted
 * words over ~400 ms with a faint --kem flash. A failed check leaves it sealed, in --danger.
 * The plain sentence is always in the server-rendered HTML for readers and crawlers (sr-only).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/client/motion";
import { unseal, useTrust } from "@/lib/client/trust";
import { headlineId } from "@/lib/trust/format";
import { isSealed } from "@/lib/trust/headlines";

const RESOLVE_MS = 400;

export type SealView =
  | { mode: "plain" }
  | { mode: "hidden" }
  | { mode: "cipher"; hex: string }
  | { mode: "resolving"; hex: string; text: string; p: number }
  | { mode: "open"; text: string }
  | { mode: "bad"; hex: string; reason: string };

/** The state of one sealed headline. `visible`: it has scrolled in (unsealing waits for that). */
export function useSealed(text: string, visible: boolean): SealView {
  const sealed = isSealed(text);
  const id = sealed ? headlineId(text) : "";
  const seal = useTrust((s) => (sealed ? s.seal : "off"));
  const hex = useTrust((s) => (id ? s.hex[id] : undefined));
  const reduce = useReducedMotion();
  const [view, setView] = useState<SealView | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    setView(null);
    if (seal !== "ready" || !hex || !visible) return;
    let live = true;
    void unseal(text).then((r) => {
      if (!live) return;
      if (!r.ok) return setView({ mode: "bad", hex, reason: r.reason });
      if (reduce) return setView({ mode: "open", text: r.text });
      const t0 = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / RESOLVE_MS);
        setView(
          p < 1 ? { mode: "resolving", hex, text: r.text, p } : { mode: "open", text: r.text },
        );
        if (p < 1) raf.current = requestAnimationFrame(step);
      };
      step();
    });
    return () => {
      live = false;
      cancelAnimationFrame(raf.current);
    };
  }, [seal, hex, visible, text, reduce]);

  if (seal === "off" || seal === "plain") return { mode: "plain" };
  if (seal === "pending" || !hex) return { mode: "hidden" };
  return view ?? { mode: "cipher", hex };
}

/** Deterministic jitter per position, so the resolve sweeps left to right without marching. */
const jitter = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * One rendered line of a sealed headline. `line` is the plain line as laid out; `offset` is where it
 * starts in the whole headline (so each line shows the next stretch of ciphertext).
 */
export function sealedLine(line: string, offset: number, total: number, v: SealView): ReactNode {
  if (v.mode === "plain") return line;
  if (v.mode === "open") return v.text.slice(offset, offset + line.length) || line;
  if (v.mode === "hidden") return <span className="text-transparent">{line}</span>;
  const hex = v.hex;
  const runs: { hex: boolean; s: string }[] = [];
  for (let j = 0; j < line.length; j++) {
    const g = offset + j;
    const ch = line[j]!;
    let isHex = ch !== " ";
    if (v.mode === "resolving" && isHex)
      isHex = v.p < (g / Math.max(1, total)) * 0.7 + jitter(g) * 0.3;
    const out = !isHex ? (v.mode === "resolving" ? (v.text[g] ?? ch) : ch) : hex[g % hex.length]!;
    const last = runs[runs.length - 1];
    if (last && last.hex === isHex) last.s += out;
    else runs.push({ hex: isHex, s: out });
  }
  return runs.map((r, i) =>
    r.hex ? (
      <span key={i} className="seal-hex">
        {r.s}
      </span>
    ) : (
      <span key={i}>{r.s}</span>
    ),
  );
}

/** Classes for a line's wrapper: no wrapping while it's ciphertext, the flash as it resolves. */
export const sealedClass = (v: SealView) =>
  v.mode === "cipher" || v.mode === "bad" || v.mode === "hidden"
    ? `whitespace-nowrap${v.mode === "bad" ? " seal-bad" : ""}`
    : v.mode === "resolving"
      ? "whitespace-nowrap seal-flash"
      : v.mode === "open"
        ? "seal-flash"
        : "";

/** Shown under a headline whose check failed. */
export function SealedFailure({ v }: { v: SealView }) {
  if (v.mode !== "bad") return null;
  return (
    <span className="mt-2 block font-mono text-label uppercase text-danger" role="status">
      {v.reason === "signature invalid" ? "signature invalid" : v.reason} · not shown
    </span>
  );
}

/**
 * A sealed sentence outside MaskHeading (one that wraps freely): plain text for readers and
 * crawlers, and the sealed layer over it, unsealed once it scrolls into view.
 */
export function SealedText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      setSeen(true);
      io.disconnect();
    });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const v = useSealed(text, seen);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden data-seal-text className={v.mode === "bad" ? "seal-bad" : ""}>
        {sealedLine(text, 0, text.length, v)}
      </span>
      <SealedFailure v={v} />
    </>
  );
}
