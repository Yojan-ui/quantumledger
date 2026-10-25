"use client";

/**
 * "Zero trust, made visible": the page trusts nothing it hasn't checked, and shows each check.
 *
 *  - Headlines: one hybrid handshake (X25519 + ML-KEM-768) with POST /api/trust/headlines; every
 *    homepage headline arrives sealed (AES-256-GCM) under a bundle signed with the site's ML-DSA-65
 *    key. The keys worker verifies that signature, then decrypts, as each headline scrolls in.
 *  - API responses: verifiedFetch() checks the body's SHA-384 and the ML-DSA-65 signature before
 *    the caller sees the data; a failed check throws, so the UI keeps what it had.
 *  - Static files: hashed against the signed asset manifest (/.well-known/qsetu-manifest.json)
 *    after they load (a browser runs a script before any page code can check it, so these are
 *    checked, not gated).
 *  - Every other request the page makes is listed too, marked as not checked.
 * Signatures are checked against NEXT_PUBLIC_QSETU_SITE_KEY, the key pinned into the bundle.
 */
import { useSyncExternalStore } from "react";
import { generateVisitorKeys, keysCall } from "@/components/home/visitor";
import { bytesToBase64 } from "@qsetu/core";
import {
  HASH_HEADER,
  headlineId,
  HEADLINES_PATH,
  SIG_HEADER,
  TS_HEADER,
  type SealedBundle,
} from "@/lib/trust/format";
import type { Metrics } from "@/lib/live/types";

export type EntryStatus = "pending" | "ok" | "bad" | "skip";
export interface Entry {
  n: number;
  method: string;
  path: string;
  status: EntryStatus;
  /** "ML-DSA-65 ✓", "hash mismatch · rejected", "unsigned · not checked"… */
  label: string;
  ms?: number;
}

type Check = { ok: true; ms: number } | { ok: false; ms: number; reason: string };

export interface TrustState {
  /** off: this page doesn't seal; pending: handshake in flight; ready: ciphertext here; plain: fell back. */
  seal: "off" | "pending" | "ready" | "plain";
  /** Ciphertext (hex) per headline id. */
  hex: Record<string, string>;
  handshake?: { encapsMs: number; decapsMs: number };
  /** The first headline's signature check (ms) and whether it passed. */
  verified?: { ok: boolean; ms: number };
  entries: Entry[];
  metrics?: { opsPerSec: number; at: number };
  /** When the last tampered /api/metrics response was refused. */
  refusedAt?: number;
}

const MAX_ENTRIES = 240;
let state: TrustState = {
  // The head script marks the homepage's headlines pending before first paint.
  seal:
    typeof document !== "undefined" && document.documentElement.dataset.seal === "pending"
      ? "pending"
      : "off",
  hex: {},
  entries: [],
};
const listeners = new Set<() => void>();
let frame = 0;
function set(p: Partial<TrustState>, now = false) {
  state = { ...state, ...p };
  if (now) return listeners.forEach((fn) => fn());
  // Coalesced to one render per frame: dozens of checks can land together.
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    listeners.forEach((fn) => fn());
  });
}
export const getTrust = () => state;
export function useTrust<T>(select: (s: TrustState) => T): T {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => select(state),
    () => select(SERVER),
  );
}
const SERVER: TrustState = { seal: "off", hex: {}, entries: [] };

let seq = 0;
function addEntry(method: string, path: string, status: EntryStatus, label: string, ms?: number) {
  const e: Entry = { n: ++seq, method, path, status, label, ms };
  const entries = [...state.entries, e];
  set({ entries: entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries });
  return e.n;
}
function updateEntry(n: number, p: Partial<Entry>) {
  set({ entries: state.entries.map((e) => (e.n === n ? { ...e, ...p } : e)) });
}

/** Requests this module makes itself, so the resource observer doesn't list them twice. */
const own = new Map<string, number>();
const claim = (path: string) => own.set(path, (own.get(path) ?? 0) + 1);

// ── headlines ──────────────────────────────────────────────────────────────────────────────────

let started = false;
let bundleEntry = 0;

function fallBack() {
  document.documentElement.dataset.seal = "plain";
  set({ seal: "plain" });
}

