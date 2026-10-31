/**
 * Lab inputs: limits, validation and normalisation shared by /validate, /uploads and /runs.
 * The text limit matches the existing scanner route (ScanBody: 256 KB). Everything here is pure.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

export const LIMITS = {
  fileBytes: 256 * 1024,
  files: 20,
  totalBytes: 2 * 1024 * 1024,
  nameChars: 120,
  urlChars: 2048,
  lifetimeYears: { min: 0, max: 100, default: 10 },
} as const;

export const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

/** A display-safe file name: basename only, printable characters, no path separators or dot-dot. */
export function safeName(raw: string | undefined, fallback: string): string {
  const base = (raw ?? "").split(/[\\/]/).pop() ?? "";
  const clean = base
    .replace(/[^\w.\- ()+@]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, LIMITS.nameChars)
    .trim();
  return clean || fallback;
}

export type TextCheck = { ok: true; text: string } | { ok: false; message: string };

/** Accepts UTF-8 text only: rejects NUL bytes (binary) and invalid UTF-8; enforces the per-file size. */
export function decodeText(bytes: Uint8Array): TextCheck {
  if (bytes.byteLength > LIMITS.fileBytes)
    return { ok: false, message: `File too large (max ${LIMITS.fileBytes / 1024} KB)` };
  if (bytes.includes(0))
    return { ok: false, message: "Binary file: only text (source, config, PEM) can be scanned" };
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, message: "Not valid UTF-8 text" };
  }
}

export const countLines = (text: string) => (text.length ? text.split(/\r?\n/).length : 0);

const Paste = z.object({
  kind: z.literal("paste"),
  name: z.string().max(LIMITS.nameChars).optional(),
  text: z
    .string()
    .min(1, "Paste some text to scan")
    .max(LIMITS.fileBytes, `Input too large (max ${LIMITS.fileBytes / 1024} KB)`),
});
const Upload = z.object({
  kind: z.literal("upload"),
  id: z.string().regex(/^[a-f0-9]{16}$/, "Unknown upload"),
});
const Sample = z.object({ kind: z.literal("sample"), id: z.string().min(1).max(64) });
const Url = z.object({
  kind: z.literal("url"),
  url: z.string().min(1, "Enter a host or URL").max(LIMITS.urlChars),
  /** Explicit opt-in: contacts the user's host for a real TLS probe. Default: cached real scans only. */
  probeLive: z.boolean().default(false),
});
export const InputSpec = z.discriminatedUnion("kind", [Paste, Upload, Sample, Url]);
export type InputSpec = z.infer<typeof InputSpec>;

export const RunBody = z.object({
  workspace: z.string().regex(/^[a-f0-9]{16}$/, "Unknown workspace"),
  inputs: z
    .array(InputSpec)
    .min(1, "Add at least one input")
    .max(LIMITS.files, `At most ${LIMITS.files} inputs per run`),
  dataLifetimeYears: z
    .number()
    .min(LIMITS.lifetimeYears.min)
    .max(LIMITS.lifetimeYears.max)
    .default(LIMITS.lifetimeYears.default),
  hybridPq: z.boolean().optional(),
});
export type RunBody = z.infer<typeof RunBody>;

export const ValidateBody = RunBody.omit({ workspace: true }).extend({
  workspace: RunBody.shape.workspace.optional(),
});

/** A normalised input ready to scan. URL inputs carry no text. */
export interface ResolvedInput {
  index: number;
  name: string;
  source: "paste" | "upload" | "sample" | "url";
  bytes: number;
  lines: number;
  sha256: string;
  text?: string;
  url?: string;
  probeLive?: boolean;
  sampleLabel?: string;
}
