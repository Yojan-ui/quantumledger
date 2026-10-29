import assert from "node:assert/strict";
import { test } from "node:test";
import { bytes, gradeClass, ms, orderedFindings, short, when } from "../../public/lab/js/fmt.js";

test("formatters", () => {
  assert.equal(bytes(512), "512 B");
  assert.equal(bytes(2048), "2.0 KB");
  assert.equal(bytes(3 * 1048576), "3.00 MB");
  assert.equal(ms(null), "–");
  assert.equal(ms(1.234), "1.23 ms");
  assert.equal(ms(250), "250 ms");
  assert.equal(ms(1500), "1.50 s");
  assert.equal(short("abcdef0123456789", 4), "abcd…");
  assert.equal(short(null), "–");
  assert.equal(when("2026-10-29T10:11:12.345Z"), "2026-10-29 10:11:12 UTC");
  assert.equal(when("not a date"), "not a date");
  assert.equal(gradeClass("At risk"), "grade grade-at-risk");
});

test("orderedFindings: most severe first, then file, then line; values untouched", () => {
  const r = {
    files: [
      {
        findings: [
          { severity: "low", line: 1 },
          { severity: "critical", line: 9 },
        ],
      },
      {
        findings: [
          { severity: "critical", line: 2 },
          { severity: "high", line: 1 },
        ],
      },
    ],
  };
  const o = orderedFindings(r).map((x) => [x.fi, x.n]);
  assert.deepEqual(o, [
    [0, 1],
    [1, 0],
    [1, 1],
    [0, 0],
  ]);
  assert.deepEqual(orderedFindings({}), []);
});
