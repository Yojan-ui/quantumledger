import { afterEach, describe, expect, it, vi } from "vitest";
import { atlas, AtlasError } from "@/lib/client/atlas";
import {
  endpointError,
  endpointHosts,
  MAX_HOSTS,
  scanEndpoints,
} from "@/lib/client/endpoint-intake";

afterEach(() => vi.restoreAllMocks());
describe("Live endpoint intake", () => {
  it("normalises host lists (default port 443)", () => {
    expect(endpointHosts(" Example.com, api.example.com:8443\nexample.com. ")).toEqual([
      "example.com",
      "api.example.com:8443",
    ]);
  });
  it.each([
    "",
    "localhost",
    "db.internal",
    "printer.local",
    "10.0.0.1",
    "127.0.0.1:443",
    "192.168.1.10",
    "172.20.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "https://example.com",
    "user@example.com",
    "example.com/path",
    "example.com:99999",
    "example.com:443 example.com:8443",
  ])("refuses %s", (input) => {
    expect(() => endpointHosts(input)).toThrow();
  });
  it(`caps a scan at ${MAX_HOSTS} hosts`, () => {
    const many = Array.from({ length: MAX_HOSTS + 1 }, (_, i) => `h${i}.example.com`).join(",");
    expect(() => endpointHosts(many)).toThrow(/At most/);
  });
  it("creates a labelled workspace, submits the hosts to Atlas, then starts the run", async () => {
    const create = vi.spyOn(atlas, "createWorkspace").mockResolvedValue({} as never);
    const endpoints = vi.spyOn(atlas, "endpoints").mockResolvedValue({
      endpoints: [{ host: "example.com", port: 443 }],
      probes: ["example-com=example.com:443"],
      label: "Live TLS scan, 2026-10-31T00:00:00Z",
      assumption: "ASSUMPTION",
    });
    const start = vi.spyOn(atlas, "startRun").mockResolvedValue({ run_id: "r1" });
    const r = await scanEndpoints("example.com", vi.fn());
    expect(r.id).toMatch(/^tls-[a-f0-9-]{20}$/);
    expect(create.mock.calls[0]![1]).toMatch(/^Live TLS scan, \d{4}-\d\d-\d\d \d\d:\d\d UTC$/);
    expect(endpoints).toHaveBeenCalledWith(r.id, ["example.com"]);
    expect(start).toHaveBeenCalledWith(r.id);
    expect(r.run_id).toBe("r1");
  });
  it("bad input never creates a workspace", async () => {
    const create = vi.spyOn(atlas, "createWorkspace");
    await expect(scanEndpoints("localhost", vi.fn())).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it("explains Atlas refusals", () => {
    expect(endpointError(new AtlasError(503, "atlas_down", "down"))).toMatch(/unavailable/);
    expect(endpointError(new AtlasError(429, "rate_limited", "x"))).toMatch(/wait/);
    expect(
      endpointError(new AtlasError(422, "bad_endpoint", "intranet: resolves to a private address")),
    ).toMatch(/private/);
  });
});
