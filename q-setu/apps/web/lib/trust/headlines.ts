/**
 * The homepage headlines the server seals for each visitor (POST /api/trust/headlines). A heading
 * whose text is listed here arrives as ciphertext and is shown only once the browser has verified
 * and decrypted it; any other heading renders as plain text, exactly as before.
 */
import { HERO, STEPS } from "@/components/home/chapters";
import { pct, READINESS, share } from "@/lib/readiness";

/** The hero's three sentences, as the hero lays them out (one per line). */
export const HERO_LINES = HERO.title.split(/(?<=\.)\s+/);

/** Both copy modes (Simple and Technical) of every section headline on the homepage. */
const SECTIONS = [
  "Seal a message from your phone. Watch it land here.",
  "Why your data needs new locks.",
  "The quantum threat, and the fix, in four steps.",
  "of the Indian sites we checked still use a lock a quantum computer could open.",
  `still present RSA-2048 certificates. ${pct(share(READINESS.all, "hybridPq"))} negotiate hybrid ML-KEM.`,
  "Is your bank quantum‑safe?",
  "Scan any site's TLS, live.",
  ...STEPS.flatMap((s) => [s.simpleTitle, s.title]),
  "Five ways to add it. Each takes one line.",
  "Five adapters. Each one line.",
  "Built for the services India relies on most.",
  "Built for India’s most sensitive rails.",
  "How long must your records stay secret?",
  "Secrecy lifetime against the quantum risk window.",
  "Seal something on this device.",
  "ML-KEM-768 in your browser, timed.",
  "What QuantumLedger adds that's new.",
  "What's new: deployment, measurement, audit and proof.",
  "The new locks exist. Fitting them is the hard part.",
  "Algorithms are solved. Deployment isn’t.",
  "Change the locks before the master key exists.",
  "Be quantum-safe before Q‑Day.",
];

export const SEALED_HEADLINES: readonly string[] = [...new Set([...HERO_LINES, ...SECTIONS])];
const SEALED_SET = new Set(SEALED_HEADLINES);
export const isSealed = (text: string) => SEALED_SET.has(text);
