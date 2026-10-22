/**
 * npm run train: trains the threat model on this lab's recorded evidence and writes the weights the
 * engine loads (<data dir>/model/weights.json). With --ship it also refreshes the pre-trained
 * weights shipped with the package (src/model/weights.json), used when a lab has no data yet.
 * Training is offline and takes milliseconds; data beyond MAX_SAMPLES is trimmed to the newest.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSigner } from "../sign";
import { EvidenceStore } from "../store";
import { saveWeights, SHIPPED_WEIGHTS, train } from "./learn";

const dir = process.env.ATTACK_LAB_DIR ?? fileURLToPath(new URL("../../.data", import.meta.url));
if (!existsSync(join(dir, "records.jsonl"))) {
  console.error(
    `No evidence at ${dir}/records.jsonl yet: run the lab and send some test traffic first.`,
  );
  process.exit(1);
}
const store = new EvidenceStore({
  signer: loadSigner(process.env.ATTACK_LAB_IDENTITY ?? join(dir, "identity.json")),
  dir,
});
const normalPath = join(dir, "model", "normal.json");
const normal = existsSync(normalPath)
  ? (JSON.parse(readFileSync(normalPath, "utf8")) as number[][])
  : [];
const { weights } = train(store.allEvents(), normal);
mkdirSync(join(dir, "model"), { recursive: true });
saveWeights(join(dir, "model", "weights.json"), weights);
if (process.argv.includes("--ship")) saveWeights(fileURLToPath(SHIPPED_WEIGHTS), weights);
const m = weights.metrics;
console.log(
  `trained ${weights.version}: ${m.samples} samples from ${m.attacks} attacks${m.capped ? " (trimmed to the newest)" : ""}, ` +
    `${Math.round(m.accuracy * 100)}% correct on ${m.heldOut} held-back requests, in ${m.ms} ms`,
);
