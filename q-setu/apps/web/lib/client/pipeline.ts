"use client";

/**
 * The diagnostics pipeline: DETECT → SCORE → DEFEND → PROVE → RESCAN, one store for the whole
 * page (the HUD panels, the terminal and the 3D stage all read it). Every stage completes on a
 * real result, never on a timer:
 *  - DETECT   the URL scanner's TLS probe (or a pre-cached real scan, labelled as such)
 *  - SCORE    the server's migration plan for those findings and the Mosca shelf-life X
 *  - DEFEND   a full hybrid handshake (X25519 + ML-KEM, ML-DSA-signed) at the chosen level, in a worker
 *  - PROVE    a Merkle root over the run, anchored as an ML-DSA-signed Proof Chain entry
 *  - RESCAN   the sweep (checkpoint signature, the chain after it, the Merkle root) and the
 *             scanner re-run on the patched configuration
 * What is simulated is said so: the target's server isn't really patched, so its post-patch
 * key exchange, certificate and score are "(sim)".
 */
import { useSyncExternalStore } from "react";
import type { ScanView } from "@/lib/scan-types";
import { hs } from "./handshake-crypto";
import { pushLocal } from "./live";
import { errText } from "./api";

export const STAGES = [
  { id: "detect", n: "01", name: "DETECT", cta: "Run scan", role: "danger" },
  { id: "score", n: "02", name: "SCORE", cta: "Score risk", role: "warn" },
  { id: "defend", n: "03", name: "DEFEND", cta: "Apply PQC patch", role: "kem" },
  { id: "prove", n: "04", name: "PROVE", cta: "Anchor proof", role: "sig" },
  { id: "rescan", n: "05", name: "RESCAN", cta: "Run verification sweep", role: "ok" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];
export type StageStatus = "idle" | "running" | "done" | "failed";

export type Level = "L1" | "L3" | "L5";
export const LEVELS: Record<
  Level,
  {
    profile: "edge" | "standard" | "maximum";
    kem: string;
    sig: string;
    label: string;
    group: string;
  }
> = {
  L1: {
    profile: "edge",
    kem: "ML-KEM-512",
    sig: "ML-DSA-44",
    label: "FAST",
    group: "X25519MLKEM512",
  },
  L3: {
    profile: "standard",
    kem: "ML-KEM-768",
    sig: "ML-DSA-65",
    label: "STANDARD",
    group: "X25519MLKEM768",
  },
  L5: {
    profile: "maximum",
    kem: "ML-KEM-1024",
    sig: "ML-DSA-87",
    label: "MAXIMUM",
    group: "X25519MLKEM1024",
  },
};
export const levelOf = (profile: string): Level =>
  profile === "edge" ? "L1" : profile === "maximum" ? "L5" : "L3";

/** The neutral example for autoplay: a public TLS test site, answered from the cache. */
export const EXAMPLE_DOMAIN = "ecc256.badssl.com";

export interface PatchResult {
  level: Level;
  kem: string;
  sig: string;
  ms: number;
  verifyMs: number;
  clientHelloBytes: number;
  serverHelloBytes: number;
  ciphertextBytes: number;
  kemPublicKeyBytes: number;
  signatureBytes: number;
  sessionId: string;
  transcriptSha3: string;
}

export interface ProofResult {
  anchorId: number;
  checkpointId: number;
  blockHash: string;
  signature: string;
  keyId: string;
  alg: string;
  root: string;
  levels: string[][];
  labels: readonly string[];
  previous: { id: number; hash: string; kind: string }[];
  ms: number;
}

export interface SweepView {
  ok: boolean;
  ms: number;
  checked: number;
  merkleOk: boolean;
  broken?: { id: number; reason: string; detail: string; expected?: string; actual?: string };
  /** The scanner's score for the patched configuration (sim: the target isn't really patched). */
  patchedScore?: number;
}

export interface PipelineState {
  domain: string;
  cached: boolean;
  /** Index of the stage on screen (-1 before the first run). */
  stage: number;
  status: StageStatus[];
  /** performance.now() when each stage's real result arrived (0 = not yet). */
  doneAt: number[];
  level: Level;
  rekeyAt: number;
  scan?: ScanView;
  risk?: number;
  plan?: { steps: number; first?: string; horizonYear: number; yearsLeft: number };
  mosca: { x: number; y: number };
  patch?: PatchResult;
  proof?: ProofResult;
  sweep?: SweepView;
  tampered?: number;
  autoplay: boolean;
  error?: string;
}

const initial = (): PipelineState => ({
  domain: "",
  cached: false,
  stage: -1,
  status: STAGES.map(() => "idle"),
  doneAt: STAGES.map(() => 0),
  level: "L3",
  rekeyAt: 0,
  mosca: { x: 10, y: 3 },
  autoplay: false,
});

let state = initial();
/** The one snapshot the server renders (useSyncExternalStore needs it stable). */
const SERVER = initial();
const listeners = new Set<() => void>();
const set = (patch: Partial<PipelineState>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};
export const getPipeline = () => state;

export function usePipeline<T>(select: (s: PipelineState) => T): T {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => select(state),
    () => select(SERVER),
  );
}

