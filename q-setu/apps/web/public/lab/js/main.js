// QuantumLedger Lab bootstrap: workspace, router, views, toasts, keyboard. Plain ES modules, no build step.
import { createApi } from "./api.js";
import { clear, h } from "./dom.js";
import { prefersReducedMotion } from "./motion.js";
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
    if (my === navSeq) clear(main).append(stateView("loading", "Loading…", ""));
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

document.addEventListener("keydown", (e) => {
  if (!current || !current.keys) return;
  const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
  const key = `${e.metaKey || e.ctrlKey ? "mod+" : ""}${e.key.toLowerCase()}`;
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
