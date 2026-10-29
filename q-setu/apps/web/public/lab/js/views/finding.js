// Finding detail (deep-linkable): every field comes from the scanner's Finding. Primary action: Next finding (j/k).
import { h } from "../dom.js";
import { orderedFindings } from "../fmt.js";
import { href } from "../router.js";
import { loadResult } from "./results.js";

export async function view(ctx) {
  const { id, file, n } = ctx.params;
  const r = await loadResult(ctx, id);
  if (!r) return null;
  const f = r.files[file];
  const x = f && f.findings[n];
  if (!x) {
    return {
      el: h(
        "div",
        { class: "page enter" },
        h(
          "section",
          { class: "c-8 state" },
          h("h1", { text: "No such finding in this run" }),
          h("p", { class: "muted", text: `Run ${id} has no finding ${n} in input ${file}.` }),
          h(
            "div",
            { class: "actions" },
            h(
              "a",
              {
                class: "btn btn-primary",
                href: href("results", { id }),
                "data-link": true,
                "data-primary": true,
              },
              "Back to results",
            ),
          ),
        ),
      ),
      crumbs: ["Lab", "Results", "Finding"],
    };
  }
  const order = orderedFindings(r);
  const pos = order.findIndex((o) => o.fi === file && o.n === n);
  const step = (d) => {
    const o = order[(pos + d + order.length) % order.length];
    ctx.go(href("finding", { id, file: o.fi, n: o.n }), { replace: true });
  };

  const facts = [
    ["Location", `${f.name}:${x.line}:${x.column}`],
    ["Rule", x.ruleId],
    ["Algorithm", x.algorithm],
    ["Primitive", x.primitive],
    ["Quantum-vulnerable", x.quantumVulnerable ? "yes" : "no"],
    ["Quantum-safe", x.quantumSafe ? "yes" : "no"],
    ...(x.parameter ? [["Parameter", x.parameter]] : []),
    ["Input SHA-256", f.sha256],
  ];
  const el = h(
    "div",
    { class: "page enter" },
    h(
      "section",
      { class: "c-8" },
      h("p", {
        class: "eyebrow",
        text: `Finding ${pos + 1} of ${order.length} · most severe first`,
      }),
      h("p", {}, h("span", { class: `sev sev-${x.severity}`, text: x.severity })),
      h("h1", { text: x.algorithm }),
      h("pre", { class: "code", text: x.match }),
      h(
        "div",
        { class: "section" },
        h("p", { class: "eyebrow", text: "Why it matters" }),
        h("p", { class: "lede", text: x.why }),
      ),
      h(
        "div",
        { class: "section" },
        h("p", { class: "eyebrow", text: "Replace with" }),
        h("p", { class: "lede", text: x.replacement }),
      ),
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            "data-primary": true,
            onclick: () => step(1),
          },
          "Next finding",
          h("span", { class: "key", text: "J" }),
        ),
        h(
          "button",
          { class: "btn", type: "button", onclick: () => step(-1) },
          "Previous",
          h("span", { class: "key", text: "K" }),
        ),
        h(
          "a",
          { class: "btn", href: href("results", { id }), "data-link": true },
          "All results",
          h("span", { class: "key", text: "Esc" }),
        ),
      ),
    ),
    h(
      "aside",
      { class: "c-start-9" },
      h("p", { class: "eyebrow", text: "Source" }),
      h(
        "table",
        {},
        h(
          "tbody",
          {},
          facts.map(([k, v]) =>
            h("tr", {}, h("th", { scope: "row", text: k }), h("td", { class: "mono", text: v })),
          ),
        ),
      ),
    ),
  );
  return {
    el,
    crumbs: ["Lab", "Results", `${f.name}:${x.line}`],
    keys: { j: () => step(1), k: () => step(-1), escape: () => ctx.go(href("results", { id })) },
  };
}
