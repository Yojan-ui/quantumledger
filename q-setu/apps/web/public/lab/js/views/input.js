// Input: paste, upload, host, Sample data, plan parameters; live parse preview from /api/lab/validate.
// Client checks mirror the server limits (fetched from /api/lab/health); the server stays the source of truth
// and its `fields` errors render next to the field they belong to. Primary action: Run scan.
import { h, put } from "../dom.js";
import { bytes, short } from "../fmt.js";
import { href } from "../router.js";

export async function view(ctx) {
  const [health, samples] = await Promise.all([
    ctx.store.get("health", "/api/lab/health"),
    ctx.store.get("samples", "/api/lab/samples"),
  ]);
  const L = health.limits;
  const state = {
    paste: { name: "", text: "" },
    uploads: [],
    samples: [],
    url: "",
    probeLive: false,
    lifetime: L.lifetimeYears.default,
    hybridPq: false,
  };
  const errs = new Map(); // ui key -> message

  // spec order defines server field paths (inputs.<i>.*); keep the mapping back to UI keys
  function specs() {
    const out = [];
    if (state.paste.text)
      out.push([
        { kind: "paste", name: state.paste.name || undefined, text: state.paste.text },
        "paste",
      ]);
    state.uploads.forEach((u) => out.push([{ kind: "upload", id: u.id }, `upload:${u.id}`]));
    state.samples.forEach((id) => out.push([{ kind: "sample", id }, `sample:${id}`]));
    if (state.url.trim())
      out.push([{ kind: "url", url: state.url.trim(), probeLive: state.probeLive }, "url"]);
    return out;
  }
  const body = () => ({
    inputs: specs().map(([s]) => s),
    dataLifetimeYears: Number(state.lifetime),
    hybridPq: state.hybridPq || undefined,
  });

  function applyFields(fields) {
    errs.clear();
    const keys = specs().map(([, k]) => k);
    for (const [path, msg] of Object.entries(fields || {})) {
      const m = /^inputs\.(\d+)/.exec(path);
      if (m && keys[Number(m[1])]) errs.set(keys[Number(m[1])], msg);
      else if (path === "dataLifetimeYears") errs.set("lifetime", msg);
      else errs.set("inputs", msg);
    }
    paint();
  }

  // ---- fields ----
  const errFor = (key) =>
    errs.get(key) ? h("p", { class: "field-error", role: "alert", text: errs.get(key) }) : null;
  const pasteText = h("textarea", {
    class: "textarea",
    id: "paste-text",
    spellcheck: "false",
    "aria-describedby": "paste-hint",
    placeholder:
      "Paste source code, a config file, a PEM certificate or `openssl x509 -text` output",
    oninput: (e) => {
      state.paste.text = e.target.value;
      schedule();
    },
  });
  const pasteName = h("input", {
    class: "input",
    id: "paste-name",
    maxlength: L.nameChars,
    placeholder: "filename, e.g. application.properties",
    oninput: (e) => {
      state.paste.name = e.target.value;
      schedule();
    },
  });
  const fileInput = h("input", {
    type: "file",
    multiple: true,
    class: "sr",
    id: "file-input",
    onchange: (e) => upload([...e.target.files]),
  });
  const drop = h(
    "label",
    { class: "dropzone", for: "file-input", tabindex: "-1" },
    h(
      "span",
      {},
      h("b", { text: "Drop files" }),
      " or choose them",
      h("br"),
      h("span", {
        class: "hint",
        text: `text only · ≤ ${L.fileBytes / 1024} KB each · ≤ ${L.files} files · ≤ ${L.totalBytes / 1048576} MB total`,
      }),
    ),
  );
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.setAttribute("data-over", "");
  });
  drop.addEventListener("dragleave", () => drop.removeAttribute("data-over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.removeAttribute("data-over");
    upload([...e.dataTransfer.files]);
  });
  const urlInput = h("input", {
    class: "input",
    id: "url",
    maxlength: L.urlChars,
    placeholder: health.offline
      ? "one of the cached real scans, e.g. ecc256.badssl.com"
      : "host or https:// URL",
    oninput: (e) => {
      state.url = e.target.value;
      schedule();
    },
  });
  const live = h("input", {
    type: "checkbox",
    id: "probe-live",
    onchange: (e) => {
      state.probeLive = e.target.checked;
      schedule();
    },
  });
  const lifetime = h("input", {
    class: "input",
    id: "lifetime",
    type: "number",
    min: L.lifetimeYears.min,
    max: L.lifetimeYears.max,
    step: "1",
    value: String(state.lifetime),
    oninput: (e) => {
      state.lifetime = e.target.value;
      schedule();
    },
  });
  const hybrid = h("input", {
    type: "checkbox",
    id: "hybrid",
    onchange: (e) => {
      state.hybridPq = e.target.checked;
    },
  });

  async function upload(files) {
    if (!files.length) return;
    const local = {};
    if (files.length + state.uploads.length > L.files) local.files = `At most ${L.files} files`;
    files.forEach((f, i) => {
      if (f.size > L.fileBytes) local[`files.${i}`] = `${f.name}: over ${L.fileBytes / 1024} KB`;
    });
    if (Object.keys(local).length) {
      errs.set("files", Object.values(local)[0]);
      paint();
      return;
    }
    const form = new FormData();
    files.forEach((f) => form.append("files", f, f.name));
    errs.delete("files");
    uploading = true;
    paint();
    try {
      const r = await ctx.api.post(`/api/lab/uploads?ws=${ctx.ws}`, form, { quiet: true });
      state.uploads.push(...r.uploads);
    } catch (e) {
      errs.set("files", e.fields ? Object.values(e.fields)[0] : e.message);
    }
    uploading = false;
    fileInput.value = "";
    paint();
    schedule();
  }

  // ---- preview (debounced validate) ----
  let timer = 0,
    seq = 0,
    preview = null,
    checking = false,
    uploading = false,
    running = false;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(validate, 350);
  }
  async function validate() {
    const s = specs();
    if (!s.length) {
      preview = null;
      errs.clear();
      paint();
      return;
    }
    const my = ++seq;
    checking = true;
    paint();
    try {
      const r = await ctx.api.post(
        "/api/lab/validate",
        { ...body(), workspace: ctx.ws },
        { quiet: true },
      );
      if (my !== seq) return;
      preview = r.preview;
      errs.clear();
    } catch (e) {
      if (my !== seq) return;
      preview = null;
      if (e.fields) applyFields(e.fields);
      else errs.set("inputs", e.message);
    }
    checking = false;
    paint();
  }

  async function run() {
    const s = specs();
    if (!s.length) {
      errs.set("inputs", "Add at least one input");
      paint();
      return;
    }
    running = true;
    paint();
    try {
      const r = await ctx.api.post(
        "/api/lab/runs",
        { ...body(), workspace: ctx.ws },
        { quiet: true },
      );
      ctx.store.invalidate(`ws:${ctx.ws}`);
      ctx.go(href("run", { id: r.runId }));
    } catch (e) {
      running = false;
      if (e.status === 409 && e.fields && e.fields.workspace) {
        errs.set("inputs", "A run is already in progress in this workspace.");
        ctx.toast({ title: "Run in progress", message: "Opening the active run." });
        ctx.go(href("run", { id: e.fields.workspace }));
        return;
      }
      if (e.fields) applyFields(e.fields);
      else {
        errs.set("inputs", e.message);
        paint();
      }
    }
  }

  const blobUrls = [];
  function sampleFile(s) {
    const url = URL.createObjectURL(new Blob([s.text], { type: "text/plain" }));
    blobUrls.push(url);
    return h("a", { class: "hint", download: s.filename, href: url, text: "download file" });
  }

  // ---- render ----
  const staged = h("div", { "aria-live": "polite" });
  const errorBox = h("div");
  const runBtn = h(
    "button",
    { class: "btn btn-primary", type: "button", "data-primary": true, onclick: run },
    "Run scan",
    h("span", { class: "key", text: "⌘↵" }),
  );
  const pasteField = h(
    "div",
    { class: "field" },
    h("label", { for: "paste-text", text: "Paste" }),
    pasteText,
    h("p", { class: "hint", id: "paste-hint", text: `≤ ${L.fileBytes / 1024} KB · UTF-8 text` }),
  );
  const nameField = h(
    "div",
    { class: "field" },
    h("label", { for: "paste-name", text: "Filename for the pasted text (optional)" }),
    pasteName,
  );
  const filesField = h(
    "div",
    { class: "field" },
    h("span", { class: "label", text: "Files" }),
    fileInput,
    drop,
  );
  const urlField = h(
    "div",
    { class: "field" },
    h("label", { for: "url", text: "Host or URL" }),
    urlInput,
    h(
      "label",
      { class: "check", for: "probe-live" },
      live,
      h(
        "span",
        {},
        h("b", { text: "Probe live. " }),
        "Off: answers only from cached real scans. On: makes a real TLS connection to the host you entered.",
      ),
    ),
  );
  const lifeField = h(
    "div",
    { class: "field" },
    h("label", { for: "lifetime", text: "Data lifetime (years)" }),
    lifetime,
    h("p", {
      class: "hint",
      text: "How long the protected data must stay confidential. Drives the migration plan.",
    }),
  );
  const hybridField = h(
    "label",
    { class: "check", for: "hybrid" },
    hybrid,
    h("span", { text: "Hybrid post-quantum key exchange already deployed" }),
  );

  function paint() {
    for (const [field, key] of [
      [pasteField, "paste"],
      [filesField, "files"],
      [urlField, "url"],
      [lifeField, "lifetime"],
    ]) {
      const msg =
        errs.get(key) ||
        (key === "files" ? [...errs].find(([k]) => k.startsWith("upload:"))?.[1] : null);
      field.toggleAttribute("data-invalid", !!msg);
      field.querySelector(".field-error")?.remove();
      if (msg) field.append(h("p", { class: "field-error", role: "alert", text: msg }));
    }
    drop.toggleAttribute("data-invalid", errs.has("files"));
    put(errorBox, errFor("inputs"));
    const rows = [];
    state.uploads.forEach((u) =>
      rows.push(
        h(
          "li",
          {},
          h(
            "div",
            {},
            h("b", { text: u.name }),
            h(
              "div",
              { class: "meta" },
              `upload · ${bytes(u.bytes)} · ${u.lines} lines · sha256 ${short(u.sha256)}`,
            ),
          ),
          h(
            "button",
            {
              class: "link-btn",
              type: "button",
              "aria-label": `Remove ${u.name}`,
              onclick: () => {
                state.uploads = state.uploads.filter((x) => x.id !== u.id);
                paint();
                schedule();
              },
            },
            "remove",
          ),
        ),
      ),
    );
    state.samples.forEach((id) => {
      const s = samples.samples.find((x) => x.id === id);
      rows.push(
        h(
          "li",
          {},
          h(
            "div",
            {},
            h("b", { text: s.filename }),
            " ",
            h("span", { class: "chip sample-tag", text: samples.label }),
            h(
              "div",
              { class: "meta" },
              `${s.label} · ${bytes(s.bytes)} · sha256 ${short(s.sha256)}`,
            ),
          ),
          h(
            "button",
            {
              class: "link-btn",
              type: "button",
              "aria-label": `Remove ${s.filename}`,
              onclick: () => {
                state.samples = state.samples.filter((x) => x !== id);
                paint();
                schedule();
              },
            },
            "remove",
          ),
        ),
      );
    });
    const pv = preview
      ? h(
          "div",
          { class: "section" },
          h("p", { class: "eyebrow", text: `Parse preview · ${preview.length} input(s)` }),
          h(
            "ul",
            { class: "list" },
            preview.map((p) =>
              h(
                "li",
                {},
                h(
                  "div",
                  {},
                  h("b", { text: p.name }),
                  h(
                    "div",
                    { class: "meta" },
                    p.source === "url"
                      ? `host · ${p.probeLive ? "live probe" : "cached real scan only"}`
                      : `${p.source} · ${bytes(p.bytes)} · ${p.lines} lines · sha256 ${short(p.sha256)}`,
                  ),
                  p.head && p.head.length
                    ? h("pre", { class: "code", text: p.head.join("\n") })
                    : null,
                ),
              ),
            ),
          ),
        )
      : null;
    put(
      staged,
      rows.length ? h("ul", { class: "list" }, rows) : null,
      checking ? h("p", { class: "hint", text: "Checking inputs…" }) : null,
      uploading ? h("p", { class: "hint", text: "Uploading…" }) : null,
      pv,
    );
    runBtn.toggleAttribute("disabled", running || uploading || !specs().length);
    runBtn.firstChild.textContent = running ? "Starting run…" : "Run scan";
  }

  const sampleList = h(
    "ul",
    { class: "list" },
    samples.samples.map((s) =>
      h(
        "li",
        {},
        h(
          "div",
          {},
          h("b", { text: s.label }),
          h("div", { class: "meta" }, `${s.filename} · ${bytes(s.bytes)} · `, sampleFile(s)),
        ),
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: () => {
              if (!state.samples.includes(s.id)) state.samples.push(s.id);
              paint();
              schedule();
            },
          },
          "Add",
        ),
      ),
    ),
  );

  const el = h(
    "div",
    { class: "page enter" },
    h(
      "section",
      { class: "c-12" },
      h("p", { class: "eyebrow", text: "New scan" }),
      h("h1", { text: "What should be checked for quantum-vulnerable cryptography?" }),
    ),
    h("section", { class: "c-7" }, pasteField, nameField, filesField, urlField),
    h(
      "aside",
      { class: "c-start-8" },
      h(
        "div",
        { class: "section" },
        h(
          "p",
          { class: "eyebrow" },
          h("span", { class: "chip sample-tag", text: samples.label }),
          " real scanner samples",
        ),
        sampleList,
      ),
      h("div", { class: "section" }, lifeField, hybridField),
      h(
        "div",
        { class: "section" },
        h("p", { class: "eyebrow", text: "Staged inputs" }),
        staged,
        errorBox,
        h("div", { class: "actions" }, runBtn),
        h("p", {
          class: "hint",
          text: "One run at a time per workspace. A run scans each input, builds the migration plan, signs a lab-run Proof Chain entry and verifies the chain.",
        }),
      ),
    ),
  );
  paint();
  return {
    el,
    crumbs: ["Lab", "New scan"],
    keys: { "mod+enter": run },
    dispose: () => {
      clearTimeout(timer);
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    },
  };
}
