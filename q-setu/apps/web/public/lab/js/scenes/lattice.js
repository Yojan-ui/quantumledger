// Findings map of one run (results, finding, live run). 3D when the world is available; otherwise, and as the
// accessible version, an SVG with the same encoding: column = input file, gauge = score 0-100 (an empty
// outlined gauge with "0" is a real score of 0; a dashed one means not scanned yet), vertical position = line,
// bar length = scanner severity weight, outline = quantum-safe. Bars link to the finding once the run is done.
import { h, s } from "../dom.js";
import { latticeLayer, prepLattice } from "../engine/lattice.js";
import { LEVEL } from "../engine/layout.js";
import { href } from "../router.js";

const COL = 128,
  TOP = 52,
  TRACK = 300,
  PAD = 8,
  GW = COL - 2 * PAD - 8;

export function svgMap(id, scene, { selected = null, linkable = true } = {}) {
  const maxLines = Math.max(1, ...scene.files.map((f) => f.lines || 1));
  const y = (line) => TOP + ((line - 0.5) / maxLines) * TRACK;
  const W = Math.max(1, scene.files.length) * COL;
  return s(
    "svg",
    {
      class: "map2d",
      viewBox: `0 0 ${W} ${TOP + TRACK + PAD}`,
      width: W,
      height: TOP + TRACK + PAD,
      role: "img",
      "aria-label": `Findings map: ${scene.files.length} input(s)`,
    },
    scene.files.map((f, fi) => {
      const x0 = fi * COL + PAD;
      const scanned = typeof f.score === "number";
      const slot = new Map(); // several findings on one line stack downwards, 5 units apart, so each stays clickable
      return s(
        "g",
        { class: scanned ? null : "pending" },
        s("text", {
          x: x0,
          y: 12,
          class: "map-name",
          text: f.name.length > 17 ? `${f.name.slice(0, 16)}…` : f.name,
        }),
        s("rect", {
          x: x0,
          y: 19,
          width: GW,
          height: 8,
          class: `map-gauge${scanned ? "" : " waiting"}`,
        }),
        scanned && f.score > 0
          ? s("rect", { x: x0, y: 19, width: (GW * f.score) / 100, height: 8, class: "map-score" })
          : null,
        s("title", {
          text: scanned
            ? `${f.name}: score ${f.score} / 100, ${f.grade}`
            : `${f.name}: not scanned yet`,
        }),
        s("text", {
          x: x0,
          y: 42,
          class: scanned && f.score === 0 ? "map-zero" : "map-meta",
          text: scanned
            ? `${f.score} / 100 · ${f.lines} lines`
            : f.lines
              ? `waiting · ${f.lines} lines`
              : "waiting",
        }),
        f.lines
          ? s("line", {
              x1: x0,
              x2: x0,
              y1: TOP,
              y2: TOP + (f.lines / maxLines) * TRACK,
              class: "map-rail",
            })
          : null,
        (f.findings || []).map((x, local) => {
          const n = x.n ?? local;
          const on = selected && selected.fi === fi && selected.n === n;
          const w = 4 + (x.weight || 0) * 2.2;
          const k = slot.get(x.line) || 0;
          slot.set(x.line, k + 1);
          const label = `${f.name}:${x.line} · ${x.severity}${x.algorithm ? ` · ${x.algorithm}` : ""} · weight ${x.weight}`;
          const bar = s(
            "rect",
            {
              x: x0 + 2,
              y: y(x.line) - 2 + k * 5,
              width: w,
              height: 4,
              class: `map-bar${x.quantumSafe ? " safe" : ""}${on ? " on" : ""}`,
              "fill-opacity": x.quantumSafe ? 0 : (LEVEL[x.severity] ?? 0.3),
            },
            s("title", { text: label }),
          );
          return linkable
            ? s(
                "a",
                {
                  href: href("finding", { id, file: fi, n }),
                  "data-link": true,
                  "aria-label": label,
                  "aria-current": on ? "true" : null,
                },
                bar,
              )
            : bar;
        }),
      );
    }),
  );
}