const post = async <T>(url: string, body?: unknown): Promise<T> => {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errText(j, `${url} failed (${r.status})`));
  return j as T;
};

/** A line for the terminal (it also streams the server's bus). */
/** A line for the terminal (which also streams the server's bus), tagged with its stage. */
const say = (
  op: "SCAN" | "HANDSHAKE" | "SIGN" | "VERIFY" | "REJECT" | "LEDGER" | "KEYGEN",
  detail: string,
  ms = 0,
  ok = true,
  alg = "pipeline",
) => pushLocal({ op, alg, ms, ok, detail, site: `pipeline-${Math.max(0, state.stage)}` });

function setStatus(i: number, s: StageStatus) {
  const status = [...state.status];
  status[i] = s;
  const doneAt = [...state.doneAt];
  if (s === "done") doneAt[i] = performance.now();
  if (s === "idle") doneAt[i] = 0;
  set({ status, doneAt });
}

/** The shelf-life inputs (Mosca's X and Y). */
export const setMosca = (m: Partial<PipelineState["mosca"]>) =>
  set({ mosca: { ...state.mosca, ...m } });

/** Shor exposure: the share of the target's public-key primitives a quantum computer breaks. */
export function shorExposure(s: PipelineState): { pct: number; sim: boolean } {
  if (s.status[2] === "done") return { pct: 0, sim: true };
  if (!s.scan) return { pct: 100, sim: false };
  const kexClassical = !s.scan.probe.hybridPq;
  const certClassical = !/ML-DSA|SLH-DSA/i.test(s.scan.probe.certKey);
  return { pct: ((kexClassical ? 1 : 0) + (certClassical ? 1 : 0)) * 50, sim: false };
}

/** The status pill. */
export function threat(s: PipelineState): "critical" | "mitigating" | "secured" {
  if (s.status[4] === "done" && s.sweep?.ok) return "secured";
  if (s.status[2] === "done") return "mitigating";
  return "critical";
}

async function run(i: number, fn: () => Promise<void>) {
  if (state.status[i] === "running") return;
  set({ stage: i, error: undefined });
  setStatus(i, "running");
  try {
    await fn();
    setStatus(i, "done");
  } catch (e) {
    setStatus(i, "failed");
    set({ error: (e as Error).message, autoplay: false });
    say("REJECT", `${STAGES[i]!.name} failed: ${(e as Error).message}`, 0, false);
    throw e;
  }
}

