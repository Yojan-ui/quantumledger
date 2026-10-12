/**
 * qsetu-shield: put a QuantumLedger sidecar in front of any app.
 *
 *   Server side (next to the app):  qsetu-shield --upstream http://localhost:4000 --listen 8443
 *   Client side (next to callers):  qsetu-shield --peer http://localhost:8443 --listen 8080 [--server-key <base64>]
 */
import { isProfileId } from "@qsetu/core";
import { parseArgs } from "node:util";
import { loadOrCreateIdentity } from "./identity-file";
import { startShieldClient } from "./client-node";
import { startShieldServer } from "./server-node";

const { values } = parseArgs({
  options: {
    upstream: { type: "string" },
    peer: { type: "string" },
    listen: { type: "string" },
    host: { type: "string", default: "127.0.0.1" },
    profile: { type: "string", default: "standard" },
    identity: { type: "string" },
    "server-key": { type: "string" },
    "rotate-every": { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

const usage = `Usage:
  qsetu-shield --upstream <url> --listen <port> [--identity file.json] [--profile standard|edge]
  qsetu-shield --peer <url> --listen <port> [--server-key <base64>]`;

async function fetchServerKey(peer: string): Promise<string> {
  // Demo convenience (trust on first use). In production, pass --server-key explicitly.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${peer.replace(/\/$/, "")}/qsetu/identity`);
      if (r.ok) return ((await r.json()) as { publicKey: string }).publicKey;
    } catch {
      /* peer not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Could not reach ${peer}/qsetu/identity`);
}

async function main() {
  if (values.help || !values.listen || (!values.upstream && !values.peer)) {
    console.log(usage);
    process.exit(values.help ? 0 : 1);
  }
  const listen = Number(values.listen);
  if (!isProfileId(values.profile!)) throw new Error(`Unknown profile ${values.profile}`);
  if (values.upstream) {
    await startShieldServer({
      upstream: values.upstream,
      listen,
      host: values.host,
      identity: loadOrCreateIdentity(values.identity, values.profile),
    });
  } else {
    const peer = values.peer!;
    const serverKey = values["server-key"] ?? (await fetchServerKey(peer));
    await startShieldClient({
      peer,
      listen,
      host: values.host,
      serverKey,
      rotateEvery: values["rotate-every"] ? Number(values["rotate-every"]) : undefined,
    });
  }
}

main().catch((e) => {
  console.error(`[qsetu-shield] ${(e as Error).message}`);
  process.exit(1);
});
