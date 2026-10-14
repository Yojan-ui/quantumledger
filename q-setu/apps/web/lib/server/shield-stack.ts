import "server-only";
import { bytesToBase64, createIdentity } from "@qsetu/core";
import { createLegacyApp } from "@qsetu/legacy-bank";
import { startShieldClient, startShieldServer } from "@qsetu/shield-proxy";

export const PORTS = { legacy: 4000, shieldServer: 8443, shieldClient: 8080 } as const;
export const SHIELD_CLIENT = `http://127.0.0.1:${PORTS.shieldClient}`;
export const SHIELD_SERVER = `http://127.0.0.1:${PORTS.shieldServer}`;
export const LEGACY = `http://127.0.0.1:${PORTS.legacy}`;

const g = globalThis as unknown as { __qsetuStack?: Promise<"external" | "in-process"> };

async function up(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(800) })).ok;
  } catch {
    return false;
  }
}

/**
 * `pnpm dev` starts the legacy app and both Shield nodes as separate processes, so their logs are
 * visible. If they aren't running (e.g. `pnpm start`), start them in-process on the same ports.
 */
export function ensureShieldStack(): Promise<"external" | "in-process"> {
  g.__qsetuStack ??= (async () => {
    if (await up(`${SHIELD_CLIENT}/healthz`)) return "external" as const;
    if (!(await up(`${LEGACY}/api/health`))) {
      await new Promise<void>((r) =>
        createLegacyApp().listen(PORTS.legacy, "127.0.0.1", () => r()),
      );
    }
    const identity = createIdentity("standard");
    if (!(await up(`${SHIELD_SERVER}/healthz`))) {
      // The website's own demo: it reads the key in-process, but the "external" case below (pnpm
      // dev's separate processes) fetches it, so demo mode is on for this local, loopback-only stack.
      await startShieldServer({
        upstream: LEGACY,
        listen: PORTS.shieldServer,
        identity,
        demoIdentity: true,
      });
      await startShieldClient({
        peer: SHIELD_SERVER,
        listen: PORTS.shieldClient,
        serverKey: bytesToBase64(identity.publicKey),
      });
    } else {
      const { publicKey } = (await (await fetch(`${SHIELD_SERVER}/qsetu/identity`)).json()) as {
        publicKey: string;
      };
      await startShieldClient({
        peer: SHIELD_SERVER,
        listen: PORTS.shieldClient,
        serverKey: publicKey,
      });
    }
    return "in-process" as const;
  })().catch((e) => {
    g.__qsetuStack = undefined;
    throw e;
  });
  return g.__qsetuStack;
}
