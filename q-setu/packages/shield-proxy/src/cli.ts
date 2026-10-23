/**
 * qsetu-shield: put a QuantumLedger sidecar in front of any app.
 *
 *   Server side (next to the app):  qsetu-shield --upstream http://localhost:4000 --listen 8443 [--v2]
 *   Client side (next to callers):  qsetu-shield --peer http://localhost:8443 --listen 8080 --server-key <base64> [--v2]
 *
 * --v2 runs the binary tunnel (one HTTP/2 connection, streamed AES-256-GCM frames, resumption): use
 * it for real traffic. Without it, the v1 JSON tunnel the website's Shield demo visualises.
 *
 * The client must pin the server's ML-DSA key (--server-key or SHIELD_PEER_KEY). Only with
 * --demo-identity on both sides does the server publish it and the client fetch it on first use,
 * which an attacker in the middle can defeat: local demos only.
 */
import { isProfileId } from "@qsetu/core";
import { parseArgs } from "node:util";
import { loadOrCreateIdentity } from "./identity-file";
import { startShieldClient } from "./client-node";
import { startShieldServer } from "./server-node";
import { startTunnelClient } from "./v2/client";
import { startTunnelServer } from "./v2/server";

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
    "demo-identity": { type: "boolean", default: false },
    v2: { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

const usage = `Usage:
  qsetu-shield --upstream <url> --listen <port> [--identity file.json] [--profile standard|edge] [--v2] [--demo-identity]
  qsetu-shield --peer <url> --listen <port> --server-key <base64> [--v2]      (or SHIELD_PEER_KEY)
  qsetu-shield --peer <url> --listen <port> --demo-identity [--v2]            (local demos only)`;

async function fetchServerKey(peer: string): Promise<string> {
  console.warn(
    "[qsetu-shield] WARNING: --demo-identity fetches the server's key over the network and trusts the first answer. Pin --server-key / SHIELD_PEER_KEY for anything real.",
  );
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
  const demoIdentity = values["demo-identity"] === true;
  if (values.upstream) {
    const opts = {
      upstream: values.upstream,
      listen,
      host: values.host,
      identity: loadOrCreateIdentity(values.identity, values.profile),
      demoIdentity,
    };
    if (values.v2) await startTunnelServer(opts);
    else await startShieldServer(opts);
  } else {
    const peer = values.peer!;
    const pinned = values["server-key"] ?? process.env.SHIELD_PEER_KEY;
    if (!pinned && !demoIdentity)
      throw new Error(
        "Pin the server's key: --server-key <base64> or SHIELD_PEER_KEY (or --demo-identity for a local demo)",
      );
    const serverKey = pinned ?? (await fetchServerKey(peer));
    if (values.v2) await startTunnelClient({ peer, listen, host: values.host, serverKey });
    else
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
