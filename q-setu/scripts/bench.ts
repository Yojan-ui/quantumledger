/**
 * `pnpm bench`: runs the SDK benchmarks and prints a table. Pass `--json` for raw output,
 * or `--iterations N` to change the sample count (default 50).
 */
import { runBench, type BenchRow } from "../packages/core/src";

const args = process.argv.slice(2);
const iterations = Number(args[args.indexOf("--iterations") + 1]) || 50;

const fmt = (ms: number | undefined) => (ms === undefined ? "" : `${ms.toFixed(3)} ms`);
const ops = (r: BenchRow) =>
  r.kind === "kem"
    ? [r.ops.keygen, r.ops.encapsulate, r.ops.decapsulate]
    : r.kind === "sig"
      ? [r.ops.keygen, r.ops.sign, r.ops.verify]
      : [undefined, r.ops.seal, r.ops.open];

const report = await runBench(iterations);
if (args.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`QuantumLedger benchmarks: ${report.runtime}, median of ${iterations} runs\n`);
  console.table(
    report.rows.map((r) => {
      const [a, b, c] = ops(r);
      return {
        algorithm: r.name,
        "quantum-safe": r.quantumSafe ? "yes" : "no",
        keygen: fmt(a),
        "encaps / sign / seal": fmt(b),
        "decaps / verify / open": fmt(c),
        "pk bytes": r.sizes.publicKey,
        "ct / sig bytes": r.sizes.output,
      };
    }),
  );
  console.log(
    "\nSessions: the post-quantum handshake runs once, then every message is AES-256-GCM\n",
  );
  console.table(
    report.sessions.map((s) => ({
      profile: s.profile,
      "PQC handshake": fmt(s.handshakeMs),
      "classical handshake": fmt(s.classicalHandshakeMs),
      "handshake bytes": s.handshakeBytes,
      "per message (256 B)": `${s.perMessageUs.toFixed(1)} µs`,
      "plain AES-GCM": `${s.baselineMessageUs.toFixed(1)} µs`,
      "bytes added / msg": s.messageOverheadBytes,
      "1 handshake + 1000 msgs": fmt(s.handshakeMs + (s.perMessageUs * 1000) / 1000),
    })),
  );
}
