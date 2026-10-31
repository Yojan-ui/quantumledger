// Viewer preferences, kept in this browser only: theme (dark default) and UI sound (off default). Storage can
// be unavailable (private mode); every read and write is guarded and the defaults always work.
const get = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: not persisted */
  }
};

export const prefs = {
  get theme() {
    return get("qlab.theme") === "light" ? "light" : "dark";
  },
  set theme(v) {
    set("qlab.theme", v === "light" ? "light" : "dark");
    applyTheme();
  },
  get sound() {
    return get("qlab.sound") === "1";
  },
  set sound(v) {
    set("qlab.sound", v ? "1" : "0");
  },
};

/** html[data-theme]: tokens.css swaps every colour; the 3D world re-reads its tokens on change. */
export function applyTheme() {
  if (prefs.theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
}
