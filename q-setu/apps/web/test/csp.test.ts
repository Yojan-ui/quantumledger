import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce } from "@/lib/server/csp";

describe("Content Security Policy", () => {
  it("allows scripts only by nonce (plus what they load), never eval, in production", () => {
    const n = newNonce();
    const csp = contentSecurityPolicy(n, { dev: false, https: true });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toBe(`script-src 'self' 'nonce-${n}' 'strict-dynamic'`);
    expect(csp).not.toContain("unsafe-eval");
    expect(script).not.toContain("unsafe-inline");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("gives every response a different nonce", () => {
    expect(newNonce()).not.toBe(newNonce());
  });
  it("adds eval only for next dev, and allows the analytics origin when set", () => {
    expect(contentSecurityPolicy("x", { dev: true, https: false })).toContain("'unsafe-eval'");
    expect(
      contentSecurityPolicy("x", {
        dev: false,
        https: false,
        analytics: "https://plausible.io/js/script.js",
      }),
    ).toContain("connect-src 'self' https://plausible.io");
  });
  it("uses scripts-from-this-origin only (no nonce) for static HTML pages", () => {
    const script = contentSecurityPolicy(undefined, { dev: false, https: true })
      .split("; ")
      .find((d) => d.startsWith("script-src"));
    expect(script).toBe("script-src 'self'");
  });
});
