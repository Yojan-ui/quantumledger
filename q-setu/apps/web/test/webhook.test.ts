import { describe, expect, it, vi } from "vitest";

// DNS answers chosen per test; no request ever leaves the machine.
const answers = new Map<string, { address: string; family: number }[]>();
vi.mock("node:dns/promises", () => ({
  lookup: async (host: string) => {
    const a = answers.get(host);
    if (!a) throw new Error("ENOTFOUND");
    return a;
  },
}));

const { postWebhook, webhookHost } = await import("@/lib/server/webhook");
const { SiteSettingsBody } = await import("@/lib/server/schemas");

describe("webhookHost (when a webhook is saved)", () => {
  it("accepts a public https URL", () => {
    expect(webhookHost("https://hooks.slack.com/services/T0/B0/x")).toEqual({
      host: "hooks.slack.com",
    });
  });

  it.each([
    ["http://hooks.example.com/x", "https"],
    ["https://hooks.example.com:8443/x", "default port"],
    ["https://user:pw@hooks.example.com/x", "credentials"],
    ["https://127.0.0.1/x", "public"],
    ["https://169.254.169.254/latest/meta-data", "public"],
    ["https://10.0.0.5/admin", "public"],
    ["https://[::1]/x", "public"],
    ["https://localhost/x", "public"],
    ["https://metadata.google.internal/x", "public"],
    ["not a url", "valid URL"],
  ])("refuses %s", (url, why) => {
    const r = webhookHost(url);
    expect("error" in r && r.error).toMatch(new RegExp(why, "i"));
  });

  it("is enforced by the settings schema", () => {
    expect(SiteSettingsBody.safeParse({ alertWebhook: "https://10.0.0.5/x" }).success).toBe(false);
    expect(
      SiteSettingsBody.safeParse({ alertWebhook: "https://hooks.example.com/x" }).success,
    ).toBe(true);
    expect(SiteSettingsBody.safeParse({ alertWebhook: "" }).success).toBe(true);
  });
});

describe("postWebhook (when an alert is sent)", () => {
  it("sends nothing to a name that resolves to an internal address (DNS rebinding included)", async () => {
    answers.set("rebind.example.com", [{ address: "169.254.169.254", family: 4 }]);
    expect(await postWebhook("https://rebind.example.com/x", { a: 1 })).toBe(false);
    answers.set("mixed.example.com", [
      { address: "93.184.216.34", family: 4 },
      { address: "10.1.2.3", family: 4 },
    ]);
    expect(await postWebhook("https://mixed.example.com/x", { a: 1 })).toBe(false);
  });

  it("sends nothing for a URL refused outright, or a name that doesn't resolve", async () => {
    expect(await postWebhook("https://127.0.0.1/x", {})).toBe(false);
    expect(await postWebhook("https://nowhere.example.com/x", {})).toBe(false);
  });
});
