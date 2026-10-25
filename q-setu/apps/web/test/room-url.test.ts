import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { joinUrl, pickLanAddress } from "@/lib/server/room-url";

const v4 = (address: string, internal = false) =>
  ({ family: "IPv4", address, internal }) as NetworkInterfaceInfo;

describe("pickLanAddress", () => {
  it("takes the Wi-Fi address on a plain laptop (here an iPhone hotspot)", () => {
    expect(pickLanAddress({ lo0: [v4("127.0.0.1", true)], en0: [v4("172.20.10.5")] })).toBe(
      "172.20.10.5",
    );
  });

  it("skips VPN, Docker and VM adapters listed before the Wi-Fi", () => {
    expect(
      pickLanAddress({
        utun3: [v4("10.8.0.2")],
        docker0: [v4("172.17.0.1")],
        vmnet8: [v4("192.168.56.1")],
        en0: [v4("192.168.1.23")],
      }),
    ).toBe("192.168.1.23");
  });

  it("never offers a link-local address, and prefers a private one", () => {
    expect(pickLanAddress({ en5: [v4("169.254.10.2")], en0: [v4("192.168.1.9")] })).toBe(
      "192.168.1.9",
    );
    expect(pickLanAddress({ en0: [v4("203.0.113.7")], en1: [v4("10.0.0.4")] })).toBe("10.0.0.4");
  });

  it("falls back to a virtual adapter rather than nothing, and to null with no network", () => {
    expect(pickLanAddress({ utun0: [v4("10.8.0.2")] })).toBe("10.8.0.2");
    expect(pickLanAddress({ lo0: [v4("127.0.0.1", true)], en5: [v4("169.254.1.1")] })).toBeNull();
  });
});

describe("joinUrl", () => {
  it("keeps a host phones can already reach", () => {
    const r = joinUrl(new Request("http://172.20.10.5:3000/api/room"));
    expect(r).toEqual({ url: "http://172.20.10.5:3000/join", lan: false });
  });
});
