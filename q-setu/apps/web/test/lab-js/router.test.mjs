import assert from "node:assert/strict";
import { test } from "node:test";
import { href, match, ROUTES } from "../../public/lab/js/router.js";

const ID = "0123456789abcdef";

test("every route round-trips through href and match", () => {
  const params = { id: ID, file: 2, n: 17 };
  for (const r of ROUTES) {
    const p = Object.fromEntries([...r.path.matchAll(/:(\w+)/g)].map(([, k]) => [k, params[k]]));
    const m = match(href(r.name, p));
    assert.equal(m.name, r.name);
    assert.deepEqual(m.params, p);
  }
});

test("trailing slashes are ignored", () => {
  assert.equal(match("/lab/").name, "landing");
  assert.equal(match(`/lab/runs/${ID}/results/`).name, "results");
});

test("invalid params and unknown paths do not match", () => {
  for (const p of [
    "/lab/runs/xyz",
    `/lab/runs/${ID.toUpperCase()}`,
    `/lab/runs/${ID}/findings/a/1`,
    `/lab/runs/${ID}/findings/1/-1`,
    "/lab/nope",
    "/",
    "/labs",
  ]) {
    assert.equal(match(p), null, p);
  }
});

test("href encodes query and drops empty values", () => {
  assert.equal(href("input", {}, { ws: "aa", x: "", y: null }), "/lab/input?ws=aa");
  assert.throws(() => href("run"), /missing param id/);
  assert.throws(() => href("nope"), /unknown route/);
});
