/**
 * The local sandbox: two copies of apps/legacy-bank on loopback. One is bare; the other has Shield
 * installed the documented one-line way (`app.use(shield(...))`), in protect mode. Both listen on
 * 127.0.0.1 only.
 *
 * The protected copy trusts one proxy hop of X-Forwarded-For, so the lab's own traffic can stand in
 * for different sources (addresses from the documentation ranges, RFC 5737). That is right for a
 * sandbox and wrong for a real site, which should count only its real proxies.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createLegacyApp } from "@qsetu/legacy-bank";
import { shield, type ShieldOptions } from "@qsetu/shield";
import type { GuardEvent, Mode } from "@qsetu/shield-guard";
import { recordedShield, type RecorderOptions } from "./detect";

export const TRAP_PATH = "/offers/members-only-rates";

export interface Sandbox {
  bare: string;
  protected: string;
  canaryKey: string;
  trapPath: string;
  /** Shield's events for a request sent with `x-attack-lab-step: <n>` (replay sandboxes only). */
  eventsFor(step: string): GuardEvent[];
  close(): Promise<void>;
}

export interface SandboxOptions {
  barePort?: number;
  protectedPort?: number;
  mode?: Mode;
  /** Record what Shield flags on the protected copy (the live sandbox). Omit for replay sandboxes. */
  record?: Omit<RecorderOptions, "canaryKeys">;
  /** Fixed canary key (default: random per sandbox). */
  canaryKey?: string;
}

function listen(app: ReturnType<typeof createLegacyApp>, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, "127.0.0.1", (err?: Error) => (err ? reject(err) : resolve(srv)));
    srv.on("error", reject);
  });
}

const urlOf = (s: Server) => {
  const a = s.address();
  return `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
};

const closeServer = (s: Server) =>
  new Promise<void>((r) => {
    s.closeAllConnections?.();
    s.close(() => r());
  });

export async function startSandbox(o: SandboxOptions = {}): Promise<Sandbox> {
  const canaryKey = o.canaryKey ?? `sk_live_${randomBytes(12).toString("hex")}`;
  const quiet = () => {};
  const shieldOpts: ShieldOptions = {
    siteKey: randomBytes(32).toString("hex"),
    mode: o.mode ?? "protect",
    reportTo: false,
    trustProxyHops: 1,
    canaryKeys: [canaryKey],
    trapPath: TRAP_PATH,
  };

  // Replay sandboxes tap Shield's events per step instead of recording them as evidence.
  const tap = new AsyncLocalStorage<GuardEvent[]>();
  const seen = new Map<string, GuardEvent[]>();
  let use: unknown[];
  let shields: { close(): void }[];
  if (o.record) {
    const r = recordedShield(shieldOpts, { ...o.record, canaryKeys: [canaryKey] });
    use = r.use;
    shields = [r.shield];
  } else {
    const mw = shield({ ...shieldOpts, onEvent: (e) => tap.getStore()?.push(e) });
    const before = (req: IncomingMessage, _res: ServerResponse, next: () => void) => {
      const step = req.headers["x-attack-lab-step"];
      const list: GuardEvent[] = [];
      if (typeof step === "string") seen.set(step, list);
      tap.run(list, next);
    };
    use = [before, mw];
    shields = [mw.shield];
  }

  const bare = await listen(createLegacyApp(quiet), o.barePort ?? 0);
  const prot = await listen(
    createLegacyApp(quiet, { use: use as never }),
    o.protectedPort ?? 0,
  ).catch(async (e) => {
    await closeServer(bare);
    throw e;
  });
  return {
    bare: urlOf(bare),
    protected: urlOf(prot),
    canaryKey,
    trapPath: TRAP_PATH,
    eventsFor: (step) => seen.get(step) ?? [],
    async close() {
      for (const s of shields) s.close();
      await Promise.all([closeServer(bare), closeServer(prot)]);
    },
  };
}
