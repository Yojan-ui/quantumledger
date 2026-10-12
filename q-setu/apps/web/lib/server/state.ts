import "server-only";
import { createIdentity, runBench, utf8ToBytes, type BenchReport } from "@qsetu/core";
import { createSessionServer } from "@qsetu/sdk";
import { SectorNetwork, type SectorId } from "@qsetu/sim";
import { createVault, generateVaultKeys, memoryStore } from "@qsetu/vault";
import { demoWebShieldKeys, webShieldKeysFromSeed } from "@qsetu/web-shield";
import { sha256 } from "@noble/hashes/sha2.js";
import { publishNetEvent } from "./runtime";

// Next.js can bundle each route separately, so process-wide singletons live on globalThis.
type State = {
  networks: Partial<Record<SectorId, SectorNetwork>>;
  bench?: Promise<BenchReport>;
  webShield?: ReturnType<typeof demoWebShieldKeys>;
  sdkServer?: ReturnType<typeof createSessionServer>;
  vault?: { vault: ReturnType<typeof createVault>; store: ReturnType<typeof memoryStore> };
};
const g = globalThis as unknown as { __qsetu?: State };
const state = (g.__qsetu ??= { networks: {} });

export function getNetwork(sector: SectorId): SectorNetwork {
  let net = state.networks[sector];
  if (!net) {
    net = state.networks[sector] = new SectorNetwork(sector);
    // Every QuantumLedger hop the simulator carries also appears on the live bus.
    net.subscribe(publishNetEvent);
  }
  return net;
}

export function getBench(fresh = false): Promise<BenchReport> {
  if (fresh || !state.bench) state.bench = runBench(25);
  return state.bench;
}

/** Web-shield server keys. Demo: derived from a public seed so static pages can pin the key ID. */
export function getWebShieldKeys() {
  const seed = process.env.QSETU_WEB_SHIELD_SEED;
  return (state.webShield ??= seed
    ? webShieldKeysFromSeed(sha256(utf8ToBytes(seed)))
    : demoWebShieldKeys());
}

export function getSdkServer() {
  return (state.sdkServer ??= createSessionServer({ identity: createIdentity("standard") }));
}

export function getVault() {
  if (!state.vault) {
    const store = memoryStore();
    state.vault = { store, vault: createVault({ keys: generateVaultKeys("standard"), store }) };
  }
  return state.vault;
}
