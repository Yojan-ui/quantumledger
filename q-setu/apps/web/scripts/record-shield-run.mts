/**
 * `npx tsx --conditions=react-server scripts/record-shield-run.mts` (from apps/web): runs "Shield plugs
 * in" for real once per install mode (lib/server/shield-plugin, on loopback) and writes the events to
 * data/shield-runs.json. The homepage's scroll-driven scene plays these recorded runs (labelled as a
 * recorded run, with its date) instead of starting a run for every visitor; /demo/deploy runs live.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The report this signs goes to a throwaway directory: the recording is about the events.
process.env.QSETU_DATA_DIR = mkdtempSync(join(tmpdir(), "shield-record-"));
const { runPlugin } = await import("../lib/server/shield-plugin");
type Ev = Parameters<Parameters<typeof runPlugin>[1]>[0];

const runs: Record<string, Ev[]> = {};
for (const mode of ["dns", "container", "code"] as const) {
  const events: Ev[] = [];
  await runPlugin(mode, (e) => events.push(e));
  if (events.some((e) => e.t === "error")) throw new Error(JSON.stringify(events.at(-1)));
  runs[mode] = events;
}
const out = new URL("../data/shield-runs.json", import.meta.url).pathname;
writeFileSync(
  out,
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      node: process.version,
      openssl: process.versions.openssl,
      runs,
    },
    null,
    1,
  ) + "\n",
);
console.log(`wrote ${out}`);
