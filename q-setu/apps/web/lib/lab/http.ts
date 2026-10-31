/**
 * Lab API plumbing: the `{error:{code,message,fields}}` envelope used by every /api/lab route, and
 * Zod issues turned into `fields` ({"<path>": "<message>"}). Existing routes keep their `issues` format.
 */
import { z } from "zod";

export type LabErrorCode =
  | "invalid_input"
  | "too_large"
  | "unsupported_media_type"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "unprocessable"
  | "internal";

export function labFail(
  code: LabErrorCode,
  message: string,
  status: number,
  fields?: Record<string, string>,
) {
  return Response.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

export function zodFields(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = i.path.join(".") || "_";
    if (!(k in out)) out[k] = i.message;
  }
  return out;
}

type Parsed<T> = { ok: true; data: T } | { ok: false; res: Response };

export async function labBody<S extends z.ZodType>(
  req: Request,
  schema: S,
  maxBytes = 2_200_000,
): Promise<Parsed<z.infer<S>>> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes)
    return { ok: false, res: labFail("too_large", `Request body over ${maxBytes} bytes`, 413) };
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: labFail("invalid_input", "Body must be JSON", 400) };
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const fields = zodFields(r.error);
    return {
      ok: false,
      res: labFail("invalid_input", Object.values(fields)[0] ?? "Invalid input", 400, fields),
    };
  }
  return { ok: true, data: r.data };
}

export const noStore = { "cache-control": "no-store" };
