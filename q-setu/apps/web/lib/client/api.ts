/** Reads the API's error shape `{ error: { code, message } }` (or a bare string from older callers). */
export function errText(data: unknown, fallback = "Request failed"): string {
  const e = (data as { error?: unknown } | null)?.error;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: unknown }).message);
  return fallback;
}