function legendFor(scene) {
  const w = scene.weights || { critical: 40, high: 25, medium: 10, low: 3, info: 0 };
  const weights = `scanner severity weight (critical ${w.critical}, high ${w.high}, medium ${w.medium}, low ${w.low}, info ${w.info})`;
  return h(
    "p",
    { class: "legend" },
    h("span", {
      class: "legend-3d",
      text: `x: input file · depth: line number · height: ${weights} · edges only: quantum-safe · gauge: score 0–100 (solid base, empty frame = 0)`,
    }),
    h("span", {
      class: "legend-2d",
      text: `column: input file · gauge: score 0–100 · down: line number · bar length: ${weights} · outline: quantum-safe`,
    }),
  );
}

/** Results / finding stage. selected = {fi, n} on the finding route. */
export function latticeStage(ctx, id, scene, selected = null) {
  const el = h(
    "div",
    {
      class: "stage",
      "data-stage": "lattice",
      role: "group",
      "aria-label": "Findings map. Every finding is also listed as text on this page.",
    },
    h("div", { class: "fallback2d" }, svgMap(id, scene, { selected })),
  );
  const spec = {
    el,
    key: `lattice:${id}:${scene.resultSha256}`,
    selected,
    make: async (world) => latticeLayer(world, scene, await prepLattice(scene)),
    pose: (layer, aspect, fov) =>
      selected ? layer.focus(selected.fi, selected.n) : layer.overview(aspect, fov),
    onSelect: (hit) =>
      hit.kind === "finding" && ctx.go(href("finding", { id, file: hit.fi, n: hit.n })),
  };
  return { el, legend: legendFor(scene), spec };
}

/**
 * Live run stage: starts from the run's inputs (every column waiting) and changes only on real SSE events,
 * through the returned `on(type, data)`.
 */
export function runStage(ctx, run) {
  const scene = {
    files: run.inputs.map((i) => ({
      name: i.name,
      lines: i.source === "url" ? 0 : i.lines,
      score: null,
      grade: null,
      findings: [],
    })),
  };
  let layer = null,
    done = false;
  const fallback = h("div", { class: "fallback2d" });
  const el = h(
    "div",
    {
      class: "stage",
      "data-stage": "run",
      role: "group",
      "aria-label":
        "Live map of this run. Progress and results are also listed as text on this page.",
    },
    fallback,
  );
  const paint2d = () => fallback.replaceChildren(svgMap(run.runId, scene, { linkable: done }));
  paint2d();
  let sweep = null,
    seal = null;
  const nextPending = () => {
    const i = scene.files.findIndex((f) => typeof f.score !== "number");
    return i < 0 ? null : i;
  };
  function on(type, data) {
    if (type === "stage" && data.name === "scan")
      sweep = data.status === "running" ? nextPending() : null;
    else if (type === "file" || type === "url") {
      const f = scene.files[data.index];
      if (!f || typeof f.score === "number") return; // replayed event
      f.score = data.score;
      f.grade = data.grade;
      if (type === "file") f.findings = (data.positions || []).map((p) => ({ ...p }));
      sweep = nextPending();
      layer && layer.setScene({ files: scene.files.map((x) => ({ ...x })) });
      paint2d();
    } else if (type === "ledger") seal = data.verify ? (data.verify.ok ? 1 : 0.2) : 0.5;
    else if (type === "result" || type === "cancelled" || type === "error") {
      sweep = null;
      done = type === "result";
      if (type !== "result") seal = null;
      paint2d();
    }
    if (layer) {
      layer.setSweep(sweep);
      layer.setSeal(seal);
    }
  }
  const spec = {
    el,
    key: `run:${run.runId}`,
    make: async (world) =>
      latticeLayer(world, scene, await prepLattice(scene), { live: true, linkable: () => done }),
    bind: (l) => {
      layer = l;
      l.setScene({ files: scene.files.map((x) => ({ ...x })) });
      l.setSweep(sweep);
      l.setSeal(seal);
    },
    pose: (l, aspect, fov) => l.overview(aspect, fov),
    onSelect: (hit) =>
      done &&
      hit.kind === "finding" &&
      ctx.go(href("finding", { id: run.runId, file: hit.fi, n: hit.n })),
  };
  return { el, legend: legendFor({}), spec, on };
}

export const loadScene = (ctx, id) =>
  ctx.store.get(`scene:${id}`, `/api/lab/runs/${id}/scene`, { quiet: true, cache: "no-cache" });
