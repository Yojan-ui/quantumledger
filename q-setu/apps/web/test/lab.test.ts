/**
 * /api/lab: validation, uploads, runs over SSE, 409, cancel, signing, export. Runs against a temp
 * QSETU_DATA_DIR in offline mode (no outbound network). Expected numbers come from calling the real
 * scanner on the same inputs, never from constants.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCAN_SAMPLES, SEVERITY_WEIGHT, scan } from "@qsetu/core";
import { beforeAll, describe, expect, it, vi } from "vitest";

// `server-only` is Next's build-time guard against importing server code into client bundles; it throws
// outside a React Server Component build. Test-only shim (production code is unchanged).
vi.mock("server-only", () => ({}));

process.env.QSETU_DATA_DIR = mkdtempSync(join(tmpdir(), "qsetu-lab-"));
process.env.NEXT_PUBLIC_OFFLINE = "1";

type Handler = (...a: never[]) => Promise<Response> | Response;
type Mod = { GET: Handler; POST: Handler };
type Routes =
  | "health"
  | "workspaces"
  | "workspace"
  | "samples"
  | "validate"
  | "uploads"
  | "runs"
  | "run"
  | "events"
  | "result"
  | "exportRoute"
  | "cancel"
  | "scene";
let api: Record<Routes, Mod>;
const P = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown) =>
  new Request("http://lab.test/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  api = {
    health: await import("@/app/api/lab/health/route"),
    workspaces: await import("@/app/api/lab/workspaces/route"),
    workspace: await import("@/app/api/lab/workspaces/[ws]/route"),
    samples: await import("@/app/api/lab/samples/route"),
    validate: await import("@/app/api/lab/validate/route"),
    uploads: await import("@/app/api/lab/uploads/route"),
    runs: await import("@/app/api/lab/runs/route"),
    run: await import("@/app/api/lab/runs/[id]/route"),
    events: await import("@/app/api/lab/runs/[id]/events/route"),
    result: await import("@/app/api/lab/runs/[id]/result/route"),
    exportRoute: await import("@/app/api/lab/runs/[id]/export/route"),
    cancel: await import("@/app/api/lab/runs/[id]/cancel/route"),
    scene: await import("@/app/api/lab/runs/[id]/scene/route"),
  } as unknown as Record<Routes, Mod>;
});

async function newWorkspace(): Promise<string> {
  const r = await (api.workspaces.POST as () => Response)();
  expect(r.status).toBe(201);
  return (await r.json()).id;
}

/** Reads the SSE stream to its terminal event; returns [{type, data}]. */
async function readEvents(runId: string) {
  const res = await (api.events.GET as (r: Request, c: unknown) => Promise<Response>)(
    new Request("http://lab.test/e"),
    P(runId),
  );
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((b) => b.includes("event:"))
    .map((b) => ({
      type: /event: (\S+)/.exec(b)![1],
      data: JSON.parse(/data: (.*)/.exec(b)![1]!),
    }));
}

async function startRun(body: unknown) {
  return (api.runs.POST as (r: Request) => Promise<Response>)(json(body));
}

describe("lab inputs", () => {
  it("reduces names to a safe basename and rejects binary, bad UTF-8 and oversized text", async () => {
    const { safeName, decodeText, LIMITS } = await import("@/lib/lab/inputs");
    expect(safeName("../../etc/passwd", "x")).toBe("passwd");
    expect(safeName("..\\..\\win.ini", "x")).toBe("win.ini");
    expect(safeName("", "fallback.txt")).toBe("fallback.txt");
    expect(decodeText(new Uint8Array([104, 0, 105])).ok).toBe(false);
    expect(decodeText(new Uint8Array([0xc3, 0x28])).ok).toBe(false);
    expect(decodeText(new Uint8Array(LIMITS.fileBytes + 1).fill(97)).ok).toBe(false);
    expect(decodeText(new TextEncoder().encode("RSA-2048")).ok).toBe(true);
  });
});

