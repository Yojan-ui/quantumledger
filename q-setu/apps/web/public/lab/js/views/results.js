// Results: per-input score, grade, severity counts and findings, read only from the run's result JSON.
// Primary action: Inspect findings (opens the most severe finding).
import { h } from "../dom.js";
import { gradeClass, ms, orderedFindings, SEVERITIES, short, when } from "../fmt.js";
import { rollNumber } from "../motion.js";
import { href } from "../router.js";
import { latticeStage, loadScene } from "../scenes/lattice.js";

export async function loadResult(ctx, id) {
  try {
    return await ctx.store.get(`result:${id}`, `/api/lab/runs/${id}/result`, { quiet: true });
  } catch (e) {
    if (e.status === 409) {
      ctx.go(href("run", { id }), { replace: true });
      return null;
    }
    throw e;
  }
}

function sevBars(summary) {
  const max = Math.max(1, ...SEVERITIES.map((s) => summary[s] || 0));
  return h(
    "div",
    {
      class: "sevbars",
      role: "img",
      "aria-label": SEVERITIES.map((s) => `${summary[s] || 0} ${s}`).join(", "),
    },
    SEVERITIES.map((s) =>
      h(
        "div",
        { class: "sevbar" },
        h("span", { class: `sev sev-${s}`, text: s }),
        h(
          "div",
          { class: "track" },
          h("div", {
            class: `fill fill-${s}`,
            style: { width: `${(100 * (summary[s] || 0)) / max}%` },
          }),
        ),
        h("span", { class: "mono", text: String(summary[s] || 0) }),
      ),
    ),
  );
}

