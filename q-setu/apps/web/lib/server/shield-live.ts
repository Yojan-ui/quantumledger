import "server-only";
/**
 * /shield/live: the attack suite against the legacy bank app twice, side by side: bare (plain HTTP,
 * no Shield) and behind a fresh Shield Edge in protect mode. Everything runs on this server's
 * loopback interface; the suite itself refuses any other host. One run at a time.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  CertStore,
  edgeDefence,
  PQ_GROUPS,
  runSuite,
  selfSignedCert,
  startEdge,
  tlsCheck,
  type AttackResult,
  type GuardInput,
} from "@qsetu/shield-edge";
import { ensureShieldStack, LEGACY } from "./shield-stack";

const NAME = "bank.shield-live.test";
const CANARY = "qsk_canary_demo_9b1c";
let running = false;

export interface LiveRun {
  bare: AttackResult[];
  edge: AttackResult[];
  tls: { bare: Awaited<ReturnType<typeof tlsCheck>>; edge: Awaited<ReturnType<typeof tlsCheck>> };
  ms: number;
}

export async function runLive(): Promise<LiveRun | "busy"> {
  if (running) return "busy";
  running = true;
  const t0 = performance.now();
  const dir = mkdtempSync(join(tmpdir(), "shield-live-"));
  try {
    await ensureShieldStack();
    const pair = selfSignedCert([NAME], 1);
    const certs = new CertStore(dir, randomBytes(32).toString("base64"), {
      ecdhCurve: PQ_GROUPS,
      minVersion: "TLSv1.2",
    });
    certs.put(NAME, pair);
    // A fresh defence state per attack, so one attack's block doesn't decide the next one's result.
    const fresh = () =>
      edgeDefence({
        mode: "protect",
        secret: randomBytes(32).toString("base64"),
        canaryKeys: [CANARY],
        powBits: 16,
      });
    let defence = fresh();
    const edge = await startEdge({
      port: 0,
      host: "127.0.0.1",
      origin: LEGACY,
      certs,
      fallbackCert: pair,
      guard: (g: GuardInput) => defence.guard!(g),
      intercept: {
        path: "/.well-known/qsetu/pow",
        maxBytes: 2048,
        handle: (b, g) => defence.intercept!.handle(b, g),
      },
      onResponse: (g, s) => defence.onResponse!(g, s),
    });
    try {
      const bareTarget = { label: "Bare", url: LEGACY };
      const edgeTarget = {
        label: "Shield Edge",
        url: `https://127.0.0.1:${edge.address().port}`,
        servername: NAME,
      };
      const bare = await runSuite(bareTarget);
      const shielded = await runSuite(edgeTarget, undefined, () => {
        defence = fresh();
      });
      return {
        bare,
        edge: shielded,
        tls: { bare: await tlsCheck(bareTarget), edge: await tlsCheck(edgeTarget) },
        ms: Math.round(performance.now() - t0),
      };
    } finally {
      await edge.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    running = false;
  }
}
