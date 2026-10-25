import { afterEach, describe, expect, it, vi } from "vitest";

// The pipeline's network and crypto, faked: the scan answers after a delay; every other stage fails
// at once, which ends autoplay.
const calls: string[] = [];
vi.mock("@/lib/client/trust", () => ({
  verifiedFetch: async (url: string) => {
    calls.push(url);
    if (url === "/api/scan/url") {
      await new Promise((r) => setTimeout(r, 50));
      return Response.json({
        probe: { host: "ecc256.badssl.com", protocol: "TLSv1.3", group: "x25519", certKey: "EC" },
        findings: [],
        score: 40,
        cached: true,
      });
    }
    return Response.json({ error: "not in this test" }, { status: 500 });
  },
}));
vi.mock("@/lib/client/handshake-crypto", () => ({ hs: {} }));
vi.mock("@/lib/client/live", () => ({ pushLocal: () => {} }));

const { actions, autoplay, getPipeline } = await import("@/lib/client/pipeline");

afterEach(() => void (calls.length = 0));

describe("autoplay", () => {
  it("waits for a stage another run has in flight instead of spinning", async () => {
    // The hero's opening starts the scan; the tour's autoplay starts while it is still running.
    const scan = actions.detect("ecc256.badssl.com", true);
    let ticked = false;
    setTimeout(() => (ticked = true), 10);
    await autoplay(0, [0, 0, 0, 0, 0]);
    await scan;
    // A spinning loop never yields: the timer couldn't fire and the scan's reply couldn't land.
    expect(ticked).toBe(true);
    expect(calls.filter((u) => u === "/api/scan/url")).toHaveLength(1);
    expect(getPipeline().status[0]).toBe("done");
    // It went on to the next stage (which this test fails on purpose) and stopped there.
    expect(getPipeline().status[1]).toBe("failed");
    expect(getPipeline().autoplay).toBe(false);
  }, 5000);
});
