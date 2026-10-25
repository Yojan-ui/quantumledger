/**
 * The Shield scene's run lock is released even when a run fails during setup (before this, a
 * failed setup in "Attack it" left every later run answering "busy" until a restart). The error a
 * visitor sees is the generic one, not the server's detail.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

const fail = vi.hoisted(() => ({ next: false }));
vi.mock("node:fs", async (real) => {
  const fs = await real<typeof import("node:fs")>();
  const mkdtempSync = ((prefix: string, ...rest: never[]) => {
    if (fail.next) {
      fail.next = false;
      throw new Error("ENOSPC: no space left on device, mkdtemp '/private/tmp/shield-x'");
    }
    return fs.mkdtempSync(prefix, ...rest);
  }) as typeof fs.mkdtempSync;
  return { ...fs, default: { ...fs, mkdtempSync }, mkdtempSync };
});

process.env.QSETU_DATA_DIR = mkdtempSync(join(tmpdir(), "plugin-lock-"));
const { runPlugin, runPluginAttack } = await import("@/lib/server/shield-plugin");
type Ev = Parameters<Parameters<typeof runPlugin>[1]>[0];

it("a failed attack setup releases the lock", async () => {
  fail.next = true;
  await expect(runPluginAttack()).rejects.toThrow(/ENOSPC/);
  const events: Ev[] = [];
  expect(await runPlugin("dns", (e) => events.push(e))).toBeUndefined();
  expect(events.some((e) => e.t === "done")).toBe(true);
});

it("a failed plugin setup releases the lock, and the visitor sees no server detail", async () => {
  fail.next = true;
  const events: Ev[] = [];
  expect(await runPlugin("dns", (e) => events.push(e))).toBeUndefined();
  const err = events.find((e) => e.t === "error") as Extract<Ev, { t: "error" }> | undefined;
  expect(err?.message).toBe("Something went wrong. Please try again.");
  expect(JSON.stringify(events)).not.toMatch(/ENOSPC|\/private\/tmp/);
  const again: Ev[] = [];
  expect(await runPlugin("dns", (e) => again.push(e))).toBeUndefined();
  expect(again.some((e) => e.t === "done")).toBe(true);
});
