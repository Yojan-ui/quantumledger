import "server-only";
import { z } from "zod";

/**
 * Every API route validates its input with zod and fails the same way:
 *   { "error": { "code": "invalid_input" | "not_found" | ..., "message": "...", "issues"?: [...] } }
 */
export type ErrorCode =
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "unprocessable"
  | "internal"
  | "forbidden"
  | "blocked_target"
  | "unresolvable"
  | "unreachable"
  | "timeout"
  | "too_large";

export function fail(code: ErrorCode, message: string, status: number, extra: object = {}) {
  return Response.json({ error: { code, message, ...extra } }, { status });
}

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    }),
  })
  .meta({ id: "Error" });

type Parsed<T> = { ok: true; data: T } | { ok: false; res: Response };

function invalid(e: z.ZodError): Response {
  return fail("invalid_input", e.issues[0]?.message ?? "Invalid input", 400, {
    issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

/** The largest request body any route reads (the URL scanner's text mode allows 256 KB). */
export const MAX_BODY_BYTES = 300 * 1024;

/**
 * Reads the body as text, stopping at `max` bytes (a chunked upload has no Content-Length for the
 * middleware to check, so the cap is enforced while reading). Returns undefined if it's too large.
 */
export async function readText(req: Request, max = MAX_BODY_BYTES): Promise<string | undefined> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) {
      await reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Parses a JSON body (an empty body counts as `{}`). */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<Parsed<z.infer<S>>> {
  const text = await readText(req);
  if (text === undefined)
    return { ok: false, res: fail("too_large", "That request is too large.", 413) };
  let json: unknown = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, res: fail("invalid_input", "Body must be JSON", 400) };
    }
  }
  // Strict: a body with a field the schema doesn't know is refused, not silently trimmed.
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape;
  if (shape && json && typeof json === "object" && !Array.isArray(json)) {
    const unknown = Object.keys(json).filter((k) => !(k in shape));
    if (unknown.length)
      return {
        ok: false,
        res: fail("invalid_input", `Unknown field: ${unknown[0]!.slice(0, 40)}`, 400),
      };
  }
  const r = schema.safeParse(json);
  return r.success ? { ok: true, data: r.data } : { ok: false, res: invalid(r.error) };
}

/**
 * The message a client may see for an error. The app's own domain errors carry fixed, written
 * messages (a rejected envelope, a full room, a blocked scan target) and pass through; anything
 * else (database, filesystem, network, library errors) becomes a generic sentence, and its detail
 * goes to the server log only.
 */
const DOMAIN_ERRORS = new Set([
  "EnvelopeError",
  "RoomError",
  "ScanError",
  "SessionError",
  "VaultError",
]);
export function safeMessage(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (e instanceof Error && DOMAIN_ERRORS.has(e.name)) return e.message.slice(0, 200);
  console.error(JSON.stringify({ t: new Date().toISOString(), error: String(e).slice(0, 500) }));
  return fallback;
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): Parsed<z.infer<S>> {
  const r = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  return r.success ? { ok: true, data: r.data } : { ok: false, res: invalid(r.error) };
}

export function parseParams<S extends z.ZodType>(params: unknown, schema: S): Parsed<z.infer<S>> {
  const r = schema.safeParse(params);
  return r.success ? { ok: true, data: r.data } : { ok: false, res: invalid(r.error) };
}

// ── shared schemas ──────────────────────────────────────────────────────────────────────────

export const Sector = z
  .enum(["fintech", "healthcare", "education"])
  .meta({ description: "Demo sector", examples: ["fintech"] });

export const SectorBody = z.object({ sector: Sector.default("fintech") });
