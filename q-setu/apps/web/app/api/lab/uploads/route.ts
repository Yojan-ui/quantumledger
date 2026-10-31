import { labFail, noStore } from "@/lib/lab/http";
import { decodeText, LIMITS } from "@/lib/lab/inputs";
import { readWorkspace, saveUpload } from "@/lib/lab/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lab/uploads?ws={ws} (multipart/form-data, field "files"): stages text files in the workspace.
 * Per file ≤ 256 KB, UTF-8 text only; ≤ 20 files and ≤ 2 MB per request. Names are reduced to a safe basename.
 */
export async function POST(req: Request) {
  const ws = new URL(req.url).searchParams.get("ws") ?? "";
  if (!readWorkspace(ws))
    return labFail("not_found", "No such workspace", 404, { ws: "Unknown workspace" });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > LIMITS.totalBytes + 64 * 1024)
    return labFail("too_large", `Upload over ${LIMITS.totalBytes / 1024 / 1024} MB`, 413, {
      files: `Total upload over ${LIMITS.totalBytes / 1024 / 1024} MB`,
    });
  if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data"))
    return labFail("unsupported_media_type", "Send files as multipart/form-data", 415);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return labFail("invalid_input", "Malformed multipart body", 400);
  }
  const files = form
    .getAll("files")
    .filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length)
    return labFail("invalid_input", "No files in the upload", 400, {
      files: "Choose at least one file",
    });
  if (files.length > LIMITS.files)
    return labFail("invalid_input", `At most ${LIMITS.files} files`, 400, {
      files: `At most ${LIMITS.files} files per upload`,
    });
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > LIMITS.totalBytes)
    return labFail("too_large", `Upload over ${LIMITS.totalBytes / 1024 / 1024} MB`, 413, {
      files: `Total ${total} bytes (max ${LIMITS.totalBytes})`,
    });
  const fields: Record<string, string> = {};
  const decoded: { name: string; text: string; bytes: number }[] = [];
  for (const [i, f] of files.entries()) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const t = decodeText(bytes);
    if (!t.ok) fields[`files.${i}`] = `${f.name}: ${t.message}`;
    else decoded.push({ name: f.name, text: t.text, bytes: bytes.byteLength });
  }
  if (Object.keys(fields).length)
    return labFail("invalid_input", Object.values(fields)[0]!, 400, fields);
  return Response.json(
    { uploads: decoded.map((d) => saveUpload(ws, d.name, d.text, d.bytes)) },
    { status: 201, headers: noStore },
  );
}
