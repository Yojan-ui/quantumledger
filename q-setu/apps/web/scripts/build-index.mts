/**
 * India Quantum Readiness Index: `pnpm index:build`.
 *
 * Reads data/readiness-targets.json (about 100 public Indian domains, by sector) and makes ONE TLS
 * handshake to port 443 of each, one every 2 seconds, with the same probe the URL scanner uses. It
 * records only what any browser sees when it connects: TLS version, the negotiated key-exchange
 * group and the certificate's key type. Nothing else is requested, probed or attacked.
 *
 * Output: data/readiness-index.json holds sector AGGREGATES only (counts, never per-site results),
 * with the scan dates. Per-site results go to .data/readiness-raw.json (gitignored) for audit.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { probeTls, type TlsProbe } from "../lib/live/tls";

const GAP_MS = 2000;
const [major, minor] = process.versions.openssl.split(".").map(Number) as [number, number];
if (major < 3 || (major === 3 && minor < 5)) {
  // Without OpenSSL 3.5 this client can't offer X25519MLKEM768, and every site would look classical.
  console.error(
    `OpenSSL ${process.versions.openssl} can't offer hybrid PQ key exchange; need ≥ 3.5`,
  );
  process.exit(1);
}

const targets = JSON.parse(
  readFileSync(new URL("../data/readiness-targets.json", import.meta.url), "utf8"),
) as { sectors: Record<string, string[]> };

export interface SectorAggregate {
  targets: number;
  reachable: number;
  hybridPq: number;
  tls13: number;
  tls12OrOlder: number;
  rsa2048: number;
  rsaAny: number;
  ecdsa: number;
  groups: Record<string, number>;
}

const empty = (): SectorAggregate => ({
  targets: 0,
  reachable: 0,
  hybridPq: 0,
  tls13: 0,
  tls12OrOlder: 0,
  rsa2048: 0,
  rsaAny: 0,
  ecdsa: 0,
  groups: {},
});

function add(a: SectorAggregate, p: TlsProbe | null) {
  a.targets++;
  if (!p) return;
  a.reachable++;
  if (p.hybridPq) a.hybridPq++;
  if (p.protocol === "TLSv1.3") a.tls13++;
  else a.tls12OrOlder++;
  if (/^RSA 2048/.test(p.certKey)) a.rsa2048++;
  if (/^RSA/.test(p.certKey)) a.rsaAny++;
  if (/^ECDSA/.test(p.certKey)) a.ecdsa++;
  a.groups[p.group] = (a.groups[p.group] ?? 0) + 1;
}

const startedAt = new Date().toISOString();
const sectors: Record<string, SectorAggregate> = {};
const all = empty();
const raw: Record<string, unknown>[] = [];
let first = true;
for (const [sector, hosts] of Object.entries(targets.sectors)) {
  const agg = (sectors[sector] = empty());
  for (const host of hosts) {
    if (!first) await new Promise((r) => setTimeout(r, GAP_MS));
    first = false;
    let p: TlsProbe | null = null;
    try {
      p = await probeTls(host);
      console.log("✓", sector.padEnd(10), host.padEnd(32), p.protocol, p.group, p.certKey);
    } catch (e) {
      console.log("✗", sector.padEnd(10), host.padEnd(32), (e as Error).message);
    }
    add(agg, p);
    add(all, p);
    raw.push({
      sector,
      host,
      ok: !!p,
      ...(p && { protocol: p.protocol, group: p.group, certKey: p.certKey }),
    });
  }
}

const out = {
  name: "India Quantum Readiness Index",
  startedAt,
  finishedAt: new Date().toISOString(),
  method:
    "One TLS handshake per domain to port 443, offering X25519MLKEM768 first, then X25519, P-256 and P-384; one domain every 2 s. Recorded: TLS version, negotiated key-exchange group, certificate key type.",
  client: `Node ${process.versions.node}, OpenSSL ${process.versions.openssl}`,
  sectors,
  all,
};
writeFileSync(
  new URL("../data/readiness-index.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n",
);
mkdirSync(new URL("../.data/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../.data/readiness-raw.json", import.meta.url),
  JSON.stringify(raw, null, 2),
);
console.log(
  `\n${all.reachable}/${all.targets} reachable · ${all.hybridPq} hybrid PQ · ${all.rsa2048} RSA-2048`,
);