/** Runs the handshake once per page view (only where the head script marked headlines pending). */
async function startSeal() {
  const d = document.documentElement.dataset;
  // The head script's own fallback already showed the plain text: leave it.
  if (d.seal === "plain") return set({ seal: "plain" }, true);
  // From here this script owns the fallback (the head script only acts on "pending").
  d.seal = "pending-js";
  set({ seal: "pending" }, true);
  try {
    const keys = await generateVisitorKeys();
    claim(HEADLINES_PATH);
    bundleEntry = addEntry("POST", HEADLINES_PATH, "pending", "X25519MLKEM768 handshake");
    const r = await fetch(HEADLINES_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicKey: bytesToBase64(keys.hybridPublicKey) }),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new Error(String(r.status));
    const bundle = (await r.json()) as SealedBundle;
    const { decapsMs, hex } = await keysCall<{ decapsMs: number; hex: Record<string, string> }>(
      "accept",
      { bundle },
    );
    document.documentElement.dataset.seal = "ready";
    set({ seal: "ready", hex, handshake: { encapsMs: bundle.encapsMs, decapsMs } });
  } catch {
    // Offline, blocked or too slow: the plain text shows at once, and the rail says why.
    if (bundleEntry)
      updateEntry(bundleEntry, { status: "skip", label: "unreachable · shown unverified" });
    fallBack();
  }
}

export type Unsealed = { ok: true; text: string } | { ok: false; reason: string };

/** Verifies the bundle signature (in the worker), then decrypts this headline. */
export async function unseal(text: string): Promise<Unsealed> {
  const r = await keysCall<
    { ok: true; text: string; verifyMs: number } | { ok: false; reason: string; verifyMs?: number }
  >("unseal", { id: headlineId(text) });
  if (!state.verified && r.verifyMs !== undefined) {
    set({ verified: { ok: r.ok, ms: r.verifyMs } });
    if (bundleEntry)
      updateEntry(
        bundleEntry,
        r.ok
          ? { status: "ok", label: "ML-DSA-65 ✓", ms: r.verifyMs }
          : { status: "bad", label: `${r.reason} · not shown`, ms: r.verifyMs },
      );
  }
  return r.ok ? { ok: true, text: r.text } : { ok: false, reason: r.reason };
}

// ── API responses ──────────────────────────────────────────────────────────────────────────────

export class TrustError extends Error {
  override name = "TrustError";
}

let tamperNext = false;

/**
 * fetch(), but the response body is only handed back once its SHA-384 and the site's ML-DSA-65
 * signature over it check out. A failed check throws TrustError (the caller's UI keeps what it had).
 * An error response without a signature (a 429 from the edge, say) passes through, marked unchecked.
 */
export async function verifiedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const path = new URL(url, location.href).pathname;
  claim(path);
  const n = addEntry(method, path, "pending", "verifying…");
  const r = await fetch(url, init);
  const body = new Uint8Array(await r.arrayBuffer());
  const sig = r.headers.get(SIG_HEADER);
  const hash = r.headers.get(HASH_HEADER);
  const ts = Number(r.headers.get(TS_HEADER));
  const rebuilt = () =>
    new Response(body, { status: r.status, statusText: r.statusText, headers: r.headers });
  if (!sig || !hash || !ts) {
    if (r.ok) {
      updateEntry(n, { status: "bad", label: "unsigned · rejected" });
      throw new TrustError(`${path}: unsigned response`);
    }
    updateEntry(n, { status: "skip", label: `${r.status} · unsigned · not checked` });
    return rebuilt();
  }
  // "Try to tamper": flip one byte of this response, in the browser, before it is checked.
  if (tamperNext && path === "/api/metrics" && body.length) {
    tamperNext = false;
    body[Math.floor(body.length / 2)]! ^= 0x01;
  }
  let c: Check;
  try {
    c = await keysCall<Check>("response", { method, path, body: body.buffer, hash, ts, sig });
  } catch {
    // The verifier itself couldn't run (no worker): say so rather than claim a check.
    updateEntry(n, { status: "skip", label: "verifier unavailable · not checked" });
    return rebuilt();
  }
  if (!c.ok) {
    updateEntry(n, { status: "bad", label: `${c.reason} · rejected`, ms: c.ms });
    throw new TrustError(`${path}: ${c.reason}`);
  }
  updateEntry(n, { status: "ok", label: "ML-DSA-65 ✓", ms: c.ms });
  return rebuilt();
}

/** Arms the tamper demo and makes the request it will hit straight away. */
export function tamper() {
  tamperNext = true;
  void pollMetrics();
}

