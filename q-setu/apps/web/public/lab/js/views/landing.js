// Landing: the Proof Chain as it stands and this workspace's runs. Primary action: New scan.
import { h } from "../dom.js";
import { gradeClass, ms, short, when } from "../fmt.js";
import { rollNumber } from "../motion.js";
import { href } from "../router.js";

export async function view(ctx) {
  const [ledger, ws] = await Promise.all([
    ctx.api.get("/api/ledger?limit=1"),
    ctx.store.get(`ws:${ctx.ws}`, `/api/lab/workspaces/${ctx.ws}`),
  ]);
  const head = ledger.entries && ledger.entries[0];
  const count = h("p", { class: "hero", "aria-describedby": "chain-sub" });
  rollNumber(count, ledger.count);
  const verifyOut = h("div", { "aria-live": "polite" });

  async function verify(btn) {
    btn.setAttribute("aria-disabled", "true");
    verifyOut.replaceChildren(
      h("p", {
        class: "hint",
        text: "Verifying every entry's SHA3-256 link and ML-DSA-65 signature…",
      }),
    );
    try {
      const v = await ctx.api.post("/api/ledger/verify");
      verifyOut.replaceChildren(
        v.ok
          ? h(
              "p",
              { class: "mono" },
              h("b", { text: "Verified. " }),
              `${v.checked} entries in ${ms(v.ms)} · head `,
              h("span", { class: "hash", text: short(v.head, 16) }),
            )
          : h(
              "p",
              { class: "mono" },
              h("span", { class: "grade grade-critical", text: `Broken at #${v.broken.id}` }),
              " ",
              v.broken.detail || v.broken.reason,
            ),
      );
      ctx.announce(
        v.ok
          ? `Proof Chain verified, ${v.checked} entries`
          : `Proof Chain broken at entry ${v.broken.id}`,
      );
    } catch {
      verifyOut.replaceChildren();
    }
    btn.removeAttribute("aria-disabled");
  }

  const runs = ws.runs || [];
  const runList = runs.length
    ? h(
        "ul",
        { class: "list" },
        runs.slice(0, 6).map((r) =>
          h(
            "li",
            {},
            h(
              "div",
              {},
              h("a", {
                href: href(r.status === "done" ? "results" : "run", { id: r.runId }),
                "data-link": true,
                text: when(r.finishedAt),
              }),
              h(
                "div",
                { class: "meta" },
                `${r.inputs.length} input(s) · ${r.inputs.map((i) => i.name).join(", ")}`,
              ),
            ),
            h(
              "div",
              {},
              r.status === "done"
                ? r.files[0]
                  ? h("span", {
                      class: gradeClass(r.files[0].grade),
                      text: `${r.files[0].score} · ${r.files[0].grade}`,
                    })
                  : r.url
                    ? h("span", {
                        class: gradeClass(r.url.grade),
                        text: `${r.url.score} · ${r.url.grade}`,
                      })
                    : null
                : h("span", { class: "chip", text: r.status }),
            ),
          ),
        ),
      )
    : h(
        "div",
        { class: "state" },
        h("h2", { text: "No runs in this workspace yet" }),
        h(
          "p",
          { class: "muted" },
          "Paste code or a config, drop files, name a host, or start with Sample data. Each run is scanned, planned and signed into the Proof Chain.",
        ),
      );

  const el = h(
    "div",
    { class: "page enter" },
    h(
      "section",
      { class: "c-7" },
      h("h1", { class: "sr", text: "QuantumLedger Lab: scan for quantum-vulnerable cryptography" }),
      h("p", { class: "eyebrow", text: "Proof Chain · ML-DSA-65 signed · SHA3-256 chained" }),
      count,
      h(
        "p",
        { class: "lede", id: "chain-sub" },
        "signed entries in this server's Proof Chain. Every scan run here is appended as a ",
        h("code", { text: "lab-run" }),
        " entry: a code-scan record with no TLS transcript, never handshake evidence.",
      ),
      head ? h("p", { class: "hash" }, `head #${head.id} · ${head.hash}`) : null,
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
          h("span", { class: "key", text: "N" }),
        ),
        h(
          "button",
          { class: "btn", type: "button", onclick: (e) => verify(e.currentTarget) },
          "Verify chain",
        ),
      ),
      verifyOut,
    ),
    h(
      "section",
      { class: "c-start-9" },
      h("p", { class: "eyebrow", text: `Workspace ${ctx.ws}` }),
      runs.length
        ? h("p", { class: "big-muted", text: `${runs.length} run${runs.length === 1 ? "" : "s"}` })
        : null,
      runList,
    ),
  );
  return { el, crumbs: ["Lab"], keys: { n: () => ctx.go(href("input", {}, { ws: ctx.ws })) } };
}
