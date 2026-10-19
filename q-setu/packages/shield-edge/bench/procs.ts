/**
 * Child processes for the benchmark: the legacy bank (the origin) and Shield Edge. Each runs in its
 * own process so their CPU can be measured separately, and answers "stats" over IPC with its CPU
 * time and memory.
 */
import { createLegacyApp } from "../../../apps/legacy-bank/src/app";
import { CertStore } from "../src/certs";
import { PQ_GROUPS, startEdge } from "../src/edge";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selfSigned } from "../test/fixtures";

const role = process.argv[2];
const port = Number(process.argv[3]);

async function main() {
  let extra: () => Record<string, unknown> = () => ({});
  if (role === "origin") {
    await new Promise<void>((r) => createLegacyApp(() => {}).listen(port, "127.0.0.1", () => r()));
  } else {
    const origin = process.argv[4]!;
    const certs = new CertStore(mkdtempSync(join(tmpdir(), "bench-")), "b".repeat(40), {
      ecdhCurve: PQ_GROUPS,
      minVersion: "TLSv1.2",
    });
    const pair = selfSigned(["bank.bench.test"]);
    certs.put("bank.bench.test", pair);
    // Also the certificate for clients that send no SNI (autocannon, to an IP address).
    const edge = await startEdge({ port, host: "127.0.0.1", origin, certs, fallbackCert: pair });
    extra = () => ({ metrics: edge.metrics.snapshot() });
  }
  process.on("message", (m) => {
    if (m === "stats")
      process.send!({ cpu: process.cpuUsage(), rss: process.memoryUsage().rss, ...extra() });
  });
  process.send!("ready");
}
void main();
