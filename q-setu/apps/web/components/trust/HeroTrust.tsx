"use client";

/**
 * The hero's zero-trust layer: over the stage, what the dot field is (the visitor's own ML-KEM-768
 * public key) and the byte under the pointer; under the hero, the one-line promise and the measured
 * result of the headline check (or why there wasn't one).
 */
import { useSyncExternalStore } from "react";
import { Container } from "@/components/ui";
import { keyHover } from "@/components/scenes/pipeline/keyHover";
import { useTrust } from "@/lib/client/trust";

function Tag() {
  const seal = useTrust((s) => s.seal);
  const hs = useTrust((s) => s.handshake);
  const verified = useTrust((s) => s.verified);
  if (seal === "plain")
    return <span>Network unavailable · headlines shown without verification</span>;
  if (verified && !verified.ok)
    return <span className="text-danger">signature invalid · not shown</span>;
  if (!verified || !hs) return <span>{seal === "pending" ? "Handshake…" : "Verifying…"}</span>;
  const ms = hs.encapsMs + hs.decapsMs;
  return (
    <span
      title={`X25519 + ML-KEM-768: server encapsulation ${hs.encapsMs.toFixed(2)} ms + this browser's decapsulation ${hs.decapsMs.toFixed(2)} ms (compute only, network excluded). ML-DSA-65 signature check: ${verified.ms.toFixed(2)} ms.`}
    >
      Verified <span className="text-ok">ML-DSA-65</span> · unsealed with{" "}
      <span className="text-kem">X25519MLKEM768</span> · handshake {ms.toFixed(1)} ms
    </span>
  );
}

function ByteTip() {
  const h = useSyncExternalStore(keyHover.subscribe, keyHover.get, () => null);
  if (!h) return null;
  return (
    <div
      className="pointer-events-none fixed z-30 border border-line bg-base px-2 py-1 font-mono text-micro uppercase text-fg-2"
      style={{ left: h.x + 12, top: h.y - 28 }}
      aria-hidden
    >
      byte {h.i + 1} of your public key ·{" "}
      <span className="text-kem">0x{h.byte.toString(16).toUpperCase().padStart(2, "0")}</span>
    </div>
  );
}

/** Inside the hero: what the dot field is, and the byte under the pointer. */
export function HeroTrust() {
  return (
    <>
      <p
        style={{ maxWidth: 300 }}
        className="pointer-events-none absolute bottom-16 right-5 hidden text-right font-mono text-micro uppercase text-fg-3 md:right-8 lg:block"
      >
        This pattern is your browser’s ML-KEM-768 public key, made just now. Nobody else sees this
        one.
      </p>
      <ByteTip />
    </>
  );
}

/** Directly under the hero: the one-line promise and the measured result of the headline check. */
export function ZeroTrustStrip() {
  const off = useTrust((s) => s.seal === "off");
  return (
    <div className="border-b border-line">
      <Container>
        <p
          className={`flex min-h-8 flex-col gap-1 py-2 font-mono text-micro uppercase text-fg-3 transition-opacity duration-700 md:flex-row md:items-center md:justify-between md:gap-4 ${off ? "opacity-0" : "opacity-100"}`}
          role="status"
          aria-live="polite"
        >
          <span className="text-fg-2">
            Zero trust: this page verifies what it shows before you see it.
          </span>
          <Tag />
          <span className="lg:hidden">
            The dots behind the hero are your browser’s ML-KEM-768 public key, made just now. Nobody
            else sees this one.
          </span>
        </p>
      </Container>
    </div>
  );
}
