// Results / finding stage: the findings map of one run. 3D when the world is available, otherwise (and as
// the accessible version) an SVG with the same encoding: column = input file, vertical position = line,
// bar length = scanner severity weight, outline = quantum-safe, top bar = file score. Bars are real links.
import { h, s } from "../dom.js";
import { latticeLayer, prepLattice } from "../engine/lattice.js";
import { LEVEL } from "../engine/layout.js";
import { href } from "../router.js";

const COL = 120,
  TOP = 46,
  TRACK = 300,
  PAD = 8;

function svgMap(id, scene, selected) {
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
      "aria-label": `Findings map: ${scene.files.length} input file(s)`,
    },
    scene.files.map((f, fi) => {
      const x0 = fi * COL + PAD;
      const slot = new Map(); // several findings on one line stack downwards, 5 units apart, so each stays clickable
      return s(
        "g",
        {},
        s("text", {
          x: x0,
          y: 12,
          class: "map-name",
          text: f.name.length > 16 ? `${f.name.slice(0, 15)}…` : f.name,
        }),
        s(
          "rect",
          {
            x: x0,
            y: 20,
            width: (COL - 2 * PAD) * (f.score / 100) + 1,
            height: 6,
            class: "map-score",
          },
          s("title", { text: `${f.name}: score ${f.score} / 100, ${f.grade}` }),
        ),
        s("text", { x: x0, y: 40, class: "map-meta", text: `${f.score} · ${f.lines} lines` }),
        s("line", {
          x1: x0,
          x2: x0,
          y1: TOP,
          y2: TOP + ((f.lines || 1) / maxLines) * TRACK,
          class: "map-rail",
        }),
        f.findings.map((x) => {
          const on = selected && selected.fi === fi && selected.n === x.n;
          const w = 4 + (x.weight || 0) * 2.2;
          const k = slot.get(x.line) || 0;
          slot.set(x.line, k + 1);
          return s(
            "a",
            {
              href: href("finding", { id, file: fi, n: x.n }),
              "data-link": true,
              "aria-label": `${f.name} line ${x.line}, ${x.severity}, ${x.algorithm}`,
              "aria-current": on ? "true" : null,
            },
            s(
              "rect",
              {
                x: x0 + 2,
                y: y(x.line) - 2 + k * 5,
                width: w,
                height: 4,
                class: `map-bar${x.quantumSafe ? " safe" : ""}${on ? " on" : ""}`,
                "fill-opacity": x.quantumSafe ? 0 : (LEVEL[x.severity] ?? 0.3),
              },
              s("title", {
                text: `${f.name}:${x.line} · ${x.severity} · ${x.algorithm} · weight ${x.weight}`,
              }),
            ),
          );
        }),
      );
    }),
  );
}

/** Builds the stage element and the 3D spec for main.js. selected = {fi, n} on the finding route. */
export function latticeStage(ctx, id, scene, selected = null) {
  const w = scene.weights;
  const el = h(
    "div",
    {
      class: "stage",
      "data-stage": "lattice",
      role: "group",
      "aria-label": "Findings map. Every finding is also listed as text on this page.",
    },
    h("div", { class: "fallback2d" }, svgMap(id, scene, selected)),
  );
  const weights = `scanner severity weight (critical ${w.critical}, high ${w.high}, medium ${w.medium}, low ${w.low}, info ${w.info})`;
  const legend = h(
    "p",
    { class: "legend" },
    h("span", {
      class: "legend-3d",
      text: `x: input file · depth: line number · height: ${weights} · wireframe: quantum-safe · back slab: score 0–100`,
    }),
    h("span", {
      class: "legend-2d",
      text: `column: input file · top bar: score 0–100 · down: line number · bar length: ${weights} · outline: quantum-safe`,
    }),
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
  return { el, legend, spec };
}

export const loadScene = (ctx, id) =>
  ctx.store.get(`scene:${id}`, `/api/lab/runs/${id}/scene`, { quiet: true, cache: "no-cache" });
