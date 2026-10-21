/**
 * Runs the lab locally: the evidence store, the live sandbox (bare and protected legacy-bank, with
 * the recorder on the protected copy) and the dashboard API.
 *
 *   pnpm --filter @qsetu/attack-lab dev
 *
 * Env: ATTACK_LAB_DIR (default packages/attack-lab/.data), ATTACK_LAB_IDENTITY (a Shield identity
 * file, as used by `qsetu-shield --identity`; created in ATTACK_LAB_DIR if unset), LAB_PORT (4100),
 * SANDBOX_BARE_PORT (4101), SANDBOX_PROTECTED_PORT (4102), ATTACK_LAB_SEED=1 to send test traffic
 * on start when the store is empty.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startSandbox } from "./sandbox";
import { startLabServer } from "./server";
import { loadSigner } from "./sign";
import { CustomerRegistry } from "./customers";
import { simulate, SITE_HEADER } from "./simulate";
import { EvidenceStore } from "./store";

const dir = process.env.ATTACK_LAB_DIR ?? fileURLToPath(new URL("../.data", import.meta.url));
mkdirSync(dir, { recursive: true });

function secretFile(name: string): string {
  const p = join(dir, name);
  if (!existsSync(p)) {
    writeFileSync(p, randomBytes(32).toString("hex"));
    chmodSync(p, 0o600);
  }
  return readFileSync(p, "utf8").trim();
}

const signer = loadSigner(process.env.ATTACK_LAB_IDENTITY ?? join(dir, "identity.json"));
const store = new EvidenceStore({ signer, dir });
const salt = secretFile("salt");
const customers = new CustomerRegistry(join(dir, "customers.json"));
// Fixed per lab so records that mention the canary stay replayable across restarts.
const canaryKey = `sk_live_${secretFile("canary").slice(0, 24)}`;

const sandbox = await startSandbox({
  barePort: Number(process.env.SANDBOX_BARE_PORT ?? 4101),
  protectedPort: Number(process.env.SANDBOX_PROTECTED_PORT ?? 4102),
  // One sandbox stands in for every customer's site: the lab's own test traffic names the site in a
  // header, and anything else counts as the first customer's. Sandbox only: a real install records
  // one fixed site.
  record: {
    store,
    salt,
    site: (req) => {
      const h = req.headers[SITE_HEADER];
      const sites = customers.sites();
      return typeof h === "string" && sites.includes(h) ? h : (sites[0] ?? "default");
    },
  },
  canaryKey,
});
const lab = await startLabServer({
  store,
  sandbox,
  customers,
  port: Number(process.env.LAB_PORT ?? 4100),
  ...(process.env.ATTACK_LAB_TOKEN ? { token: process.env.ATTACK_LAB_TOKEN } : {}),
});

const check = store.verify();
console.log(
  `[attack-lab] evidence   ${dir}/records.jsonl  (${check.records} records, chain ${check.ok ? "ok" : `BROKEN at ${check.problems.map((p) => p.seq).join(", ")}`})`,
);
console.log(`[attack-lab] signing    ML-DSA-65, key ${signer.keyId}`);
console.log(`[attack-lab] sandbox    bare ${sandbox.bare}  ·  protected ${sandbox.protected}`);
console.log(`[attack-lab] api        ${lab.url}/api/overview`);

if (process.env.ATTACK_LAB_SEED === "1" && store.size === 0) {
  console.log("[attack-lab] empty store: sending labelled test traffic to the protected sandbox");
  void simulate(sandbox.protected, sandbox, undefined, customers.sites()).then(() =>
    store.sealDirty(),
  );
}

const stop = async () => {
  store.close();
  await Promise.all([lab.close(), sandbox.close()]);
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
