// QuantumLedger Lab bootstrap: workspace, router, views, toasts, keyboard. Plain ES modules, no build step.
import { createApi } from "./api.js";
import { clear, h } from "./dom.js";
import { prefersReducedMotion } from "./motion.js";
import { isOpen, openPalette, openShortcuts } from "./palette.js";
import { applyTheme, prefs } from "./prefs.js";
import { play, unlock } from "./sound.js";
import { match, ROUTES } from "./router.js";
import { createStore } from "./store.js";

const main = document.getElementById("main");
const crumbs = document.getElementById("crumbs");
const wsChip = document.getElementById("ws-chip");
const toasts = document.getElementById("toasts");
const announceEl = document.getElementById("announce");
const LOADERS = {
  landing: () => import("./views/landing.js"),
  input: () => import("./views/input.js"),
  run: () => import("./views/run.js"),
  results: () => import("./views/results.js"),
  finding: () => import("./views/finding.js"),
  evidence: () => import("./views/evidence.js"),
};

function toast(err) {
  const title = err.title || (err.code ? err.code.replace(/_/g, " ") : "Error");
  const t = h("div", { class: "toast" }, h("b", { text: title }), err.message);
  toasts.append(t);
  setTimeout(() => t.remove(), 6000);
}
const announce = (text) => {
  announceEl.textContent = "";
  requestAnimationFrame(() => {
    announceEl.textContent = text;
  });
};

const api = createApi({ fetchImpl: (...a) => fetch(...a), onError: (e) => toast(e) });
const store = createStore({ api });

const WS_KEY = "qlab.ws";
const safeLs = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

async function resolveWorkspace() {
  const q = new URLSearchParams(location.search).get("ws");
  for (const cand of [q, safeLs.get(WS_KEY)]) {
    if (!cand || !/^[a-f0-9]{16}$/.test(cand)) continue;
    try {
      await store.get(`ws:${cand}`, `/api/lab/workspaces/${cand}`, { quiet: true });
      safeLs.set(WS_KEY, cand);
      return cand;
    } catch {
      /* unknown: try next */
    }
  }
  const w = await api.post("/api/lab/workspaces", {});
  safeLs.set(WS_KEY, w.id);
  return w.id;
}

let current = null; // { dispose, keys }
// 3D gate: ?no3d (kept for the tab session; ?3d clears it), reduced motion, no WebGL or a lost context all
// give the full 2D version. The engine (and three.js) loads only after the first screen is on, so it never
// delays first paint. html[data-world] = loading | on | off.
const safeSs = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
{
  const q = new URLSearchParams(location.search);
  if (q.has("no3d")) safeSs.set("qlab.no3d", "1");
  if (q.has("3d")) safeSs.set("qlab.no3d", null);
}
const want3d = !safeSs.get("qlab.no3d") && !prefersReducedMotion();
document.documentElement.dataset.world = want3d ? "loading" : "off";
let worldReady = null;
function loadWorld() {
  if (worldReady) return worldReady;
  worldReady = !want3d
    ? Promise.resolve(null)
    : import("./engine/world.js")
        .then((m) =>
          m.createWorld({
            onLost: () => {
              document.documentElement.dataset.world = "off";
              announce("The 3D view stopped (graphics context lost). Showing the 2D view.");
            },
          }),
        )
        .catch(() => null)
        .then((w) => {
          document.documentElement.dataset.world = w ? "on" : "off";
          return w;
        });
  return worldReady;
}
async function syncStage(v, my) {
  const spec = v && v.stage;
  if (!spec && !worldReady) return;
  const w = await loadWorld();
  if (my !== navSeq || !w || w.dead) return;
  if (!spec) return w.detach();
  try {
    await w.attach(spec);
  } catch {
    spec.el.removeAttribute("data-world"); // the 2D map stays
  }
}

let firstRender = true; // on a fresh load the skip link stays first in tab order
let navSeq = 0;
let ws = null;

function go(url, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  render();
}

function stateView(kind, title, message, actions = []) {
  return h(
    "div",
    { class: "page enter" },
    h(
      "section",
      {
        class: `c-8 state${kind === "error" ? " state-error" : ""}`,
        role: kind === "error" ? "alert" : "status",
      },
      h(
        "div",
        { class: kind === "error" ? "inner" : "" },
        h("p", { class: "eyebrow", text: kind }),
        h("h1", { text: title }),
        message ? h("p", { class: "muted mono", text: message }) : null,
        h("div", { class: "actions" }, actions),
      ),
    ),
  );
}