export const actions = {
  /** 01 DETECT: a real TLS probe of the domain (or the labelled cached example). */
  detect: (domain = state.domain || EXAMPLE_DOMAIN, cachedOnly = !state.domain) =>
    run(0, async () => {
      // A new target clears every later stage.
      set({
        domain,
        scan: undefined,
        risk: undefined,
        plan: undefined,
        patch: undefined,
        proof: undefined,
        sweep: undefined,
        status: STAGES.map((_, k) => (k === 0 ? "running" : "idle")),
        doneAt: STAGES.map(() => 0),
      });
      say("SCAN", `$ ql scan ${domain}${cachedOnly ? " --cached" : ""}`);
      const r = await post<ScanView & { cached?: boolean }>("/api/scan/url", {
        url: domain,
        ...(cachedOnly ? { cachedOnly: true } : {}),
      });
      set({ scan: r, cached: !!r.cached, domain: r.probe.host });
      say(
        "SCAN",
        `${r.probe.host}: ${r.probe.protocol} · ${r.probe.group} · ${r.probe.certKey}${r.cached ? " (cached real scan)" : ""}`,
        0,
        r.probe.hybridPq,
        r.probe.group,
      );
    }),

  /** 02 SCORE: the server's migration plan for these findings, with shelf-life X. */
  score: () =>
    run(1, async () => {
      const s = state.scan;
      if (!s) throw new Error("Run the scan first");
      const t = performance.now();
      const plan = await post<{
        steps: { title: string }[];
        assumptions: { horizonYear: number; yearsLeft: number };
      }>("/api/plan", {
        findings: s.findings,
        dataLifetimeYears: state.mosca.x,
        source: "url",
        hybridPq: s.probe.hybridPq,
      });
      const risk = Math.max(0, Math.min(100, 100 - s.score));
      set({
        risk,
        plan: {
          steps: plan.steps.length,
          first: plan.steps[0]?.title,
          horizonYear: plan.assumptions.horizonYear,
          yearsLeft: plan.assumptions.yearsLeft,
        },
      });
      say(
        "SCAN",
        `risk ${risk}/100 · ${plan.steps.length}-step plan · ${plan.steps[0]?.title ?? "nothing to fix"}`,
        performance.now() - t,
        risk < 50,
      );
    }),

  /** 03 DEFEND: a real hybrid handshake at the selected level, in a worker. */
  defend: () =>
    run(2, async () => {
      const L = LEVELS[state.level];
      say("KEYGEN", `$ ql patch --level ${state.level} (${L.kem} + ${L.sig})`);
      await hs.identity(L.profile);
      const t = performance.now();
      const c = await hs.hello(L.profile);
      say("HANDSHAKE", `ClientHello · X25519 share · ${c.bytes} B`, c.ms, true, "x25519");
      const sr = await hs.respond();
      say(
        "SIGN",
        `ServerHello · ${L.kem} key ${sr.kemPkBytes} B · ${L.sig} signature ${sr.sigBytes} B`,
        sr.ms,
        true,
        L.sig.toLowerCase(),
      );
      const f = await hs.finish();
      say(
        "VERIFY",
        `${L.sig} verified · ${L.kem} ciphertext ${f.bytes} B · HKDF → session ${f.sessionId.slice(0, 8)}`,
        f.tc + f.ts,
        true,
        L.kem.toLowerCase(),
      );
      set({
        patch: {
          level: state.level,
          kem: L.kem,
          sig: L.sig,
          ms: performance.now() - t,
          verifyMs: f.tc,
          clientHelloBytes: c.bytes,
          serverHelloBytes: sr.bytes,
          ciphertextBytes: f.kemCiphertext.length,
          kemPublicKeyBytes: sr.kemPkBytes,
          signatureBytes: sr.sigBytes,
          sessionId: f.sessionId,
          transcriptSha3: f.transcriptSha3,
        },
      });
    }),

  /** 04 PROVE: anchor the run (scan, CBOM, policy, transcript) to the Proof Chain. */
  prove: () =>
    run(3, async () => {
      const { scan, patch } = state;
      if (!scan || !patch) throw new Error("Apply the patch first");
      const scanJson = JSON.stringify({
        host: scan.probe.host,
        protocol: scan.probe.protocol,
        group: scan.probe.group,
        certKey: scan.probe.certKey,
        score: scan.score,
        scannedAt: scan.scannedAt,
      });
      const cbomSha3 = await hs.sha3(JSON.stringify(scan.cbom));
      const policy = JSON.stringify({ level: patch.level, kem: patch.kem, sig: patch.sig });
      const r = await post<{
        anchor: { id: number; hash: string; sig: string; keyId: string; alg: string };
        checkpoint: { id: number };
        tree: { levels: string[][]; root: string };
        previous: { id: number; hash: string; kind: string }[];
        labels: string[];
        ms: number;
      }>("/api/proof/anchor", {
        domain: scan.probe.host,
        scan: scanJson,
        cbomSha3,
        policy,
        transcriptSha3: patch.transcriptSha3,
      });
      set({
        proof: {
          anchorId: r.anchor.id,
          checkpointId: r.checkpoint.id,
          blockHash: r.anchor.hash,
          signature: r.anchor.sig,
          keyId: r.anchor.keyId,
          alg: r.anchor.alg,
          root: r.tree.root,
          levels: r.tree.levels,
          labels: r.labels,
          previous: r.previous,
          ms: r.ms,
        },
      });
      say(
        "LEDGER",
        `Block #${r.anchor.id} · merkle ${r.tree.root.slice(0, 12)}… · ${r.anchor.alg} signed`,
        r.ms,
        true,
        "sha3-256",
      );
    }),

  /** 05 RESCAN: the sweep, and the scanner re-run on the patched configuration (sim). */
  rescan: () =>
    run(4, async () => {
      const { proof, patch, scan } = state;
      if (!proof || !patch || !scan) throw new Error("Anchor the proof first");
      const r = await post<{
        ok: boolean;
        ms: number;
        segment: { checked: number };
        merkle: { ok: boolean };
        broken?: SweepView["broken"];
      }>(`/api/proof/${proof.anchorId}/verify`);
      // The patched configuration, as the scanner would read it (the target isn't really patched).
      const L = LEVELS[patch.level];
      const report = `# TLS details for ${scan.probe.host} (patched, sim)\nprotocol = TLSv1.3\ncipher = TLS_AES_256_GCM_SHA384\nkey_exchange_group = ${L.group}\ncertificate_key = ${L.sig}\ncertificate_signature = ${L.sig}`;
      const re = await post<{ score: number }>("/api/scan", {
        text: report,
        filename: `${scan.probe.host}.patched`,
      });
      set({
        sweep: {
          ok: r.ok,
          ms: r.ms,
          checked: r.segment.checked + 1,
          merkleOk: r.merkle.ok,
          broken: r.broken,
          patchedScore: re.score,
        },
        risk: r.ok ? Math.max(0, 100 - re.score) : state.risk,
      });
      say(
        r.ok ? "VERIFY" : "REJECT",
        r.ok
          ? `sweep ✓ checkpoint #${proof.checkpointId} + ${r.segment.checked} entries + Merkle root · patched score ${re.score} (sim)`
          : `sweep stopped at #${r.broken?.id}: ${r.broken?.detail ?? "Merkle root mismatch"}`,
        r.ms,
        r.ok,
        "ml-dsa · sha3-256",
      );
      if (!r.ok) throw new Error(r.broken?.detail ?? "Merkle root mismatch");
    }),

  /** Edits the anchored block in the database, the way an insider would. */
  tamper: async () => {
    const id = state.proof?.anchorId;
    if (!id) return;
    await post("/api/ledger/tamper", { id });
    set({ tampered: id });
    setStatus(4, "idle");
    say(
      "REJECT",
      `insider edits Proof Chain entry #${id} directly in the database`,
      0,
      false,
      "tamper",
    );
  },

  /** Puts everything back and returns to the start (keeps the target). */
  replay: async () => {
    set({ autoplay: false });
    if (state.tampered) await post("/api/ledger/tamper", { restore: true }).catch(() => {});
    const { domain, cached, level, mosca } = state;
    state = { ...initial(), domain, cached, level, mosca };
    listeners.forEach((fn) => fn());
  },

  /** L1 / L3 / L5: switches the live policy for real; the stage re-keys. */
  setLevel: async (level: Level) => {
    if (level === state.level) return;
    const prev = state.level;
    set({ level, rekeyAt: performance.now() });
    try {
      await post("/api/policy", { profile: LEVELS[level].profile });
      say(
        "KEYGEN",
        `policy → ${level} ${LEVELS[level].label}: ${LEVELS[level].kem} · ${LEVELS[level].sig}`,
      );
    } catch (e) {
      set({ level: prev, error: (e as Error).message });
    }
  },

  /** Picks up the server's current policy (another tab or the presenter may have changed it). */
  syncLevel: (profile: string) => {
    const level = levelOf(profile);
    if (level !== state.level) set({ level });
  },

  setDomain: (domain: string) => set({ domain }),
  /** ← / →: look at another stage that has already run (the camera only; nothing re-runs). */
  view: (i: number) => {
    const last = state.status.lastIndexOf("done");
    if (i >= 0 && i <= Math.max(last, state.stage)) set({ stage: i });
  },
  setAutoplay: (on: boolean) => set({ autoplay: on }),
};

