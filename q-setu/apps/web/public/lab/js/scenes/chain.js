// Proof Chain stage (landing, evidence). 3D column(s) of slabs, or the same encoding as an SVG grid: one mark per
// entry, oldest at the bottom of each column, lab-run entries brighter and linked to their run, a broken or
// tampered entry inverted. `verifying()` and `verified(v)` feed the real POST /api/ledger/verify call.
import { h, s } from "../dom.js";
import { chainLayer } from "../engine/chain.js";
import { CHAIN } from "../engine/layout.js";
import { href } from "../router.js";

const CELL_W = 22,
  CELL_H = 5,
  COL_GAP = 30;

function svgChain(chain, { selectedId = null, verify = null } = {}) {
  const es = chain.entries || [];
  const cols = Math.max(1, Math.ceil(es.length / CHAIN.perCol));
  const H = CHAIN.perCol * (CELL_H + 1) + 8;
  const W = cols * COL_GAP + 8;
  const bad = new Set([
    ...(chain.tampered || []),
    ...(verify && !verify.ok && verify.broken ? [verify.broken.id] : []),
  ]);
  return s(
    "svg",
    {
      class: "map2d chain2d",
      viewBox: `0 0 ${W} ${H}`,
      width: W,
      height: H,
      role: "img",
      "aria-label": `Proof Chain: ${chain.count} entries`,
    },
    es.map((e, i) => {
      const col = Math.floor(i / CHAIN.perCol),
        row = i % CHAIN.perCol;
      const cls = `chain-cell${e.kind === "lab-run" ? " lab" : ""}${bad.has(e.id) ? " bad" : ""}${e.id === selectedId ? " on" : ""}`;
      const label = `#${e.id} · ${e.kind}${bad.has(e.id) ? " · broken" : ""} · ${e.subject}`;
      const rect = s(
        "rect",
        {
          x: 4 + col * COL_GAP,
          y: H - 4 - (row + 1) * (CELL_H + 1),
          width: CELL_W,
          height: CELL_H,
          class: cls,
        },
        s("title", { text: label }),
      );
      return e.runId
        ? s(
            "a",
            { href: href("results", { id: e.runId }), "data-link": true, "aria-label": label },
            rect,
          )
        : rect;
    }),
  );
}

/**
 * opts: selectedId (evidence: this run's entry), plan (evidence: steps as ticks), intro (landing, first visit
 * this session: crane shot from above while the slabs appear oldest first).
 */
export function chainStage(ctx, chain, opts = {}) {
  let layer = null,
    verify = null;
  const fallback = h("div", { class: "fallback2d" });
  const el = h(
    "div",
    {
      class: `stage${opts.tall ? " stage-tall" : ""}`,
      "data-stage": "chain",
      role: "group",
      "aria-label":
        "Proof Chain. Counts, head hash and verify results are also given as text on this page.",
    },
    fallback,
  );
  const paint2d = () =>
    fallback.replaceChildren(svgChain(chain, { selectedId: opts.selectedId ?? null, verify }));
  paint2d();
  const legend = h(
    "p",
    { class: "legend" },
    h("span", {
      class: "legend-3d",
      text: `one slab per entry, oldest at the bottom, ${CHAIN.perCol} per column · rail: hash link · brighter: lab-run · inverted: broken or tampered${opts.plan ? " · ticks: plan steps (P1 brightest)" : ""}`,
    }),
    h("span", {
      class: "legend-2d",
      text: `one mark per entry, oldest at the bottom, ${CHAIN.perCol} per column · brighter: lab-run (links to its run) · inverted: broken or tampered`,
    }),
  );
  const spec = {
    el,
    key: "chain",
    selected: opts.selectedId ?? null,
    make: async (world) => chainLayer(world, chain),
    bind: (l) => {
      layer = l;
      l.setChain(chain);
      l.setPlan(opts.plan || null);
      if (verify) l.setVerify(verify);
    },
    intro: opts.intro ? (l, aspect, fov) => l.introPose(aspect, fov) : null,
    pose: (l, aspect, fov) =>
      opts.selectedId ? l.focus(opts.selectedId) : l.overview(aspect, fov),
    onSelect: (hit) => hit.runId && ctx.go(href("results", { id: hit.runId })),
  };
  return {
    el,
    legend,
    spec,
    verifying: () => layer && layer.verifying(),
    /** The verify call itself failed (network / server): stop the band, change nothing else. */
    verifyFailed: () => layer && layer.stopSweep(),
    verified: (v) => {
      verify = v;
      paint2d();
      if (layer) layer.setVerify(v);
    },
  };
}

export const loadChain = (ctx) => ctx.api.get("/api/lab/chain", { cache: "no-cache" });
