// Proof Chain column(s): one slab per entry of /api/lab/chain, oldest at the bottom. Brightness follows the
// last POST /api/ledger/verify answer; a broken or tampered entry is inverted. While a verify call is in flight
// a band sweeps the chain; when it returns the band stops at checked/count (the broken entry, or the head).
// Draw calls: slabs, hash rails, plan ticks, sweep band = 4.
import { clamp01, easeOutCubic, MOTION } from "../motion.js";
import { buildChain, CHAIN, chainIndex, chainPos, planTicks } from "./layout.js";
import { shade } from "./materials.js";

export function chainLayer({ THREE, scene: world, colors }, chain, opts = {}) {
  const group = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.05,
  });
  const tickMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
  const railMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const bandMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const band = new THREE.Mesh(boxGeo, bandMat);
  band.scale.set(CHAIN.slabW + 0.7, CHAIN.rowH * 2.2, CHAIN.slabD + 0.7);
  band.visible = false;
  const tmp = new THREE.Color();
  let C = buildChain(chain, null);
  let verify = null,
    selectedId = null,
    steps = null,
    hovered = null;
  let slabs = null,
    rails = null,
    ticks = null,
    T = null;
  let reveal = 1,
    revealMs = 0,
    revealT = 0;
  let sweep = null; // {mode: "loop"|"to", from, to, t0, dur}

  function build() {
    for (const o of [slabs, rails])
      if (o) {
        group.remove(o);
        o.geometry !== boxGeo && o.geometry.dispose();
        o.isInstancedMesh && o.dispose();
      }
    slabs = new THREE.InstancedMesh(boxGeo, slabMat, Math.max(1, C.n));
    slabs.count = Math.floor(C.n * reveal);
    if (C.n) slabs.instanceMatrix.array.set(C.matrices);
    slabs.instanceMatrix.needsUpdate = true;
    slabs.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, C.n) * 3),
      3,
    );
    slabs.computeBoundingSphere();
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(C.rails, 3));
    rails = new THREE.LineSegments(rg, railMat);
    group.add(rails, slabs);
    buildTicks();
    paint();
  }
  function buildTicks() {
    if (ticks) {
      group.remove(ticks);
      ticks.dispose();
      ticks = null;
    }
    const idx = selectedId === null ? -1 : chainIndex(chain, selectedId);
    if (!steps || !steps.length || idx < 0 || idx >= C.n) return;
    T = planTicks(steps, chainPos(idx));
    ticks = new THREE.InstancedMesh(boxGeo, tickMat, steps.length);
    ticks.instanceMatrix.array.set(T.matrices);
    ticks.instanceMatrix.needsUpdate = true;
    ticks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(steps.length * 3), 3);
    ticks.computeBoundingSphere();
    group.add(ticks);
  }
  function paint() {
    const selIdx = selectedId === null ? -1 : chainIndex(chain, selectedId);
    for (let i = 0; i < C.n; i++) {
      let lv = C.levels[i];
      if (selIdx >= 0 && i !== selIdx) lv *= 0.42;
      if (i === selIdx || (hovered && hovered.mesh === slabs && hovered.i === i)) lv = 1;
      slabs.instanceColor.setXYZ(i, ...shade(colors, lv, tmp).toArray());
    }
    slabs.instanceColor.needsUpdate = true;
    railMat.color.copy(shade(colors, 0.26, tmp));
    if (ticks) {
      for (let i = 0; i < T.levels.length; i++)
        ticks.instanceColor.setXYZ(
          i,
          ...shade(
            colors,
            hovered && hovered.mesh === ticks && hovered.i === i ? 1 : T.levels[i],
            tmp,
          ).toArray(),
        );
      ticks.instanceColor.needsUpdate = true;
    }
  }
  // light fog: the far columns of a long chain fade, the near column and the intro crane shot stay legible
  world.fog.density = 0.012;
  group.add(band);
  build();

  // centred on the stack, distance fitted to its height and width, seen slightly from above and the right
  function chainOverview(aspect, fov) {
    const b = C.bounds;
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, 0];
    const halfV = (fov * Math.PI) / 360,
      halfH = Math.atan(Math.tan(halfV) * aspect);
    const d = Math.max(
      ((b.max[1] - b.min[1]) * 0.62) / Math.tan(halfV),
      ((b.max[0] - b.min[0]) * 0.62) / Math.tan(halfH),
      6,
    );
    const dir = [0.42, 0.3, 0.86],
      n = Math.hypot(...dir);
    return { target: c, pos: c.map((v, i) => v + (dir[i] / n) * d) };
  }

  const bandAt = (index) => {
    const [x, y, z] = chainPos(Math.max(0, Math.min(C.n - 1, Math.round(index))));
    band.position.set(x, y + CHAIN.slabH / 2, z);
  };

  function describe(mesh, i) {
    if (mesh === ticks) {
      const s = steps[i];
      return {
        id: `tick:${i}`,
        kind: "step",
        selectable: false,
        lines: [`${s.priority} · ${s.title}`, `effort ${s.effort} · ${s.fixer}`],
      };
    }
    const e = chain.entries[i];
    const broken = C.bad.includes(e.id);
    return {
      id: `entry:${e.id}`,
      kind: "entry",
      entryId: e.id,
      runId: e.runId,
      selectable: !!e.runId,
      lines: [
        `#${e.id} · ${e.kind}${broken ? " · BROKEN" : ""}`,
        e.subject,
        `hash ${e.hash.slice(0, 16)}… · ${new Date(e.at).toISOString().replace("T", " ").slice(0, 19)} UTC`,
        ...(e.runId ? ["code-scan record, not handshake evidence · click to open the run"] : []),
      ],
    };
  }

  return {
    group,
    get chain() {
      return chain;
    },
    update(dt, now, breath) {
      group.scale.setScalar(breath);
      if (reveal < 1) {
        revealT += dt;
        reveal = easeOutCubic(clamp01(revealT / revealMs));
        slabs.count = Math.floor(C.n * reveal);
      }
      if (sweep) {
        const t = (now - sweep.t0) / sweep.dur;
        if (sweep.mode === "loop") bandAt((t % 1) * (C.n - 1));
        else {
          bandAt(sweep.from + (sweep.to - sweep.from) * easeOutCubic(clamp01(t)));
          if (t >= 1 && sweep.hideAfter && t >= 1 + sweep.hideAfter / sweep.dur) {
            band.visible = false;
            sweep = null;
          }
        }
      }
    },
    /** Arrival: slabs appear oldest first over the flight. */
    onArrive(ms) {
      reveal = 0;
      revealT = 0;
      revealMs = ms;
      slabs.count = 0;
    },
    pick(raycaster) {
      const hits = raycaster.intersectObjects(ticks ? [slabs, ticks] : [slabs], false);
      const h = hits.find((x) => x.instanceId !== undefined && x.instanceId < x.object.count);
      return h ? { ...describe(h.object, h.instanceId), mesh: h.object, i: h.instanceId } : null;
    },
    highlight(hit) {
      hovered = hit ? { mesh: hit.mesh, i: hit.i } : null;
      paint();
    },
    select(id) {
      selectedId = id;
      buildTicks();
      paint();
    },
    setPlan(s) {
      steps = s;
      buildTicks();
      paint();
    },
    setChain(next) {
      if (
        next.count === chain.count &&
        next.head?.hash === chain.head?.hash &&
        String(next.tampered) === String(chain.tampered)
      )
        return;
      chain = next;
      C = buildChain(chain, verify);
      build();
    },
    stopSweep() {
      sweep = null;
      band.visible = false;
    },
    /** A verify call started: the band loops over the chain until the answer arrives. */
    verifying(now = performance.now()) {
      band.visible = C.n > 0;
      sweep = { mode: "loop", t0: now, dur: 1200 };
    },
    /** The verify answer: re-shade, then the band runs to checked/count (stays on a broken entry). */
    setVerify(v, now = performance.now()) {
      verify = v;
      C = buildChain(chain, v);
      paint();
      const brokenIdx = v && !v.ok && v.broken ? chainIndex(chain, v.broken.id) : -1;
      const to = brokenIdx >= 0 ? brokenIdx : Math.max(0, C.n - 1);
      band.visible = C.n > 0;
      sweep = {
        mode: "to",
        from: 0,
        to,
        t0: now,
        dur: MOTION.flightMinMs,
        hideAfter: brokenIdx >= 0 ? 0 : MOTION.overlayMs * 2,
      };
    },
    overview: (aspect, fov) => chainOverview(aspect, fov),
    /** High crane shot for the landing intro: straight above the column, looking down. */
    introPose: (aspect, fov) => {
      const o = chainOverview(aspect, fov);
      return { target: o.target, pos: [o.target[0] + 0.5, o.target[1] + 46, o.target[2] + 3] };
    },
    focus(id) {
      const idx = chainIndex(chain, id);
      if (idx < 0 || idx >= C.n) return null;
      const [x, y, z] = chainPos(idx);
      const target = [x + 0.6, y, z];
      return { target, pos: [x + 4.2, y + 2.2, z + 6.2] };
    },
    project(ref) {
      const idx = chainIndex(chain, ref.id);
      if (idx < 0 || idx >= C.n) return null;
      const [x, y, z] = chainPos(idx);
      return [x, y + CHAIN.slabH / 2, z].map((v) => v * group.scale.x);
    },
    retheme(c) {
      colors = c;
      paint();
    },
    dispose() {
      for (const o of [slabs, ticks]) o && o.dispose();
      rails && rails.geometry.dispose();
      for (const m of [slabMat, tickMat, railMat, bandMat]) m.dispose();
      boxGeo.dispose();
    },
  };
}
