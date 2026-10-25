"use client";

/**
 * What the phone page needs from the browser, checked before anything runs. The crypto is pure
 * JavaScript (@noble, no WebAssembly, no crypto.subtle), so it works on a plain-HTTP LAN address;
 * it needs a worker to run in, BigInt (X25519), secure randomness and UTF-8 encoding.
 * Returns the missing features, empty when the browser can take part.
 */
export function missingForRoom(): string[] {
  const g = globalThis as Partial<typeof globalThis>;
  const missing: string[] = [];
  if (typeof g.Worker !== "function") missing.push("background workers");
  if (typeof g.crypto?.getRandomValues !== "function") missing.push("secure random numbers");
  if (typeof g.BigInt !== "function") missing.push("big-number maths");
  if (typeof g.TextEncoder !== "function") missing.push("text encoding");
  if (typeof g.fetch !== "function") missing.push("network requests");
  return missing;
}
