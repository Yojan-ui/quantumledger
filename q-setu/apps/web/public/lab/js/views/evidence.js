// Evidence and export: migration plan, Proof Chain entry and verify, run metadata, inputs and downloads.
// Primary action: Download JSON (the printable report arrives in stage 5).
import { h } from "../dom.js";
import { ms, when } from "../fmt.js";
import { href } from "../router.js";
import { loadResult } from "./results.js";

export async function view(ctx) {
  const id = ctx.params.id;
  const r = await loadResult(ctx, id);
  if (!r) return null;
  const dl = (format, label, primary = false) =>
    h(
      "a",
      {
        class: primary ? "btn btn-primary" : "btn",
        href: `/api/lab/runs/${id}/export?format=${format}`,
        download: "",
        "data-primary": primary || undefined,
      },
      label,
    );
  const plan = r.plan;
  const lg = r.ledger;
  const meta = [
    ["Run", r.runId],
    ["Status", r.status],
    ["Started", when(r.startedAt)],
    ["Finished", when(r.finishedAt)],
    ["Duration", ms(r.durationMs)],
    ["Input SHA-256", r.inputSha256],
    ["Result SHA-256", r.resultSha256 ?? "–"],
    ["App", r.version.app],
    ["Core", r.version.core],
    ["Commit", r.version.commit ?? "unknown"],
    ["Data lifetime", `${r.params.dataLifetimeYears} years`],
    [
      "Hybrid PQ deployed",
      r.params.hybridPq === null ? "not stated" : r.params.hybridPq ? "yes" : "no",
    ],
  ];
  const el = h(
    "div",
    { class: "page enter" },
    h(
      "section",
      { class: "c-8" },
      h("p", { class: "eyebrow", text: `Evidence · run ${id}` }),
      h("h1", { text: "Migration plan, Proof Chain record and exports" }),
      h(
        "div",
        { class: "actions" },
        dl("json", "Download JSON", true),
        dl("csv", "Findings CSV"),
        dl("cbom", "CBOM (CycloneDX 1.6)"),
        plan ? dl("plan", "Plan (Markdown)") : null,
      ),
    ),
    plan
      ? h(
          "section",
          { class: "c-7 section" },
          h("p", {
            class: "eyebrow",
            text: `Migration plan · ${plan.steps.length} step(s) · horizon ${plan.assumptions.horizonYear} · ${plan.assumptions.yearsLeft} years left · data lifetime ${plan.assumptions.dataLifetimeYears} years`,
          }),
          plan.steps.length
            ? h(
                "ol",
                { class: "list" },
                plan.steps.map((s) =>
                  h(
                    "li",
                    {},
                    h(
                      "div",
                      {},
                      h("b", { text: `${s.priority} · ${s.title}` }),
                      h("p", { class: "muted", text: s.action }),
                      h("p", { class: "hint", text: s.why }),
                      h("p", {
                        class: "hint",
                        text: `effort ${s.effort} · ${s.fixer} · resolves ${Array.isArray(s.resolves) ? s.resolves.join(", ") : s.resolves}`,
                      }),
                    ),
                    h("span", { class: "chip", text: s.id }),
                  ),
                ),
              )
            : h("p", { class: "muted", text: "No migration steps: nothing to replace." }),
        )
      : null,
    h(
      "aside",
      { class: "c-start-9 section" },
      h("p", { class: "eyebrow", text: "Proof Chain record" }),
      lg
        ? [
            h("p", { class: "mono" }, `entry #${lg.entryId} · ${lg.kind}`),
            h("p", { class: "hash", text: lg.hash }),
            h("p", { class: "hint", text: lg.note }),
            lg.verify
              ? lg.verify.ok
                ? h(
                    "p",
                    { class: "mono" },
                    h("b", { text: "Chain verified " }),
                    `${lg.verify.checked} entries · head `,
                    h("span", { class: "hash", text: String(lg.verify.head).slice(0, 16) }),
                  )
                : h(
                    "p",
                    {},
                    h("span", {
                      class: "grade grade-critical",
                      text: `broken at #${lg.verify.broken?.id}`,
                    }),
                  )
              : null,
          ]
        : h("p", { class: "muted", text: "This run was not signed." }),
    ),
    h(
      "section",
      { class: "c-7 section" },
      h("p", { class: "eyebrow", text: "Run metadata" }),
      h(
        "table",
        {},
        h(
          "tbody",
          {},
          meta.map(([k, v]) =>
            h("tr", {}, h("th", { scope: "row", text: k }), h("td", { class: "mono", text: v })),
          ),
        ),
      ),
    ),
    h(
      "section",
      { class: "c-start-8 section" },
      h("p", { class: "eyebrow", text: `Inputs · ${r.inputs.length}` }),
      h(
        "ul",
        { class: "list" },
        r.inputs.map((i) =>
          h(
            "li",
            {},
            h(
              "div",
              {},
              h("b", { text: i.name }),
              h(
                "div",
                { class: "meta" },
                `${i.source}${i.sampleLabel ? " · Sample data" : ""} · ${i.bytes} B · sha256 ${i.sha256}`,
              ),
            ),
          ),
        ),
      ),
    ),
    h(
      "section",
      { class: "c-12 section" },
      h("p", { class: "eyebrow", text: "Run log" }),
      h(
        "ol",
        { class: "log" },
        r.log.map((l) => h("li", {}, h("b", { text: `${when(l.t)} ${l.stage} ` }), l.message)),
      ),
    ),
    h(
      "p",
      { class: "c-12" },
      h("a", { href: href("results", { id }), "data-link": true, text: "Back to results" }),
    ),
  );
  return { el, crumbs: ["Lab", "Evidence", id] };
}
