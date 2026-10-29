// Routes: 6 screens, all deep-linkable under /lab. Params are validated by pattern (run ids are 16 hex).
export const ROUTES = [
  { name: "landing", path: "/lab", title: "Lab" },
  { name: "input", path: "/lab/input", title: "New scan" },
  { name: "run", path: "/lab/runs/:id", title: "Run" },
  { name: "results", path: "/lab/runs/:id/results", title: "Results" },
  { name: "finding", path: "/lab/runs/:id/findings/:file/:n", title: "Finding" },
  { name: "evidence", path: "/lab/runs/:id/evidence", title: "Evidence" },
];
const PARAM = { id: /^[a-f0-9]{16}$/, file: /^\d{1,3}$/, n: /^\d{1,5}$/ };

export function match(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const parts = clean.split("/").filter(Boolean);
  for (const r of ROUTES) {
    const segs = r.path.split("/").filter(Boolean);
    if (segs.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segs.length && ok; i++) {
      if (segs[i].startsWith(":")) {
        const key = segs[i].slice(1);
        const v = decodeURIComponent(parts[i]);
        if (PARAM[key] && !PARAM[key].test(v)) ok = false;
        else params[key] = key === "file" || key === "n" ? Number(v) : v;
      } else if (segs[i] !== parts[i]) ok = false;
    }
    if (ok) return { name: r.name, params, route: r };
  }
  return null;
}

export function href(name, params = {}, query = {}) {
  const r = ROUTES.find((x) => x.name === name);
  if (!r) throw new Error(`unknown route ${name}`);
  const path = r.path.replace(/:(\w+)/g, (_, k) => {
    if (params[k] === undefined) throw new Error(`missing param ${k} for ${name}`);
    return encodeURIComponent(String(params[k]));
  });
  const q = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  return q.toString() ? `${path}?${q}` : path;
}
