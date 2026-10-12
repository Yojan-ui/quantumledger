import "server-only";
import { join } from "node:path";
import { getSig } from "@qsetu/core";
import type { NetEvent } from "@qsetu/sim";
import { routeIndex, SECTOR_PATHS, type City } from "@/data/routes";
import { openFromEnv } from "@/lib/db/connect";
import type { Repos } from "@/lib/db/repo";
import { Bus } from "@/lib/live/bus";
import { DbKeyStore, KeyManager, loadKek, type KeyPurpose } from "@/lib/live/keystore";
import { Ledger, type LedgerSigner } from "@/lib/live/ledger";
import { Mesh } from "@/lib/live/mesh";
import { Policy } from "@/lib/live/policy";
import { RateLimiter } from "@/lib/live/rate-limit";
import { Room } from "@/lib/live/room";
import { ROOM_EMOJI } from "@/data/room";
import { KEM_LABEL } from "@/lib/live/types";

/** Where the SQLite database and (if QSETU_KMS_KEK is unset) the demo KEK live. Gitignored. */
export const DATA_DIR = process.env.QSETU_DATA_DIR ?? join(process.cwd(), ".data");
/** Scheduled key rotation interval (default 10 minutes). */
const ROTATE_MS = Number(process.env.QSETU_ROTATE_MS) || 10 * 60_000;
const ROTATING: KeyPurpose[] = ["ledger", "tx-signing", "mesh-identity"];

export interface Runtime {
  bus: Bus;
  policy: Policy;
  keys: KeyManager;
  ledger: Ledger;
  mesh: Mesh;
  repos: Repos;
  scanLimiter: RateLimiter;
}

// Next.js can bundle each route separately, so singletons live on globalThis.
const g = globalThis as unknown as {
  __qsetuBus?: Bus;
  __qsetuRuntime?: Promise<Runtime>;
  __qsetuRoom?: Room;
};

/** The live event bus. Synchronous and dependency-free, so anything can publish to it at once. */
export function getBus(): Bus {
  return (g.__qsetuBus ??= new Bus());
}

/**
 * The audience room (phones sealing messages to this server). In memory and per process: its key
 * pair is created at start-up and never stored. Opened and rejected packets go on the bus too.
 */
export function getRoom(): Room {
  if (g.__qsetuRoom) return g.__qsetuRoom;
  const room = (g.__qsetuRoom = new Room(Date.now, Math.random, ROOM_EMOJI));
  room.subscribe((e) => {
    if (e.kind === "join") return;
    getBus().publish({
      op: e.kind === "sealed" ? "OPEN" : "REJECT",
      source: "room",
      alg: "ml-kem-768+x25519",
      ms: e.openMs,
      bytes: e.bytes,
      ok: e.kind === "sealed",
      detail:
        e.kind === "sealed"
          ? `${e.visitor.name}'s message opened`
          : `${e.visitor.name}'s tampered packet rejected: ${e.reason}`,
    });
  });
  return room;
}

