// Input stage: staged inputs as plates (3D) or as the same encoding in SVG: width fixed, depth = bytes against
// the per-file limit, marks = lines (capped at 48), outline only = rejected by the server, slim pole = host/URL.
import { h, s } from "../dom.js";
import { PLATE } from "../engine/layout.js";
import { platesLayer } from "../engine/plates.js";

const SLOT = 92,
  MAXH = 120;

function svgPlates(items) {
  const W = Math.max(4, items.length) * SLOT;
  return s(
    "svg",
    {
      class: "map2d",
      viewBox: `0 0 ${W} ${MAXH + 40}`,
      width: W,
      height: MAXH + 40,
      role: "img",
      "aria-label": `${items.length} staged input(s)`,
    },
    s("line", { x1: 0, x2: W, y1: MAXH + 8, y2: MAXH + 8, class: "map-rail" }),
    items.map((it, i) => {
      const x = i * SLOT + 8;
      const frac = Math.min(
        1,
        Math.log10(1 + (it.bytes || 0)) / Math.log10(1 + (it.maxBytes || 262144)),
      );
      const hgt = it.kind === "url" ? MAXH * 0.6 : 8 + (MAXH - 8) * frac;
      const w = it.kind === "url" ? 8 : SLOT - 22;
      const m = it.kind === "url" ? 0 : Math.min(it.lines || 0, PLATE.markCap);
      return s(
        "g",
        {},
        s(
          "rect",
          {
            x,
            y: MAXH + 8 - hgt,
            width: w,
            height: hgt,
            class: `plate${it.rejected ? " rejected" : ""}`,
          },
          s("title", { text: it.tip.join(" · ") }),
        ),
        Array.from({ length: m }, (_, k) =>
          s("line", {
            x1: x + 4,
            x2: x + 12,
            y1: MAXH + 8 - hgt + ((k + 0.5) / m) * hgt,
            y2: MAXH + 8 - hgt + ((k + 0.5) / m) * hgt,
            class: "plate-mark",
          }),
        ),
        s("text", {
          x,
          y: MAXH + 24,
          class: "map-meta",
          text: it.name.length > 12 ? `${it.name.slice(0, 11)}…` : it.name,
        }),
      );
    }),
  );
}

export function platesStage() {
  let layer = null,
    items = [];
  const fallback = h("div", { class: "fallback2d" });
  const caption = h("p", { class: "stage-caption", text: "Staged inputs appear here as plates." });
  const el = h(
    "div",
    {
      class: "stage stage-sm",
      "data-stage": "plates",
      role: "group",
      "aria-label": "Staged inputs. The same list is given as text beside this view.",
    },
    fallback,
    caption,
  );
  const legend = h(
    "p",
    { class: "legend" },
    h("span", {
      class: "legend-3d",
      text: "one plate per input · depth: bytes, log scale (full depth = the per-file limit) · marks: lines (up to 48) · edges only: rejected · pole: host or URL",
    }),
    h("span", {
      class: "legend-2d",
      text: "one plate per input · height: bytes, log scale (full height = the per-file limit) · marks: lines (up to 48) · outline: rejected · thin bar: host or URL",
    }),
  );
  function set(next) {
    const prev = items;
    items = next;
    fallback.replaceChildren(svgPlates(items));
    caption.hidden = items.length > 0;
    // the camera frames 4 plates at a time; reframe when the row crosses a multiple of 4
    const reframe =
      Math.ceil(Math.max(4, next.length) / 4) !== Math.ceil(Math.max(4, prev.length) / 4);
    if (layer) layer.set(items);
    if (layer && reframe && spec.repose) spec.repose();
  }
  const spec = {
    el,
    key: "plates",
    make: async (world) => platesLayer(world),
    bind: (l) => {
      layer = l;
      l.set(items);
    },
    pose: (l, aspect, fov) => l.overview(aspect, fov),
  };
  set([]);
  return { el, legend, spec, set };
}
