/**
 * @qsetu/shield: AI-agent and abuse defence as one line in your app.
 *
 *   Express   app.use(shield({ siteKey: process.env.QSETU_SITE_KEY }))
 *   Fastify   app.register(shieldFastify({ siteKey: process.env.QSETU_SITE_KEY }))
 *   Next.js   middleware.ts: see shieldNext()
 *
 * The post-quantum TLS layer is not part of this: a middleware runs after TLS has ended. For that,
 * put Shield Edge in front (one DNS change, or the container).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestInfo } from "@qsetu/shield-guard";
import { createShield, type Shield, type ShieldOptions } from "./core";

export { createShield, DEFAULT_REPORT_URL, type Shield, type ShieldOptions } from "./core";

type Next = (err?: unknown) => void;
const MAX_CHALLENGE_BODY = 2048;

function readSmall(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let s = "";
    req.on("data", (c: Buffer) => {
      s += c.toString();
      if (s.length > MAX_CHALLENGE_BODY) req.destroy();
    });
    req.on("end", () => resolve(s));
    req.on("error", () => resolve(""));
  });
}

function send(
  res: ServerResponse,
  r: { status: number; headers: Record<string, string>; body: string },
) {
  res.writeHead(r.status, r.headers);
  res.end(r.body);
}

/** Express / Connect (and anything with (req, res, next)). */
export function shield(opts: ShieldOptions) {
  const s = createShield(opts);
  const mw = async (req: IncomingMessage, res: ServerResponse, next: Next) => {
    try {
      const https =
        (req.socket as { encrypted?: boolean }).encrypted === true ||
        req.headers["x-forwarded-proto"] === "https";
      for (const [k, v] of Object.entries(s.safeHeaders(https))) res.setHeader(k, v);
      res.removeHeader("x-powered-by");
      const info: RequestInfo = {
        ip: s.clientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"]),
        method: req.method ?? "GET",
        path: req.url ?? "/",
        headers: req.headers,
      };
      if (s.isChallengePost(info.method, info.path))
        return send(res, s.solve(info, await readSmall(req)));
      const d = await s.check(info);
      if (d.response) {
        if (d.response.delayMs) await new Promise((r) => setTimeout(r, d.response!.delayMs));
        s.finish(info, d.response.status);
        return send(res, d.response);
      }
      res.on("finish", () => s.finish(info, res.statusCode));
      next();
    } catch (e) {
      // The engine failing must never take the site down.
      next();
      void e;
    }
  };
  return Object.assign(mw, { shield: s });
}

/** Fastify plugin (registered without encapsulation, so it covers every route). */
export function shieldFastify(opts: ShieldOptions) {
  const s = createShield(opts);
  interface FReq {
    raw: IncomingMessage;
    ip: string;
    method: string;
    url: string;
    headers: IncomingMessage["headers"];
    body?: unknown;
    qsetu?: RequestInfo;
  }
  interface FReply {
    code(n: number): FReply;
    headers(h: Record<string, string>): FReply;
    header(k: string, v: string): FReply;
    removeHeader(k: string): FReply;
    send(b?: string): FReply;
    statusCode: number;
  }
  interface FInstance {
    addHook(name: "onRequest", fn: (req: FReq, reply: FReply) => Promise<unknown>): void;
    addHook(name: "onResponse", fn: (req: FReq, reply: FReply) => Promise<unknown>): void;
    addHook(
      name: "onSend",
      fn: (req: FReq, reply: FReply, payload: unknown) => Promise<unknown>,
    ): void;
  }
  const plugin = async (app: FInstance) => {
    app.addHook("onRequest", async (req, reply) => {
      const https =
        (req.raw.socket as { encrypted?: boolean }).encrypted === true ||
        req.headers["x-forwarded-proto"] === "https";
      reply.headers(s.safeHeaders(https));
      const info: RequestInfo = {
        ip: s.clientIp(req.raw.socket.remoteAddress, req.headers["x-forwarded-for"]),
        method: req.method,
        path: req.url,
        headers: req.headers,
      };
      req.qsetu = info;
      if (s.isChallengePost(info.method, info.path)) {
        const r = s.solve(info, await readSmall(req.raw));
        return reply.code(r.status).headers(r.headers).send(r.body);
      }
      try {
        const d = await s.check(info);
        if (d.response) {
          if (d.response.delayMs) await new Promise((r) => setTimeout(r, d.response!.delayMs));
          return reply.code(d.response.status).headers(d.response.headers).send(d.response.body);
        }
      } catch {
        // never block on an engine failure
      }
      return undefined;
    });
    app.addHook("onSend", async (_req, reply, payload) => {
      reply.removeHeader("x-powered-by");
      return payload;
    });
    app.addHook("onResponse", async (req, reply) => {
      if (req.qsetu) s.finish(req.qsetu, reply.statusCode);
    });
  };
  // What the fastify-plugin package does: apply to the parent scope, not a child context.
  return Object.assign(plugin, { [Symbol.for("skip-override")]: true, shield: s });
}

/**
 * Next.js middleware (Node runtime: `export const config = { runtime: "nodejs" }`).
 *
 *   const guard = shieldNext({ siteKey: process.env.QSETU_SITE_KEY! });
 *   export async function middleware(req: NextRequest) {
 *     return (await guard(req)) ?? NextResponse.next();
 *   }
 *
 * Returns a Response when the request should be answered by Shield, else undefined. Next's
 * middleware can't see the final status code, so the error-ratio signal is off here.
 */
export function shieldNext(opts: ShieldOptions) {
  const s: Shield = createShield({ trustProxyHops: 1, ...opts });
  return async (req: Request & { ip?: string }): Promise<Response | undefined> => {
    try {
      const url = new URL(req.url);
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => (headers[k] = v));
      const info: RequestInfo = {
        ip: s.clientIp(req.ip, headers["x-forwarded-for"]),
        method: req.method,
        path: url.pathname + url.search,
        headers,
      };
      if (s.isChallengePost(info.method, info.path)) {
        const r = s.solve(info, (await req.text()).slice(0, MAX_CHALLENGE_BODY));
        return new Response(r.body || null, { status: r.status, headers: r.headers });
      }
      const d = await s.check(info);
      s.finish(info, d.response?.status ?? 200);
      if (!d.response) return undefined;
      if (d.response.delayMs) await new Promise((r) => setTimeout(r, d.response!.delayMs));
      return new Response(d.response.body, {
        status: d.response.status,
        headers: d.response.headers,
      });
    } catch {
      return undefined;
    }
  };
}
