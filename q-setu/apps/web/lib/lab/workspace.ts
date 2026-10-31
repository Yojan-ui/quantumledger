/**
 * Lab workspaces on disk: QSETU_DATA_DIR/lab/<ws>/ holds staged uploads and finished run records.
 * Ids are random 16-hex strings checked by regex before any path is built, so no input reaches the
 * filesystem as a path segment (path-traversal safe). One active run per workspace is enforced in runs.ts.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCAN_SAMPLES } from "@qsetu/core";
import { hostFromInput } from "@/lib/live/tls";
import {
  countLines,
  decodeText,
  LIMITS,
  safeName,
  sha256,
  type InputSpec,
  type ResolvedInput,
} from "./inputs";

const ID = /^[a-f0-9]{16}$/;
export const newId = () => randomBytes(8).toString("hex");
export const isId = (s: string) => ID.test(s);

/** Read lazily so tests can point QSETU_DATA_DIR at a temp dir before first use. */
export const labRoot = () =>
  join(process.env.QSETU_DATA_DIR ?? join(process.cwd(), ".data"), "lab");
const wsDir = (ws: string) => {
  if (!isId(ws)) throw new Error("bad workspace id");
  return join(labRoot(), ws);
};

export interface WorkspaceMeta {
  id: string;
  createdAt: string;
}

export function createWorkspace(): WorkspaceMeta {
  const meta = { id: newId(), createdAt: new Date().toISOString() };
  const d = wsDir(meta.id);
  mkdirSync(join(d, "uploads"), { recursive: true });
  mkdirSync(join(d, "runs"), { recursive: true });
  writeFileSync(join(d, "workspace.json"), JSON.stringify(meta));
  return meta;
}

export function readWorkspace(ws: string): WorkspaceMeta | undefined {
  if (!isId(ws)) return undefined;
  const f = join(wsDir(ws), "workspace.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as WorkspaceMeta) : undefined;
}

export interface UploadMeta {
  id: string;
  name: string;
  bytes: number;
  lines: number;
  sha256: string;
  uploadedAt: string;
}

export function saveUpload(ws: string, name: string, text: string, bytes: number): UploadMeta {
  const meta: UploadMeta = {
    id: newId(),
    name: safeName(name, "upload.txt"),
    bytes,
    lines: countLines(text),
    sha256: sha256(text),
    uploadedAt: new Date().toISOString(),
  };
  const d = join(wsDir(ws), "uploads");
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, `${meta.id}.txt`), text, "utf8");
  writeFileSync(join(d, `${meta.id}.json`), JSON.stringify(meta));
  return meta;
}

function readUpload(ws: string, id: string): { meta: UploadMeta; text: string } | undefined {
  if (!isId(id)) return undefined;
  const d = join(wsDir(ws), "uploads");
  const m = join(d, `${id}.json`);
  if (!existsSync(m)) return undefined;
  return {
    meta: JSON.parse(readFileSync(m, "utf8")),
    text: readFileSync(join(d, `${id}.txt`), "utf8"),
  };
}

export function saveRun(ws: string, run: { runId: string }): void {
  const d = join(wsDir(ws), "runs");
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, `${run.runId}.json`), JSON.stringify(run));
}

export function readRun<T>(ws: string, runId: string): T | undefined {
  if (!isId(runId)) return undefined;
  const f = join(wsDir(ws), "runs", `${runId}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : undefined;
}

/** Finished runs of a workspace, newest first (summaries only). */
export function listRuns<T extends { finishedAt?: string | null }>(ws: string): T[] {
  if (!readWorkspace(ws)) return [];
  const d = join(wsDir(ws), "runs");
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(d, f), "utf8")) as T)
    .sort((a, b) => String(b.finishedAt ?? "").localeCompare(String(a.finishedAt ?? "")));
}

export type Resolved =
  { ok: true; inputs: ResolvedInput[] } | { ok: false; fields: Record<string, string> };

/** Turns run input specs into scannable inputs; every problem is reported against its field path. */
export function resolveInputs(ws: string | undefined, specs: InputSpec[]): Resolved {
  const fields: Record<string, string> = {};
  const out: ResolvedInput[] = [];
  let total = 0;
  specs.forEach((s, i) => {
    const at = `inputs.${i}`;
    if (s.kind === "paste") {
      const name = safeName(s.name, `pasted-${i + 1}.txt`);
      const check = decodeText(new TextEncoder().encode(s.text));
      if (!check.ok) {
        fields[`${at}.text`] = check.message;
        return;
      }
      const bytes = Buffer.byteLength(s.text);
      total += bytes;
      out.push({
        index: i,
        name,
        source: "paste",
        bytes,
        lines: countLines(s.text),
        sha256: sha256(s.text),
        text: s.text,
      });
    } else if (s.kind === "upload") {
      const up = ws ? readUpload(ws, s.id) : undefined;
      if (!up) {
        fields[`${at}.id`] = "Upload not found in this workspace";
        return;
      }
      total += up.meta.bytes;
      out.push({
        index: i,
        name: up.meta.name,
        source: "upload",
        bytes: up.meta.bytes,
        lines: up.meta.lines,
        sha256: up.meta.sha256,
        text: up.text,
      });
    } else if (s.kind === "sample") {
      const smp = SCAN_SAMPLES.find((x) => x.id === s.id);
      if (!smp) {
        fields[`${at}.id`] = "Unknown sample";
        return;
      }
      const bytes = Buffer.byteLength(smp.text);
      total += bytes;
      out.push({
        index: i,
        name: smp.filename,
        source: "sample",
        bytes,
        lines: countLines(smp.text),
        sha256: sha256(smp.text),
        text: smp.text,
        sampleLabel: smp.label,
      });
    } else {
      let host: string;
      try {
        host = hostFromInput(s.url);
      } catch (e) {
        fields[`${at}.url`] = (e as Error).message;
        return;
      }
      out.push({
        index: i,
        name: host,
        source: "url",
        bytes: 0,
        lines: 0,
        sha256: sha256(host),
        url: s.url,
        probeLive: s.probeLive,
      });
    }
  });
  if (total > LIMITS.totalBytes)
    fields.inputs = `Inputs total ${total} bytes (max ${LIMITS.totalBytes / 1024 / 1024} MB)`;
  if (specs.filter((s) => s.kind === "url").length > 1)
    fields.inputs = "At most one host or URL per run";
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, inputs: out };
}
