import "server-only";
import { z } from "zod";

/**
 * Every API route validates its input with zod and fails the same way:
 *   { "error": { "code": "invalid_input" | "not_found" | ..., "message": "...", "issues"?: [...] } }
 */
export type ErrorCode =
  "invalid_input" | "not_found" | "conflict" | "rate_limited" | "unprocessable" | "internal";

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

/** Parses a JSON body (an empty body counts as `{}`). */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<Parsed<z.infer<S>>> {
  const text = await req.text();
  let json: unknown = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, res: fail("invalid_input", "Body must be JSON", 400) };
    }
  }
  const r = schema.safeParse(json);
  return r.success ? { ok: true, data: r.data } : { ok: false, res: invalid(r.error) };
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