async function render() {
  const my = ++navSeq;
  if (current && current.dispose) {
    try {
      current.dispose();
    } catch {
      /* view cleanup */
    }
  }
  current = null;
  const m = match(location.pathname);
  // the landing and input screens carry the workspace in the URL (deep links survive refresh)
  if (
    m &&
    (m.name === "landing" || m.name === "input") &&
    new URLSearchParams(location.search).get("ws") !== ws
  ) {
    const u = new URL(location.href);
    u.searchParams.set("ws", ws);
    history.replaceState(null, "", u.pathname + u.search);
  }
  wsChip.textContent = `ws ${ws}`;
  if (!m) {
    clear(main).append(
      stateView("not found", "No such screen", `${location.pathname} is not a Lab route.`, [
        h(
          "a",
          { class: "btn btn-primary", href: "/lab", "data-link": true, "data-primary": true },
          "Lab home",
        ),
      ]),
    );
    crumbs.textContent = "Lab / not found";
    document.title = "Not found · QuantumLedger Lab";
    syncStage(null, my);
    return;
  }
  const loading = setTimeout(() => {
    if (my !== navSeq) return;
    // the screen's own title over a hatched bar; aria-busy until the real content replaces it
    const id = m.params.id ? ` · run ${m.params.id}` : "";
    clear(main).append(
      h(
        "div",
        { class: "page", "aria-busy": "true" },
        h(
          "section",
          { class: "c-8", role: "status" },
          h("p", { class: "eyebrow", text: `${m.route.title}${id}` }),
          h("h1", { text: `Loading ${m.route.title.toLowerCase()}…` }),
          h("div", { class: "skeleton-bar" }),
        ),
      ),
    );
  }, 120);
  try {
    const mod = await LOADERS[m.name]();
    const v = await mod.view({
      params: m.params,
      query: Object.fromEntries(new URLSearchParams(location.search)),
      api,
      store,
      go,
      ws,
      toast,
      announce,
    });
    clearTimeout(loading);
    if (my !== navSeq) {
      if (v && v.dispose) v.dispose();
      return;
    }
    if (!v) return; // the view redirected
    clear(main).append(v.el);
    current = v;
    crumbs.textContent = v.crumbs.join(" / ");
    document.title = `${v.crumbs.slice(1).join(" · ") || "Lab"} · QuantumLedger Lab`;
    if (!firstRender) main.focus({ preventScroll: true });
    firstRender = false;
    window.scrollTo(0, 0);
    syncStage(v, my);
  } catch (e) {
    clearTimeout(loading);
    if (my !== navSeq) return;
    clear(main).append(
      stateView(
        "error",
        e.status === 404 ? "Not found" : "Could not load this screen",
        e.message || String(e),
        [
          h(
            "button",
            { class: "btn btn-primary", type: "button", "data-primary": true, onclick: render },
            "Retry",
          ),
          h("a", { class: "btn", href: "/lab", "data-link": true }, "Lab home"),
        ],
      ),
    );
    crumbs.textContent = "Lab / error";
    syncStage(null, my);
  }
}

document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("a[data-link]");
  if (
    !a ||
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  )
    return;
  const u = new URL(a.getAttribute("href"), location.href); // works for SVG <a> too (its .href is not a string)
  if (u.origin !== location.origin || !u.pathname.startsWith("/lab")) return;
  e.preventDefault();
  go(u.pathname + u.search);
});
addEventListener("popstate", render);

// ---------- header controls: command palette, theme, sound ----------
const themeBtn = document.getElementById("theme-btn");
const soundBtn = document.getElementById("sound-btn");
function paintControls() {
  const light = prefs.theme === "light";
  themeBtn.textContent = light ? "Dark" : "Light";
  themeBtn.setAttribute(
    "aria-label",
    light ? "Switch to the dark theme" : "Switch to the light theme",
  );
  soundBtn.textContent = prefs.sound ? "Sound on" : "Sound off";
  soundBtn.setAttribute("aria-pressed", String(prefs.sound));
}
function toggleTheme() {
  prefs.theme = prefs.theme === "light" ? "dark" : "light";
  paintControls();
  announce(`${prefs.theme === "light" ? "Light" : "Dark"} theme`);
}
function toggleSound() {
  prefs.sound = !prefs.sound;
  if (prefs.sound) unlock();
  paintControls();
  announce(prefs.sound ? "Sound on" : "Sound off");
}
themeBtn.addEventListener("click", toggleTheme);
soundBtn.addEventListener("click", toggleSound);
applyTheme();
paintControls();