export async function view(ctx) {
  const id = ctx.params.id;
  const r = await loadResult(ctx, id);
  if (!r) return null;
  const ordered = orderedFindings(r);
  const first = ordered[0];
  const inspect = () => first && ctx.go(href("finding", { id, file: first.fi, n: first.n }));

  if (r.status !== "done") {
    return {
      el: h(
        "div",
        { class: "page enter" },
        h(
          "section",
          { class: "c-8 state state-error" },
          h(
            "div",
            { class: "inner" },
            h("p", { class: "eyebrow", text: `Run ${id}` }),
            h("h1", { text: `This run ${r.status === "cancelled" ? "was cancelled" : "failed"}` }),
            r.error ? h("p", { class: "mono", text: r.error.message }) : null,
            h(
              "div",
              { class: "actions" },
              h(
                "a",
                {
                  class: "btn btn-primary",
                  href: href("input", {}, { ws: ctx.ws }),
                  "data-link": true,
                  "data-primary": true,
                },
                "New scan",
              ),
              h("a", { class: "btn", href: href("run", { id }), "data-link": true }, "Run log"),
            ),
          ),
        ),
      ),
      crumbs: ["Lab", "Results", id],
    };
  }

  const fileBlocks = r.files.map((f, fi) => {
    const score = h("span", { class: "hero-sm" });
    rollNumber(score, f.score);
    return h(
      "section",
      { class: "c-12 section" },
      h(
        "div",
        { class: "page", style: { padding: "0", rowGap: "var(--s-5)" } },
        h(
          "div",
          { class: "c-5" },
          h(
            "p",
            { class: "eyebrow" },
            `Input ${fi + 1} · ${f.source}`,
            f.sampleLabel ? h("span", { class: "chip sample-tag", text: "Sample data" }) : null,
          ),
          h("h2", { text: f.name }),
          h("p", { class: "hash" }, `sha256 ${f.sha256} · ${f.lines} lines`),
          h("p", {}, score, " ", h("span", { class: "big-muted", text: "/ 100" })),
          h("span", { class: gradeClass(f.grade), text: f.grade }),
        ),
        h(
          "div",
          { class: "c-start-8" },
          h("p", { class: "eyebrow", text: `${f.findings.length} finding(s) by severity` }),
          sevBars(f.summary),
        ),
        f.findings.length
          ? h(
              "div",
              { class: "c-12 tbl-wrap" },
              h(
                "table",
                {},
                h(
                  "thead",
                  {},
                  h(
                    "tr",
                    {},
                    ["Line", "Severity", "Algorithm", "Primitive", "Match"].map((t, i) =>
                      h("th", { class: i === 0 ? "num" : null, scope: "col", text: t }),
                    ),
                  ),
                ),
                h(
                  "tbody",
                  {},
                  f.findings.map((x, n) =>
                    h(
                      "tr",
                      { "data-href": href("finding", { id, file: fi, n }) },
                      h(
                        "td",
                        { class: "num" },
                        h("a", {
                          href: href("finding", { id, file: fi, n }),
                          "data-link": true,
                          text: `${f.name}:${x.line}`,
                        }),
                      ),
                      h("td", {}, h("span", { class: `sev sev-${x.severity}`, text: x.severity })),
                      h("td", { text: x.algorithm }),
                      h("td", { class: "mono", text: x.primitive }),
                      h(
                        "td",
                        {},
                        h("code", {
                          text: x.match.length > 80 ? `${x.match.slice(0, 79)}…` : x.match,
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            )
          : h("p", {
              class: "c-12 muted",
              text: "No quantum-vulnerable or broken cryptography found in this input.",
            }),
      ),
    );
  });

  const u = r.url;
  const urlBlock = u
    ? h(
        "section",
        { class: "c-12 section" },
        h("p", {
          class: "eyebrow",
          text: `Host · ${u.mode === "live" ? "live TLS probe" : "cached real scan"}${u.scannedAt ? ` · scanned ${when(u.scannedAt)}` : ""}`,
        }),
        h("h2", { text: u.probe.host }),
        h("p", {}, h("span", { class: gradeClass(u.grade), text: `${u.score} · ${u.grade}` })),
        h(
          "table",
          {},
          h(
            "tbody",
            {},
            [
              ["Protocol", u.probe.protocol],
              ["Key exchange group", u.probe.group],
              ["Cipher", u.probe.cipher],
              ["Certificate key", u.probe.certKey],
              ["Certificate signature", u.probe.certSigAlg],
              ["Hybrid post-quantum", u.probe.hybridPq ? "yes" : "no"],
            ].map(([k, v]) =>
              h(
                "tr",
                {},
                h("th", { scope: "row", text: k }),
                h("td", { class: "mono", text: v ?? "–" }),
              ),
            ),
          ),
        ),
      )
    : null;

  const scene = r.files.length ? await loadScene(ctx, id) : null;
  const stage = scene ? latticeStage(ctx, id, scene) : null;
  const el = h(
    "div",
    { class: "page enter" },
    h(
      "section",
      { class: "c-8" },
      h("p", {
        class: "eyebrow",
        text: `Results · run ${id} · ${when(r.finishedAt)} · ${ms(r.durationMs)}`,
      }),
      h("h1", {
        text: ordered.length
          ? `${ordered.length} finding(s) across ${r.files.length} input(s)`
          : r.files.length
            ? "No vulnerable cryptography found"
            : "Host scan complete",
      }),
      h(
        "p",
        { class: "hash" },
        `input SHA-256 ${r.inputSha256} · result SHA-256 ${r.resultSha256}`,
      ),
      h(
        "div",
        { class: "actions" },
        first
          ? h(
              "button",
              { class: "btn btn-primary", type: "button", "data-primary": true, onclick: inspect },
              "Inspect findings",
              h("span", { class: "key", text: "↵" }),
            )
          : null,
        h(
          "a",
          {
            class: first ? "btn" : "btn btn-primary",
            href: href("evidence", { id }),
            "data-link": true,
          },
          "Evidence and export",
        ),
      ),
    ),
    h(
      "aside",
      { class: "c-start-9" },
      h("p", { class: "eyebrow", text: "Proof Chain" }),
      r.ledger
        ? h(
            "p",
            { class: "mono" },
            `entry #${r.ledger.entryId} · lab-run`,
            h("br"),
            h("span", { class: "hash", text: short(r.ledger.hash, 24) }),
            h("br"),
            r.ledger.verify?.ok
              ? `verified, ${r.ledger.verify.checked} entries`
              : h("span", { class: "grade grade-critical", text: "verify failed" }),
          )
        : h("p", { class: "muted", text: "Not signed" }),
    ),
    stage
      ? h(
          "section",
          { class: "c-12 section" },
          h("p", { class: "eyebrow", text: "Findings map · hover for fields, click to open" }),
          stage.el,
          stage.legend,
        )
      : null,
    ...fileBlocks,
    urlBlock,
  );
  el.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-href]");
    if (tr && !e.target.closest("a")) ctx.go(tr.dataset.href);
  });
  return {
    el,
    crumbs: ["Lab", "Results", id],
    keys: { enter: inspect },
    stage: stage && stage.spec,
  };
}
