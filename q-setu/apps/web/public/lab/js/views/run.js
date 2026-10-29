// Run (live): stages, progress (finished units / total units), per-input results and log, all from the run
// state and its SSE stream. Primary action: Cancel run, then Open results.
import { h, put } from "../dom.js";
import { gradeClass, ms, short, when } from "../fmt.js";
import { rollNumber } from "../motion.js";
import { href } from "../router.js";
import { runStage } from "../scenes/lattice.js";

const STAGE_LABEL = {
  validate: "Validate",
  scan: "Scan",
  plan: "Plan",
  sign: "Sign",
  verify: "Verify",
};

export async function view(ctx) {
  const id = ctx.params.id;
  const run = await ctx.api.get(`/api/lab/runs/${id}`);
  const st = {
    status: run.status,
    stages: run.stages.map((s) => ({ ...s })),
    progress: { ...run.progress },
    files: run.files.map((f) => ({
      name: f.name,
      score: f.score,
      grade: f.grade,
      findings: f.findings,
    })),
    url: null,
    log: [...run.log],
    error: run.error,
    durationMs: run.durationMs,
  };
  const terminal = () => ["done", "failed", "cancelled"].includes(st.status);

  const done = h("span"),
    total = h("span");
  const bar = h("i");
  const stagesEl = h("ol", { class: "stages", "aria-label": "Run stages" });
  const filesEl = h("ul", { class: "list", "aria-label": "Results so far" });
  const logEl = h("ol", { class: "log", "aria-label": "Run log" });
  const statusEl = h("p", { class: "eyebrow" });
  const actions = h("div", { class: "actions" });

  async function cancel(btn) {
    btn.setAttribute("aria-disabled", "true");
    try {
      await ctx.api.post(`/api/lab/runs/${id}/cancel`, {}, { quiet: true });
      ctx.announce("Cancelling the run");
    } catch (e) {
      if (e.status !== 409) ctx.toast(e);
    }
  }

  function paint() {
    rollNumber(done, st.progress.done);
    total.textContent = String(st.progress.total);
    bar.style.width = `${st.progress.total ? (100 * st.progress.done) / st.progress.total : 0}%`;
    statusEl.textContent = `Run ${id} · ${st.status}${st.durationMs ? ` · ${ms(st.durationMs)}` : ""}`;
    stagesEl.replaceChildren(
      ...st.stages.map((s) =>
        h(
          "li",
          { "data-status": s.status },
          STAGE_LABEL[s.name],
          h("span", {
            class: "ms",
            text: s.status === "done" || s.status === "failed" ? ms(s.ms) : s.status,
          }),
        ),
      ),
    );
    put(
      filesEl,
      ...st.files.map((f) =>
        h(
          "li",
          {},
          h(
            "div",
            {},
            h("b", { text: f.name }),
            h("div", { class: "meta" }, `${f.findings} finding(s)`),
          ),
          h("span", { class: gradeClass(f.grade), text: `${f.score} · ${f.grade}` }),
        ),
      ),
      ...(st.url
        ? [
            h(
              "li",
              {},
              h(
                "div",
                {},
                h("b", { text: st.url.host }),
                h(
                  "div",
                  { class: "meta" },
                  st.url.mode === "live" ? "live TLS probe" : "cached real scan",
                ),
              ),
              h("span", {
                class: gradeClass(st.url.grade),
                text: `${st.url.score} · ${st.url.grade}`,
              }),
            ),
          ]
        : []),
    );
    logEl.replaceChildren(
      ...st.log.slice(-60).map((l) => h("li", {}, h("b", { text: `${l.stage} ` }), l.message)),
    );
    logEl.scrollTop = logEl.scrollHeight;
    if (terminal()) {
      put(
        actions,
        st.status === "done"
          ? h(
              "a",
              {
                class: "btn btn-primary",
                href: href("results", { id }),
                "data-link": true,
                "data-primary": true,
              },
              "Open results",
              h("span", { class: "key", text: "↵" }),
            )
          : null,
        h(
          "a",
          {
            class: st.status === "done" ? "btn" : "btn btn-primary",
            href: href("input", {}, { ws: ctx.ws }),
            "data-link": true,
            "data-primary": st.status !== "done" || undefined,
          },
          "New scan",
        ),
        st.error ? h("p", { class: "field-error", role: "alert", text: st.error.message }) : null,
      );
    } else {
      actions.replaceChildren(
        h(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            "data-primary": true,
            onclick: (e) => cancel(e.currentTarget),
          },
          "Cancel run",
          h("span", { class: "key", text: "Esc" }),
        ),
      );
    }
  }

  // the live map moves only on these real events (stage, file, url, ledger, result / cancelled / error)
  const live = runStage(ctx, run);
  const close = ctx.store.runStream(id, ({ type, data }) => {
    live.on(type, data);
    if (type === "status") st.status = data.status;
    else if (type === "stage") {
      const s = st.stages.find((x) => x.name === data.name);
      if (s) {
        s.status = data.status;
        if (data.ms !== undefined) s.ms = data.ms;
      }
      if (data.status === "done") ctx.announce(`${STAGE_LABEL[data.name]} done`);
    } else if (type === "progress") st.progress = data;
    else if (type === "log") {
      if (!st.log.some((l) => l.t === data.t && l.message === data.message)) st.log.push(data);
    } else if (type === "file") {
      if (!st.files.some((f) => f.name === data.name))
        st.files.push({
          name: data.name,
          score: data.score,
          grade: data.grade,
          findings: data.findings,
        });
      ctx.announce(`${data.name}: ${data.grade}, score ${data.score}`);
    } else if (type === "url") st.url = data;
    else if (type === "result" || type === "error" || type === "cancelled") {
      st.status = data.status;
      st.durationMs = data.durationMs;
      if (data.error) st.error = data.error;
      ctx.announce(
        type === "result"
          ? "Run finished. Results are ready."
          : type === "cancelled"
            ? "Run cancelled"
            : `Run failed: ${data.error?.message ?? ""}`,
      );
    }
    paint();
  });

  const el = h(
    "div",
    { class: "page enter" },
    h(
      "section",
      { class: "c-7" },
      statusEl,
      h("h1", { class: "sr", text: `Run ${id}` }),
      h(
        "p",
        { class: "hero", "aria-label": "Units finished" },
        done,
        " ",
        h("span", { class: "big-muted" }, "/ ", total),
      ),
      h(
        "div",
        {
          class: "bar",
          role: "progressbar",
          "aria-label": "Run progress",
          "aria-valuemin": "0",
          "aria-valuemax": String(st.progress.total),
        },
        bar,
      ),
      h("p", {
        class: "lede",
        text: "units finished: one per input, then plan, sign and verify. Nothing here is timed or estimated; each step is a real call.",
      }),
      actions,
    ),
    h(
      "section",
      { class: "c-start-8" },
      h("p", { class: "eyebrow", text: "Inputs" }),
      h(
        "ul",
        { class: "list" },
        run.inputs.map((i) =>
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
                `${i.source}${i.sampleLabel ? " · Sample data" : ""} · sha256 ${short(i.sha256)}`,
              ),
            ),
          ),
        ),
      ),
      h("p", { class: "hash" }, `input SHA-256 ${run.inputSha256}`),
      h("p", { class: "hint", text: `started ${when(run.startedAt)}` }),
    ),
    h("section", { class: "c-12" }, stagesEl),
    h(
      "section",
      { class: "c-12" },
      h("p", { class: "eyebrow", text: "Live map · moves only on the run's own events" }),
      live.el,
      live.legend,
    ),
    h(
      "section",
      { class: "c-6" },
      h("p", { class: "eyebrow", text: "Results as they arrive" }),
      filesEl,
    ),
    h("section", { class: "c-6" }, h("p", { class: "eyebrow", text: "Log" }), logEl),
  );
  paint();
  return {
    el,
    crumbs: ["Lab", "Run", id],
    dispose: close,
    stage: live.spec,
    keys: {
      escape: () => {
        const b = actions.querySelector("button.btn-primary");
        if (b) b.click();
      },
      enter: () => {
        if (st.status === "done") ctx.go(href("results", { id }));
      },
    },
  };
}