/** Every command comes from the route and from this workspace's real runs; nothing is invented. */
async function commands() {
  const m = match(location.pathname);
  const id = m && m.params.id;
  const list = [
    {
      id: "home",
      group: "Go",
      title: "Lab home",
      keywords: "landing proof chain",
      run: () => go("/lab"),
    },
    {
      id: "new",
      group: "Go",
      title: "New scan",
      keywords: "input paste upload sample host",
      hint: "N",
      run: () => go(`/lab/input?ws=${ws}`),
    },
  ];
  if (id) {
    list.push(
      {
        id: "results",
        group: "This run",
        title: "Results",
        keywords: id,
        run: () => go(`/lab/runs/${id}/results`),
      },
      {
        id: "evidence",
        group: "This run",
        title: "Evidence and export",
        keywords: `${id} plan ledger`,
        run: () => go(`/lab/runs/${id}/evidence`),
      },
      {
        id: "report",
        group: "This run",
        title: "Open printable report",
        keywords: "print pdf html",
        run: () =>
          window.open(`/api/lab/runs/${id}/export?format=report&inline=1`, "_blank", "noopener"),
      },
      ...["json", "csv", "cbom", "plan", "report"].map((f) => ({
        id: `dl-${f}`,
        group: "This run",
        title: `Download ${{ json: "JSON", csv: "findings CSV", cbom: "CBOM (CycloneDX 1.6)", plan: "plan (Markdown)", report: "report (HTML)" }[f]}`,
        keywords: "export download",
        run: () => {
          const a = h("a", { href: `/api/lab/runs/${id}/export?format=${f}`, download: "" });
          document.body.append(a);
          a.click();
          a.remove();
        },
      })),
    );
  }
  try {
    const w = await store.get(`ws:${ws}`, `/api/lab/workspaces/${ws}`, { quiet: true });
    for (const r of (w.runs || []).slice(0, 8)) {
      if (r.runId === id) continue;
      list.push({
        id: `run-${r.runId}`,
        group: "Runs",
        title: `${r.status === "done" ? "Results" : "Run"} · ${r.inputs.map((i) => i.name).join(", ")}`,
        keywords: `${r.runId} ${r.status}`,
        run: () => go(`/lab/runs/${r.runId}${r.status === "done" ? "/results" : ""}`),
      });
    }
  } catch {
    /* workspace list unavailable: navigation commands still work */
  }
  list.push(
    {
      id: "verify",
      group: "Proof Chain",
      title: "Verify the Proof Chain now",
      keywords: "ledger ml-dsa sha3 check",
      run: verifyChain,
    },
    {
      id: "theme",
      group: "Settings",
      title: prefs.theme === "light" ? "Dark theme" : "Light theme",
      keywords: "theme colour mode",
      run: toggleTheme,
    },
    {
      id: "sound",
      group: "Settings",
      title: prefs.sound ? "Turn sound off" : "Turn sound on",
      keywords: "audio",
      run: toggleSound,
    },
    {
      id: "3d",
      group: "Settings",
      title:
        document.documentElement.dataset.world === "off" ? "Turn 3D on" : "Turn 3D off (2D view)",
      keywords: "webgl no3d 2d accessibility",
      run: () => {
        location.href = `${location.pathname}?${want3d ? "no3d" : "3d"}`;
      },
    }, // reload: the 3D gate is decided at boot
    {
      id: "keys",
      group: "Help",
      title: "Keyboard shortcuts",
      keywords: "help keys",
      hint: "?",
      run: openShortcuts,
    },
  );
  return list;
}
async function verifyChain() {
  try {
    const v = await api.post("/api/ledger/verify");
    play(v.ok ? "verified" : "broken");
    const msg = v.ok
      ? `${v.checked} entries verified in ${v.ms.toFixed(1)} ms`
      : `Broken at #${v.broken.id}: ${v.broken.detail || v.broken.reason}`;
    toast({ title: v.ok ? "Proof Chain verified" : "Proof Chain broken", message: msg });
    announce(msg);
  } catch {
    /* the api layer already showed the error */
  }
}
async function showPalette() {
  if (isOpen()) return;
  openPalette(await commands());
}
document.getElementById("palette-btn").addEventListener("click", showPalette);

document.addEventListener("keydown", (e) => {
  if (isOpen()) return; // the dialog handles its own keys
  const key = `${e.metaKey || e.ctrlKey ? "mod+" : ""}${e.key.toLowerCase()}`;
  const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
  if (key === "mod+k") {
    e.preventDefault();
    showPalette();
    return;
  }
  if (key === "?" && !typing) {
    e.preventDefault();
    openShortcuts();
    return;
  }
  if (!current || !current.keys) return;
  if (typing && key !== "mod+enter" && key !== "escape") return;
  const fn = current.keys[key];
  if (fn) {
    e.preventDefault();
    fn();
  }
});

(async () => {
  try {
    ws = await resolveWorkspace();
  } catch (e) {
    clear(main).append(
      stateView("error", "Cannot reach the QuantumLedger server", e.message, [
        h(
          "button",
          { class: "btn btn-primary", type: "button", onclick: () => location.reload() },
          "Retry",
        ),
      ]),
    );
    return;
  }
  render();
})();

export { ROUTES };
