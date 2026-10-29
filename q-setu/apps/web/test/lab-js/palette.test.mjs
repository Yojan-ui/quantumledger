import assert from "node:assert/strict";
import { test } from "node:test";
import { rankCommands, SHORTCUTS } from "../../public/lab/js/palette.js";

const C = [
  { id: "home", title: "Lab home", group: "Go", keywords: "landing proof chain" },
  { id: "new", title: "New scan", group: "Go", keywords: "input paste upload sample host" },
  { id: "evidence", title: "Evidence and export", group: "This run", keywords: "plan ledger" },
  { id: "dl-csv", title: "Download CSV", group: "This run", keywords: "export download" },
  { id: "verify", title: "Verify the Proof Chain now", group: "Proof Chain", keywords: "ledger" },
  { id: "theme", title: "Light theme", group: "Settings", keywords: "theme colour mode" },
];
const ids = (q) => rankCommands(C, q).map((c) => c.id);

test("empty query keeps display order", () =>
  assert.deepEqual(
    ids(""),
    C.map((c) => c.id),
  ));
test("every word must match title or keywords", () => {
  assert.deepEqual(ids("download csv"), ["dl-csv"]);
  assert.deepEqual(ids("zzz"), []);
  assert.deepEqual(ids("upload"), ["new"]); // keyword only
});
test("title prefix beats word start beats keywords", () => {
  assert.deepEqual(ids("ver"), ["verify"]);
  assert.deepEqual(ids("export"), ["evidence", "dl-csv"]); // in title (word start) vs keyword only
  assert.deepEqual(ids("chain"), ["verify", "home"]);
});
test("case-insensitive and regex-safe", () => {
  assert.deepEqual(ids("LIGHT"), ["theme"]);
  assert.deepEqual(ids("(["), []);
});
test("the shortcut list names the palette and the finding keys", () => {
  const keys = SHORTCUTS.map(([k]) => k).join(" ");
  for (const k of ["⌘K", "?", "J / K", "Esc"]) assert.ok(keys.includes(k), k);
});
