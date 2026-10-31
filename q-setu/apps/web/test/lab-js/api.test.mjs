import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createApi, normaliseError } from "../../public/lab/js/api.js";

const res = (status, body) => ({
  ok: status < 400,
  status,
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
});

test("normalises both error envelopes", () => {
  const a = normaliseError(
    { error: { code: "invalid", message: "bad", fields: { "inputs.0": "empty" } } },
    400,
  );
  assert.deepEqual(
    [a.status, a.code, a.message, a.fields],
    [400, "invalid", "bad", { "inputs.0": "empty" }],
  );
  const b = normaliseError(
    {
      error: {
        code: "invalid_body",
        message: "m",
        issues: [
          { path: "url", message: "first" },
          { path: "url", message: "second" },
          { message: "root" },
        ],
      },
    },
    400,
  );
  assert.deepEqual(b.fields, { url: "first", _: "root" });
  const c = normaliseError(null, 502);
  assert.deepEqual([c.code, c.fields], ["http_502", null]);
});

test("GET retries once on 5xx, POST never retries", async () => {
  let calls = 0;
  const api = createApi({
    fetchImpl: async () => (++calls === 1 ? res(503, {}) : res(200, { ok: true })),
    sleep: async () => {},
  });
  assert.deepEqual(await api.get("/x"), { ok: true });
  assert.equal(calls, 2);
  calls = 0;
  const errs = [];
  const api2 = createApi({
    fetchImpl: async () => {
      calls++;
      return res(500, { error: { code: "boom", message: "x" } });
    },
    sleep: async () => {},
    onError: (e) => errs.push(e),
  });
  await assert.rejects(api2.post("/y", {}), (e) => e instanceof ApiError && e.code === "boom");
  assert.equal(calls, 1);
  assert.equal(errs.length, 1);
});

test("4xx is not retried, quiet suppresses onError, network errors are typed", async () => {
  let calls = 0;
  const errs = [];
  const api = createApi({
    fetchImpl: async () => {
      calls++;
      return res(409, { error: { code: "busy", message: "busy" } });
    },
    sleep: async () => {},
    onError: (e) => errs.push(e),
  });
  await assert.rejects(api.get("/z", { quiet: true }), { code: "busy", status: 409 });
  assert.equal(calls, 1);
  assert.equal(errs.length, 0);
  const down = createApi({
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
    sleep: async () => {},
  });
  await assert.rejects(down.get("/w", { quiet: true }), { code: "network", status: 0 });
});

test("JSON bodies are serialised with a content type", async () => {
  let seen;
  const api = createApi({
    fetchImpl: async (p, o) => {
      seen = o;
      return res(202, { id: "r" });
    },
  });
  await api.post("/runs", { a: 1 });
  assert.equal(seen.headers["Content-Type"], "application/json");
  assert.equal(seen.body, '{"a":1}');
});
