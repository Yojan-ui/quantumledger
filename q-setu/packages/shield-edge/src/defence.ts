/**
 * Connects the defence engine (@qsetu/shield-guard) to Shield Edge: the edge's view of each request,
 * including what only an edge can see (the TLS ClientHello's JA4, version and ALPN offer), goes to the
 * engine; its decision comes back as a response or a pass.
 */
import { Guard, POW_PATH, type GuardConfig, type RequestInfo } from "@qsetu/shield-guard";
import type { EdgeOptions, GuardInput } from "./edge";

const toInfo = (g: GuardInput): RequestInfo => ({
  ip: g.ip,
  method: g.method,
  path: g.path,
  headers: g.headers,
  ...(g.conn.hello
    ? {
        tls: {
          ...(g.conn.ja4 ? { ja4: g.conn.ja4 } : {}),
          version: g.conn.hello.version,
          alpn: g.conn.hello.alpn,
        },
      }
    : {}),
});

export function edgeDefence(
  cfg: GuardConfig,
): { engine: Guard } & Pick<EdgeOptions, "guard" | "intercept" | "onResponse"> {
  const engine = new Guard(cfg);
  return {
    engine,
    guard: async (g) => {
      const d = await engine.check(toInfo(g));
      if (!d.response) return { action: "allow" };
      return {
        action: "respond",
        status: d.response.status,
        headers: d.response.headers,
        body: d.response.body,
        ...(d.response.delayMs ? { delayMs: d.response.delayMs } : {}),
      };
    },
    intercept: {
      path: POW_PATH,
      maxBytes: 2048,
      handle: (body, g) => engine.solve(toInfo(g), body),
    },
    onResponse: (g, status) => engine.finish(toInfo(g), status),
  };
}