async function create(): Promise<Runtime> {
  const bus = getBus();
  const policy = new Policy();
  const repos = await openFromEnv(DATA_DIR);
  const keys = new KeyManager(await DbKeyStore.open(repos.kms), loadKek(DATA_DIR));

  const signer: LedgerSigner = {
    current: () => {
      const k = keys.active("ledger", "ml-dsa-65");
      return { keyId: k.meta.id, alg: k.meta.alg };
    },
    sign: (m) => {
      const k = keys.active("ledger", "ml-dsa-65");
      return {
        signature: getSig(k.meta.alg).sign(m, k.secretKey),
        keyId: k.meta.id,
        alg: k.meta.alg,
      };
    },
    publicKey: (id) => keys.publicKey(id),
  };
  const ledger = new Ledger(repos.ledger, signer);

  ledger.onAppend((e, ms) =>
    bus.publish({
      op: "LEDGER",
      source: "ledger",
      alg: `sha3-256 · ${e.alg}`,
      ms,
      ok: true,
      detail: `#${e.id} ${e.kind} ${e.subject}`,
    }),
  );
  // Key events go on the bus now and into the ledger's queue (it signs with a KMS key).
  keys.onEvent((e) => {
    bus.publish({
      op: e.kind,
      source: "kms",
      alg: e.key.alg,
      ms: e.ms,
      ok: true,
      detail: `${e.key.purpose} v${e.key.version}`,
    });
    queueMicrotask(
      () =>
        void ledger.append(e.kind === "KEYGEN" ? "keygen" : "key-rotation", e.key.id, {
          purpose: e.key.purpose,
          alg: e.key.alg,
          version: e.key.version,
          ...(e.previous ? { previous: e.previous } : {}),
          store: keys.storeKind,
        }),
    );
  });
  policy.onChange((next, prev) => {
    bus.publish({
      op: "POLICY",
      source: "policy",
      alg: `${KEM_LABEL[next.profile]} · ${next.sig}`,
      ms: 0,
      ok: true,
      detail: `g${next.generation}: sessions re-key at their next rotation`,
    });
    void ledger.append("policy", `g${next.generation}`, {
      from: `${prev.profile} · ${prev.sig}`,
      to: `${next.profile} · ${next.sig}`,
    });
  });

  if ((await ledger.count()) === 0)
    await ledger.append("genesis", "q-ledger", {
      note: "Append-only audit log: SHA3-256 chain, ML-DSA-65 signatures.",
    });

  const mesh = new Mesh(bus, policy, keys, ledger);
  // Only do work while someone is watching the stream.
  mesh.start(() => bus.listeners() > 0);
  setInterval(() => ROTATING.forEach((p) => keys.rotate(p)), ROTATE_MS).unref();
  // Warm-up: check every existing signature once, in the background (it yields as it goes), so the
  // first "Verify the chain" in a demo only re-hashes. Its result is discarded; verifies stay real.
  setTimeout(() => void ledger.warm(), 2000).unref();

  return { bus, policy, keys, ledger, mesh, repos, scanLimiter: new RateLimiter(6, 60_000) };
}

/** The whole live runtime (database, KMS, ledger, mesh), created once per process. */
export function live(): Promise<Runtime> {
  g.__qsetuRuntime ??= create().catch((e) => {
    g.__qsetuRuntime = undefined;
    throw e;
  });
  return g.__qsetuRuntime;
}

/** Seeds the ledger with real transactions so the demo always has an entry #42 to tamper with. */
export async function ensureLedgerSeeded(min = 48): Promise<void> {
  const { ledger, mesh } = await live();
  const missing = min - (await ledger.count());
  if (missing > 0) {
    mesh.burst(missing);
    await ledger.flush();
  }
}

export async function policyState() {
  const { policy, mesh } = await live();
  return { ...policy.get(), ...mesh.status() };
}

/** Bridges a simulator hop (Demos 2 and 3) onto the bus. Classical (insecure) packets are skipped. */
export function publishNetEvent(e: NetEvent): void {
  if (e.mode !== "qsetu" || !e.hop || !e.packet) return;
  const path = SECTOR_PATHS[e.sector];
  if (!path) return;
  const [from, to] = (e.hop === "ab" ? [path[0], path[1]] : [path[1], path[2]]) as [City, City];
  const base = {
    source: "sim" as const,
    route: routeIndex(from, to),
    from,
    to,
    sector: e.sector,
    ms: e.packet.cryptoMs ?? 0,
    bytes: e.packet.bytes,
  };
  const bus = getBus();
  if (e.stage === "sent")
    bus.publish({ ...base, op: "SEAL", alg: "ml-kem-768+x25519", ok: true, detail: e.recordId });
  else if (e.stage === "rejected")
    bus.publish({
      ...base,
      op: "REJECT",
      alg: "ml-dsa-65",
      ok: false,
      detail: `${e.recordId} rejected`,
    });
  else if (e.stage === "verified" || e.stage === "delivered")
    bus.publish({ ...base, op: "VERIFY", alg: "ml-dsa-65", ok: true, detail: e.recordId });
}
