// Off-main-thread scene prep: scene JSON in, typed arrays out (transferred, not copied).
import { buildLattice, transferables } from "./layout.js";

self.onmessage = (e) => {
  try {
    const L = buildLattice(e.data);
    self.postMessage({ ok: true, L }, transferables(L));
  } catch (err) {
    self.postMessage({ ok: false, message: String(err && err.message) });
  }
};