async function pollMetrics() {
  try {
    const r = await verifiedFetch("/api/metrics", { cache: "no-store" });
    if (!r.ok) return;
    const m = (await r.json()) as Metrics;
    set({ metrics: { opsPerSec: m.opsPerSec, at: Date.now() } });
  } catch (e) {
    if (e instanceof TrustError) set({ refusedAt: Date.now() });
  }
}

// ── every other request ────────────────────────────────────────────────────────────────────────

const STATIC =
  /^\/(_next\/static\/|[^/?]+\.(?:js|css|svg|png|jpe?g|webp|ico|woff2?)$|(?:brand|globe|scenes|previews)\/)/;
const queue: { n: number; path: string }[] = [];
let manifest: Promise<boolean> | undefined;
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  manifest ??= (async () => {
    const n = addEntry("GET", "/.well-known/qsetu-manifest.json", "pending", "verifying…");
    try {
      const m = await keysCall<{ ok: boolean; ms: number; files?: number; reason?: string }>(
        "manifest",
      );
      updateEntry(
        n,
        m.ok
          ? { status: "ok", label: `ML-DSA-65 ✓ · ${m.files} files`, ms: m.ms }
          : { status: "bad", label: `${m.reason} · rejected`, ms: m.ms },
      );
      return m.ok;
    } catch {
      updateEntry(n, { status: "skip", label: "unreachable · not checked" });
      return false;
    }
  })();
  const ok = await manifest;
  while (queue.length) {
    const { n, path } = queue.shift()!;
    if (!ok) {
      updateEntry(n, { status: "skip", label: "no verified manifest · not checked" });
      continue;
    }
    try {
      const a = await keysCall<{ ok: boolean; ms: number; reason?: string; uncovered?: boolean }>(
        "asset",
        { path },
      );
      updateEntry(
        n,
        a.ok
          ? { status: "ok", label: "SHA-384 ✓ signed manifest", ms: a.ms }
          : a.uncovered
            ? { status: "skip", label: "not in manifest · not checked" }
            : { status: "bad", label: `${a.reason} · rejected`, ms: a.ms },
      );
    } catch {
      updateEntry(n, { status: "skip", label: "unreachable · not checked" });
    }
  }
  draining = false;
}

function observe(e: PerformanceResourceTiming | PerformanceNavigationTiming) {
  const u = new URL(e.name, location.href);
  const path = u.pathname;
  if (e.entryType === "navigation") {
    addEntry("GET", path, "skip", "page HTML · not signed");
    return;
  }
  // Resource Timing doesn't say which method a request used; it says what made it.
  const kind = e.initiatorType.toUpperCase();
  if (u.origin !== location.origin) {
    addEntry(kind, `${u.host}${path}`, "skip", "third party · not checked");
    return;
  }
  const mine = own.get(path);
  if (mine) {
    if (mine === 1) own.delete(path);
    else own.set(path, mine - 1);
    return;
  }
  if (STATIC.test(path) && !u.search) {
    queue.push({ n: addEntry(kind, path, "pending", "queued"), path });
    if (checking) void drain();
  } else addEntry(kind, path + (u.search ? "?…" : ""), "skip", "not checked by this page");
}

let checking = false;
let refs = 0;
let stop: (() => void) | undefined;

/** Starts everything once per page view (while at least one caller holds it). */
export function startTrust(): () => void {
  refs++;
  if (!stop) stop = begin();
  return () => {
    refs--;
    // Deferred, so a remount (React's strict mode, a fast refresh) keeps the same session.
    setTimeout(() => {
      if (refs === 0 && stop) {
        stop();
        stop = undefined;
      }
    }, 1000);
  };
}

function begin(): () => void {
  if (!started) {
    started = true;
    void startSeal();
    const nav = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (nav) observe(nav);
  }
  const po = new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => observe(e as PerformanceResourceTiming)),
  );
  po.observe({ type: "resource", buffered: !observed });
  observed = true;
  // Hashing waits until the opening has played, so it never competes with the first frames.
  const w = window as Window & typeof globalThis;
  const go = () => {
    checking = true;
    void drain();
  };
  const t1 = setTimeout(
    () =>
      typeof w.requestIdleCallback === "function"
        ? w.requestIdleCallback(go, { timeout: 2000 })
        : go(),
    2500,
  );
  const t2 = setTimeout(() => void pollMetrics(), 3000);
  const poll = setInterval(() => {
    if (document.visibilityState === "visible") void pollMetrics();
  }, 6000);
  return () => {
    po.disconnect();
    clearTimeout(t1);
    clearTimeout(t2);
    clearInterval(poll);
  };
}
let observed = false;