describe("lab API", () => {
  it("health reports limits and offline mode", async () => {
    const b = await (api.health.GET as () => Response)().json();
    expect(b).toMatchObject({ ok: true, offline: true, limits: { fileBytes: 262144, files: 20 } });
  });

  it("samples are the scanner's own SCAN_SAMPLES, labelled Sample data", async () => {
    const b = await (api.samples.GET as () => Response)().json();
    expect(b.label).toBe("Sample data");
    expect(b.samples.map((s: { id: string }) => s.id)).toEqual(SCAN_SAMPLES.map((s) => s.id));
  });

  it("validate returns the fields envelope on bad input and a preview on good input", async () => {
    const bad = await (api.validate.POST as (r: Request) => Promise<Response>)(
      json({ inputs: [{ kind: "paste", text: "" }], dataLifetimeYears: 500 }),
    );
    expect(bad.status).toBe(400);
    const e = (await bad.json()).error;
    expect(e.code).toBe("invalid_input");
    expect(Object.keys(e.fields)).toEqual(
      expect.arrayContaining(["inputs.0.text", "dataLifetimeYears"]),
    );
    const ok = await (api.validate.POST as (r: Request) => Promise<Response>)(
      json({ inputs: [{ kind: "sample", id: SCAN_SAMPLES[0]!.id }] }),
    );
    const p = (await ok.json()).preview[0];
    expect(p).toMatchObject({ source: "sample", name: SCAN_SAMPLES[0]!.filename });
    expect(p.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("unknown workspace and unknown run give 404 with the envelope", async () => {
    const w = await (api.workspace.GET as (r: Request, c: unknown) => Promise<Response>)(
      new Request("http://lab.test"),
      { params: Promise.resolve({ ws: "0000000000000000" }) },
    );
    expect(w.status).toBe(404);
    expect((await w.json()).error.fields.ws).toBeTruthy();
    const r = await (api.run.GET as (r: Request, c: unknown) => Promise<Response>)(
      new Request("http://lab.test"),
      P("ffffffffffffffff"),
    );
    expect(r.status).toBe(404);
  });

  it("uploads stage text files, sanitise names, and reject binary files", async () => {
    const ws = await newWorkspace();
    const form = new FormData();
    form.append(
      "files",
      new File(['KeyPairGenerator.getInstance("RSA")\n'], "../../evil/Signer.java"),
    );
    const up = await (api.uploads.POST as (r: Request) => Promise<Response>)(
      new Request(`http://lab.test/u?ws=${ws}`, { method: "POST", body: form }),
    );
    expect(up.status).toBe(201);
    const u = (await up.json()).uploads[0];
    expect(u.name).toBe("Signer.java");
    const bin = new FormData();
    bin.append("files", new File([new Uint8Array([1, 0, 2])], "blob.bin"));
    const bad = await (api.uploads.POST as (r: Request) => Promise<Response>)(
      new Request(`http://lab.test/u?ws=${ws}`, { method: "POST", body: bin }),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.fields["files.0"]).toContain("Binary");
  });

  it("a real run: SSE stages, results equal to the scanner, a signed lab-run entry, verify OK, exports", async () => {
    const ws = await newWorkspace();
    const inputs = SCAN_SAMPLES.map((s) => ({ kind: "sample", id: s.id }));
    const res = await startRun({ workspace: ws, inputs, dataLifetimeYears: 10 });
    expect(res.status).toBe(202);
    const { runId } = await res.json();
    const second = await startRun({ workspace: ws, inputs, dataLifetimeYears: 10 });
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("conflict");

    const events = await readEvents(runId);
    const types = events.map((e) => e.type);
    expect(types.at(-1)).toBe("result");
    expect(types.filter((t) => t === "file")).toHaveLength(SCAN_SAMPLES.length);
    const progress = events.filter((e) => e.type === "progress").map((e) => e.data.done);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));

    const result = await (
      await (api.result.GET as (r: Request, c: unknown) => Promise<Response>)(
        new Request("http://lab.test"),
        P(runId),
      )
    ).json();
    expect(result.status).toBe("done");
    for (const s of SCAN_SAMPLES) {
      const direct = scan(s.text, s.filename);
      const f = result.files.find((x: { name: string }) => x.name === s.filename);
      expect({ score: f.score, grade: f.grade, findings: f.findings.length }).toEqual({
        score: direct.score,
        grade: direct.grade,
        findings: direct.findings.length,
      });
    }
    expect(result.inputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.plan.steps.length).toBeGreaterThan(0);
    expect(result.ledger).toMatchObject({ kind: "lab-run" });
    expect(result.ledger.note).toContain("not handshake evidence");
    expect(result.ledger.verify.ok).toBe(true);

    const { live } = await import("@/lib/server/runtime");
    const entry = await (await live()).ledger.get(result.ledger.entryId);
    expect(entry).toMatchObject({ kind: "lab-run", hash: result.ledger.hash });
    expect((entry!.payload as { resultSha256: string }).resultSha256).toBe(result.resultSha256);

    const csv = await (
      await (api.exportRoute.GET as (r: Request, c: unknown) => Promise<Response>)(
        new Request("http://lab.test/x?format=csv"),
        P(runId),
      )
    ).text();
    const total = result.files.reduce(
      (s: number, f: { findings: unknown[] }) => s + f.findings.length,
      0,
    );
    expect(csv.trim().split("\r\n")).toHaveLength(total + 1);
    const plan = await (api.exportRoute.GET as (r: Request, c: unknown) => Promise<Response>)(
      new Request("http://lab.test/x?format=plan"),
      P(runId),
    );
    expect(await plan.text()).toContain("# QuantumLedger migration plan");
    const badFmt = await (api.exportRoute.GET as (r: Request, c: unknown) => Promise<Response>)(
      new Request("http://lab.test/x?format=exe"),
      P(runId),
    );
    expect(badFmt.status).toBe(400);

    const listed = await (
      await (api.workspace.GET as (r: Request, c: unknown) => Promise<Response>)(
        new Request("http://lab.test"),
        { params: Promise.resolve({ ws }) },
      )
    ).json();
    expect(listed.runs[0]).toMatchObject({ runId, status: "done", ledgerOk: true });
  });

  it("cancel stops a run between units and frees the workspace", async () => {
    const ws = await newWorkspace();
    const inputs = Array.from({ length: 20 }, (_, i) => ({
      kind: "paste",
      name: `f${i}.conf`,
      text: "ssl_ecdh_curve prime256v1;\n",
    }));
    const { runId } = await (await startRun({ workspace: ws, inputs })).json();
    const c = await (api.cancel.POST as (r: Request, c: unknown) => Promise<Response>)(
      new Request("http://lab.test", { method: "POST" }),
      P(runId),
    );
    expect(c.status).toBe(202);
    const events = await readEvents(runId);
    expect(events.at(-1)!.type).toBe("cancelled");
    const r = await (
      await (api.result.GET as (r: Request, c: unknown) => Promise<Response>)(
        new Request("http://lab.test"),
        P(runId),
      )
    ).json();
    expect(r.status).toBe("cancelled");
    expect(r.ledger).toBeNull();
    expect(
      (await startRun({ workspace: ws, inputs: [{ kind: "sample", id: SCAN_SAMPLES[0]!.id }] }))
        .status,
    ).toBe(202);
  });

  it("URL inputs use the cached real scans by default; an uncached host fails clearly without network", async () => {
    const ws = await newWorkspace();
    const { runId } = await (
      await startRun({ workspace: ws, inputs: [{ kind: "url", url: "https://ecc256.badssl.com" }] })
    ).json();
    await readEvents(runId);
    const r = await (
      await (api.result.GET as (r: Request, c: unknown) => Promise<Response>)(
        new Request("http://lab.test"),
        P(runId),
      )
    ).json();
    expect(r.status).toBe("done");
    expect(r.url.mode).toBe("cached");
    const ws2 = await newWorkspace();
    const { runId: r2 } = await (
      await startRun({ workspace: ws2, inputs: [{ kind: "url", url: "no-such-host.invalid" }] })
    ).json();
    const ev = await readEvents(r2);
    expect(ev.at(-1)!.type).toBe("error");
    expect(ev.at(-1)!.data.error.message).toContain("probe live");
  });

  it("scene data mirrors the run's findings with the scanner's weights, with an ETag and 304", async () => {
    const ws = await newWorkspace();
    const sample = SCAN_SAMPLES[0]!;
    const { runId } = await (
      await startRun({ workspace: ws, inputs: [{ kind: "sample", id: sample.id }] })
    ).json();
    await readEvents(runId);
    const get = api.scene.GET as (r: Request, c: unknown) => Promise<Response>;
    const res = await get(new Request("http://lab.test/s"), P(runId));
    expect(res.status).toBe(200);
    const etag = res.headers.get("etag")!;
    const scene = await res.json();
    expect(etag).toBe(`"${scene.resultSha256}-scene-v1"`);
    expect(scene.weights).toEqual(SEVERITY_WEIGHT);
    const direct = scan(sample.text, sample.filename);
    expect(scene.files[0].score).toBe(direct.score);
    expect(scene.files[0].lines).toBe(sample.text.split(/\r?\n/).length);
    expect(
      scene.files[0].findings.map((f: { line: number; weight: number }) => [f.line, f.weight]),
    ).toEqual(direct.findings.map((f) => [f.line, SEVERITY_WEIGHT[f.severity]]));
    const again = await get(
      new Request("http://lab.test/s", { headers: { "if-none-match": etag } }),
      P(runId),
    );
    expect(again.status).toBe(304);
    expect((await get(new Request("http://lab.test/s"), P("0".repeat(16)))).status).toBe(404);
  });

  it("CSV cells neutralise spreadsheet formulas", async () => {
    const { csvCell } = await import("@/app/api/lab/runs/[id]/export/route");
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
  });
});
