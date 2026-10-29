import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LAB = join(__dirname, "..", "public", "lab");
const manifest = JSON.parse(readFileSync(join(LAB, "MANIFEST.json"), "utf8")) as {
  files: Record<string, string>;
};
const sha = (p: string) =>
  createHash("sha256")
    .update(readFileSync(join(LAB, p)))
    .digest("hex");

describe("lab vendored assets", () => {
  it("every vendored file matches its MANIFEST hash", () => {
    for (const [p, h] of Object.entries(manifest.files)) expect(sha(p), p).toBe(h);
  });
  it("no unlisted file sits in vendor/ or fonts/", () => {
    const listed = new Set(Object.keys(manifest.files));
    for (const dir of ["vendor/three-0.180.0", "fonts"])
      for (const f of readdirSync(join(LAB, dir)))
        expect(listed.has(`${dir}/${f}`), `${dir}/${f}`).toBe(true);
  });
  it("vendored three.js is the version the app depends on", () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "node_modules", "three", "package.json"), "utf8"),
    );
    expect(pkg.version).toBe("0.180.0");
  });
});
