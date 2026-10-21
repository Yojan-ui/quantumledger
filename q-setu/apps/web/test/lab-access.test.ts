import { beforeEach, describe, expect, it, vi } from "vitest";

// The engine is mocked: two customers, and one incident on the second customer's site.
const CUSTOMERS = [
  {
    id: "ledgerwood",
    name: "Ledgerwood",
    site: "ledgerwood-bank",
    emails: ["ciso@ledgerwood.example"],
    note: "for ledgerwood",
    readiness: 40,
  },
  {
    id: "sahyadri",
    name: "Sahyadri",
    site: "sahyadri-clinic",
    emails: ["it@sahyadri.example"],
    note: "for sahyadri only",
    readiness: 70,
  },
];
const SAHYADRI_INCIDENT = {
  incident: { id: "inc_000007", site: "sahyadri-clinic" },
  pattern: { id: "secrets-probe", name: "Secrets probe", description: "" },
  timeline: { steps: [] },
  check: { ok: true },
};
const calls: string[] = [];

vi.mock("@/lib/lab/engine", () => {
  class EngineDown extends Error {}
  class EngineMissing extends Error {}
  return {
    EngineDown,
    EngineMissing,
    engine: vi.fn(async (path: string) => {
      calls.push(path);
      if (path === "/api/customers") return { customers: CUSTOMERS };
      if (path === "/api/incidents/inc_000007") return SAHYADRI_INCIDENT;
      if (path.startsWith("/api/overview")) return { incidents: [], totals: {}, key: {} };
      if (path === "/api/replay") return { id: "rp_x" };
      throw new EngineMissing();
    }),
  };
});

const { sessionToken, LAB_COOKIE } = await import("@/lib/lab/auth");
const incident = await import("@/app/api/lab/incidents/[id]/route");
const incidents = await import("@/app/api/lab/incidents/route");
const replay = await import("@/app/api/lab/replay/route");
const customers = await import("@/app/api/lab/customers/route");

const as = (
  user: Parameters<typeof sessionToken>[0] | undefined,
  url: string,
  init: RequestInit = {},
) =>
  new Request(`http://localhost${url}`, {
    ...init,
    headers: user ? { cookie: `${LAB_COOKIE}=${sessionToken(user)}` } : {},
  });
const ledgerwood = {
  email: "ciso@ledgerwood.example",
  role: "customer" as const,
  customerId: "ledgerwood",
};
const team = { email: "team@quantumledger.dev", role: "team" as const };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("Lab API: one customer can never load another's data", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("refuses a customer's request for another customer's incident", async () => {
    const r = await incident.GET(
      as(ledgerwood, "/api/lab/incidents/inc_000007"),
      params("inc_000007"),
    );
    expect(r.status).toBe(404);
    const body = await r.text();
    expect(body).not.toContain("sahyadri");
    expect(body).not.toContain("Secrets probe");
  });

  it("refuses a customer asking for another customer's scope", async () => {
    const r = await incidents.GET(as(ledgerwood, "/api/lab/incidents?customer=sahyadri"));
    expect(r.status).toBe(403);
    expect(calls.some((c) => c.includes("sahyadri"))).toBe(false);
  });

  it("only ever asks the engine for the customer's own site", async () => {
    const r = await incidents.GET(as(ledgerwood, "/api/lab/incidents"));
    expect(r.status).toBe(200);
    expect(calls).toContain("/api/overview?site=ledgerwood-bank");
  });

  it("keeps replay and the customer list to the team", async () => {
    const body = JSON.stringify({ incidentId: "inc_000007" });
    expect(
      (await replay.POST(as(ledgerwood, "/api/lab/replay", { method: "POST", body }))).status,
    ).toBe(403);
    expect((await customers.GET(as(ledgerwood, "/api/lab/customers"))).status).toBe(403);
  });

  it("refuses requests without a valid session", async () => {
    expect((await incidents.GET(as(undefined, "/api/lab/incidents"))).status).toBe(401);
    const forged = new Request("http://localhost/api/lab/incidents", {
      headers: { cookie: `${LAB_COOKIE}=eyJrIjoic2VzcyJ9.forged` },
    });
    expect((await incidents.GET(forged)).status).toBe(401);
  });

  it("lets the team see every customer's incident", async () => {
    const r = await incident.GET(as(team, "/api/lab/incidents/inc_000007"), params("inc_000007"));
    expect(r.status).toBe(200);
  });
});
