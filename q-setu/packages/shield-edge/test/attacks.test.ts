/**
 * The attack suite's target restriction: it must refuse every host that isn't loopback (by name and
 * by address) or one of the project's own demo deploys, before sending a single request.
 */
import { describe, expect, it } from "vitest";
import {
  assertAllowedTarget,
  OWN_DEMO_HOSTS,
  runSuite,
  TargetRefused,
  tlsCheck,
} from "../src/attacks";

describe("attack suite targets", () => {
  it("allows loopback only", async () => {
    for (const u of [
      "http://127.0.0.1:4000",
      "https://localhost:4443",
      "http://[::1]:8080",
      "http://127.0.0.9/",
    ])
      await expect(assertAllowedTarget(u)).resolves.toBeUndefined();
  });
  it("refuses everything else, including private and tricky addresses", async () => {
    for (const u of [
      "https://example.com",
      "http://10.0.0.1",
      "http://192.168.1.1",
      "http://169.254.169.254",
      "http://0.0.0.0",
      "http://[::ffff:10.0.0.1]",
      "http://localhost.example.com",
      "http://127.0.0.1.nip.io",
      "https://www.google.com",
    ])
      await expect(assertAllowedTarget(u), u).rejects.toBeInstanceOf(TargetRefused);
  });
  it("refuses before sending anything, for every entry point", async () => {
    await expect(runSuite({ label: "x", url: "https://example.com" })).rejects.toBeInstanceOf(
      TargetRefused,
    );
    await expect(tlsCheck({ label: "x", url: "https://example.com" })).rejects.toBeInstanceOf(
      TargetRefused,
    );
  });
  it("has no third-party hosts on its demo list", () => {
    expect(OWN_DEMO_HOSTS).toEqual([]);
  });
});