const RUN = [actions.detect, actions.score, actions.defend, actions.prove, actions.rescan];

/** Runs stage i (its CTA). */
export const runStage = (i: number) => RUN[i]!().catch(() => {});

/** The next stage to run, or -1 when all are done. */
export const nextStage = (s = state) => s.status.findIndex((x) => x !== "done");

/**
 * Autoplay: each stage starts after the previous one's real result has arrived and been on screen
 * for at least `holdMs`. Stops on a failure, at the end, or when switched off.
 */
export async function autoplay(holdMs = 1500) {
  set({ autoplay: true });
  while (state.autoplay) {
    const i = nextStage();
    if (i < 0) break;
    const prev = i > 0 ? state.doneAt[i - 1]! : 0;
    const wait = prev ? Math.max(0, holdMs - (performance.now() - prev)) : 0;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    if (!state.autoplay) break;
    try {
      await RUN[i]!();
    } catch {
      break;
    }
  }
  set({ autoplay: false });
}

/** What the stage frame says: the bracketed title and the numbered caption, per stage and status. */
export function stageText(s: PipelineState): { title: string; caption: string; role: string } {
  const i = s.stage;
  const st = i >= 0 ? s.status[i]! : "idle";
  if (i < 0)
    return {
      title: "AWAITING TARGET",
      caption: "00 · STANDBY — Enter a domain to begin",
      role: "muted",
    };
  const done = st === "done";
  switch (STAGES[i]!.id) {
    case "detect":
      return {
        title: done ? "HARVESTING" : "SCANNING TARGET",
        caption: "01 · THE THREAT — Encrypted today, recorded for later",
        role: "danger",
      };
    case "score":
      return {
        title: done ? "SHELF-LIFE EXPIRING" : "SCORING RISK",
        caption: "02 · THE RISK — The stolen data outlives its lock",
        role: "warn",
      };
    case "defend":
      return {
        title: done ? "LATTICE CRYPTOGRAPHY ENGAGED" : "AWAITING PQC PATCH",
        caption: "03 · THE FIX — Swap the lock for a lattice",
        role: "kem",
      };
    case "prove":
      return {
        title: done ? "STATE ANCHORED TO PROOF CHAIN" : "READY TO ANCHOR",
        caption: "04 · THE PROOF — Locked into the chain",
        role: "sig",
      };
    default:
      if (st === "failed")
        return {
          title: "TAMPER DETECTED",
          caption: "05 · TAMPER — The sweep stops at the edited block",
          role: "danger",
        };
      return {
        title: done ? "VERIFIED" : "VERIFICATION SWEEP",
        caption: "05 · THE RESULT — Quantum-safe, and provably so",
        role: "ok",
      };
  }
}
