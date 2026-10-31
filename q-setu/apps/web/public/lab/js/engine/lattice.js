// Source lattice + finding pillars + score gauges (data: /api/lab/runs/:id/scene, or a live partial scene built
// from the run's SSE `file` events). Draw calls: cells, rails, solid pillars, safe-pillar edges, gauge fill,
// gauge base, gauge frames (+ sweep plane and seal frame on the live run) = 7-9.
import { MOTION } from "../motion.js";
import { boxEdges, buildLattice, focusPose, GEOM, LEVEL, overviewPose } from "./layout.js";
import { growStandard, shade } from "./materials.js";

/** Scene JSON -> typed arrays in a module worker (transferred); inline if workers are unavailable. */
export function prepLattice(scene) {
  if (typeof Worker !== "function") return Promise.resolve(buildLattice(scene));
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./prep.worker.js", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      w.terminate();
      e.data.ok ? resolve(e.data.L) : reject(new Error(e.data.message));
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || "scene prep failed"));
    };
    w.postMessage(scene);
  });
}

/**
 * opts.live: pending files (score null) are dim until their `file` event; opts.linkable(hit): may this finding
 * be opened (false while a run is still going).
 */
export function latticeLayer({ THREE, scene: world, colors }, scene, L, opts = {}) {
  const group = new THREE.Group();
  const t0 = performance.now();
  const tNow = () => performance.now() - t0;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const tmp = new THREE.Color();
  const grow = growStandard(THREE, { color: 0xffffff, roughness: 0.48, metalness: 0.06 });
  const growGauge = growStandard(THREE, { color: 0xffffff, roughness: 0.7, metalness: 0 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const cellMat = new THREE.PointsMaterial({
    size: 0.09,
    sizeAttenuation: true,
    vertexColors: true,
  });
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true });
  const flatMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const frameMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const born = new Map(); // file index -> ms when its findings arrived (0 = from the start)
  const isScanned = (f) => typeof f.score === "number";
  scene.files.forEach((f, fi) => {
    if (isScanned(f)) born.set(fi, opts.live ? tNow() : 0);
  });

  let parts = null; // rebuilt objects
  let hovered = null,
    selected = null;
  let sweep = null,
    sweepX = 0,
    sweepTo = 0,
    sealLevel = null;

  function instanced(matrices, material, count, geo = boxGeo) {
    const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, count));
    mesh.count = count;
    if (count) mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }
  function lines(positions, material, colorsPerVertex = false) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (colorsPerVertex)
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(positions.length), 3));
    return new THREE.LineSegments(geo, material);
  }

  function build() {
    if (parts) {
      for (const o of parts.objects) {
        group.remove(o);
        if (o.geometry !== boxGeo) o.geometry.dispose();
        if (o.isInstancedMesh) o.dispose();
      }
    }
    const cellGeo = new THREE.BufferGeometry();
    cellGeo.setAttribute("position", new THREE.BufferAttribute(L.cells, 3));
    cellGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(L.cells.length), 3));
    const cells = new THREE.Points(cellGeo, cellMat);
    const railPos = new Float32Array(scene.files.length * 6);
    scene.files.forEach((f, fi) =>
      railPos.set(
        [fi * GEOM.fileGap, 0, 0, fi * GEOM.fileGap, 0, (f.lines || 1) * L.zPerLine],
        fi * 6,
      ),
    );
    const rails = lines(railPos, lineMat, true);
    const bornAttr = new Float32Array(Math.max(1, L.solid.levels.length));
    for (let i = 0; i < L.solid.levels.length; i++)
      bornAttr[i] = born.get(L.solid.ref[i * 2]) ?? 1e9;
    const solidGeo = boxGeo.clone();
    solidGeo.setAttribute("aBorn", new THREE.InstancedBufferAttribute(bornAttr, 1));
    const solid = instanced(L.solid.matrices, grow.material, L.solid.levels.length, solidGeo);
    solid.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, L.solid.levels.length) * 3),
      3,
    );
    const wireEdges = lines(L.wire.edges, lineMat, true);
    const wirePick = instanced(L.wire.matrices, hidden, L.wire.levels.length);
    const nF = scene.files.length;
    const fillGeo = boxGeo.clone();
    fillGeo.setAttribute(
      "aBorn",
      new THREE.InstancedBufferAttribute(
        Float32Array.from({ length: Math.max(1, nF) }, (_, fi) => born.get(fi) ?? 1e9),
        1,
      ),
    );
    const fill = instanced(L.gaugeFill, growGauge.material, nF, fillGeo);
    fill.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, nF) * 3),
      3,
    );
    const base = instanced(L.gaugeBase, baseMat, nF);
    base.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, nF) * 3),
      3,
    );
    const frames = lines(L.gaugeFrames, flatMat);
    const pick = instanced(L.gaugePick, hidden, nF);
    const objects = [cells, rails, solid, wireEdges, wirePick, fill, base, frames, pick];
    let seal = null;
    if (opts.live) {
      const sweepMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
          toneMapped: false,
        }),
      );
      const depth = L.bounds.max[2] - L.bounds.min[2];
      sweepMesh.scale.set(depth, 3.6, 1);
      sweepMesh.rotation.y = Math.PI / 2;
      sweepMesh.position.set(sweepX, 1.8, (L.bounds.max[2] + L.bounds.min[2]) / 2);
      sweepMesh.visible = sweep !== null;
      const sp = new Float32Array(72);
      const b = L.bounds;
      boxEdges(
        sp,
        0,
        (b.min[0] + b.max[0]) / 2,
        (b.min[2] + b.max[2]) / 2,
        b.max[0] - b.min[0] + 0.6,
        b.max[1] + 0.4,
        b.max[2] - b.min[2] + 0.6,
      );
      seal = lines(sp, frameMat);
      seal.visible = sealLevel !== null;
      objects.push(sweepMesh, seal);
      parts = {
        objects,
        cells,
        rails,
        solid,
        wireEdges,
        wirePick,
        fill,
        base,
        frames,
        pick,
        sweepMesh,
        seal,
      };
    } else parts = { objects, cells, rails, solid, wireEdges, wirePick, fill, base, frames, pick };
    for (const o of objects) group.add(o);
    paint();
  }

  function paint() {
    const p = parts;
    const pending = (fi) => !isScanned(scene.files[fi]);
    const cc = p.cells.geometry.attributes.color;
    for (let i = 0; i < L.cellFile.length; i++)
      cc.setXYZ(i, ...shade(colors, pending(L.cellFile[i]) ? 0.16 : 0.34, tmp).toArray());
    cc.needsUpdate = true;
    const rc = p.rails.geometry.attributes.color;
    for (let fi = 0; fi < scene.files.length; fi++)
      for (const v of [0, 1])
        rc.setXYZ(fi * 2 + v, ...shade(colors, pending(fi) ? 0.14 : 0.24, tmp).toArray());
    rc.needsUpdate = true;
    const sel = (fi, n) => selected && selected.fi === fi && selected.n === n;
    const lv = (base, mesh, i, fi, n) => {
      if (sel(fi, n) || (hovered && hovered.mesh === mesh && hovered.i === i)) return 1;
      return selected ? base * 0.45 : base;
    };
    for (let i = 0; i < L.solid.levels.length; i++) {
      const fi = L.solid.ref[i * 2],
        n = L.solid.ref[i * 2 + 1];
      p.solid.instanceColor.setXYZ(
        i,
        ...shade(colors, lv(L.solid.levels[i], p.solid, i, fi, n), tmp).toArray(),
      );
    }
    p.solid.instanceColor.needsUpdate = true;
    const wc = p.wireEdges.geometry.attributes.color;
    for (let i = 0; i < L.wire.levels.length; i++) {
      const c = shade(
        colors,
        lv(L.wire.levels[i], p.wirePick, i, L.wire.ref[i * 2], L.wire.ref[i * 2 + 1]),
        tmp,
      ).toArray();
      for (let v = 0; v < 24; v++) wc.setXYZ(i * 24 + v, ...c);
    }
    wc.needsUpdate = true;
    for (let fi = 0; fi < scene.files.length; fi++) {
      const hot = hovered && hovered.mesh === p.pick && hovered.i === fi;
      p.fill.instanceColor.setXYZ(fi, ...shade(colors, hot ? 1 : 0.62, tmp).toArray());
      p.base.instanceColor.setXYZ(
        fi,
        ...shade(colors, hot ? 1 : pending(fi) ? 0.3 : 0.9, tmp).toArray(),
      );
    }
    p.fill.instanceColor.needsUpdate = true;
    p.base.instanceColor.needsUpdate = true;
    p.frames.material.color.copy(shade(colors, 0.3, tmp));
    if (p.seal) p.seal.material.color.copy(shade(colors, sealLevel ?? 0, tmp));
  }

  // fog scales with the lattice so the far end fades but nothing near is lost
  const span = Math.hypot(L.bounds.max[0] - L.bounds.min[0], L.bounds.max[2] - L.bounds.min[2]);
  world.fog.density = 1.1 / Math.max(20, span * 2.2);
  build();

  function describe(mesh, i) {
    if (mesh === parts.pick) {
      const f = scene.files[i];
      return {
        id: `file:${i}`,
        kind: "file",
        fi: i,
        selectable: false,
        lines: [
          f.name,
          isScanned(f) ? `score ${f.score} / 100 · ${f.grade}` : "not scanned yet",
          `${f.lines} lines${f.findings ? ` · ${f.findings.length} finding(s)` : ""}`,
        ],
      };
    }
    const pack = mesh === parts.solid ? L.solid : L.wire;
    const fi = pack.ref[i * 2],
      n = pack.ref[i * 2 + 1];
    const f = scene.files[fi],
      x = f.findings.find((y) => (y.n ?? -1) === n) || f.findings[n];
    const q = x.quantumSafe
      ? "quantum-safe"
      : x.quantumVulnerable
        ? "quantum-vulnerable"
        : x.quantumVulnerable === false
          ? "not quantum-safe"
          : "";
    const hit = {
      id: `f:${fi}:${n}`,
      kind: "finding",
      fi,
      n,
      lines: [
        `${f.name}:${x.line}`,
        [x.severity, x.algorithm].filter(Boolean).join(" · "),
        [x.ruleId, `weight ${x.weight}`, q].filter(Boolean).join(" · "),
      ],
    };
    hit.selectable = opts.linkable ? opts.linkable(hit) : true;
    return hit;
  }

  return {
    group,
    get L() {
      return L;
    },
    update(dt, _now, breath) {
      grow.uNow.value = growGauge.uNow.value = tNow();
      group.scale.setScalar(breath);
      if (parts.sweepMesh) {
        sweepX += (sweepTo - sweepX) * Math.min(1, dt / (MOTION.overlayMs / 4));
        parts.sweepMesh.position.x = sweepX;
        parts.sweepMesh.visible = sweep !== null;
      }
    },
    pick(raycaster) {
      const hits = raycaster.intersectObjects([parts.solid, parts.wirePick, parts.pick], false);
      const h = hits.find((x) => x.instanceId !== undefined && x.instanceId < x.object.count);
      return h ? { ...describe(h.object, h.instanceId), mesh: h.object, i: h.instanceId } : null;
    },
    highlight(hit) {
      hovered = hit ? { mesh: hit.mesh, i: hit.i } : null;
      paint();
    },
    select(ref) {
      selected = ref;
      paint();
    },
    overview: (aspect, fov) => overviewPose(L.bounds, fov, aspect),
    focus: (fi, n) => focusPose(L, L.offsets[fi] + n),
    project(ref) {
      const g = L.offsets[ref.fi] + ref.n;
      if (!(g >= 0 && g * 4 < L.focus.length)) return null;
      const s = group.scale;
      return [L.focus[g * 4] * s.x, L.focus[g * 4 + 1] * 0.5 * s.y, L.focus[g * 4 + 2] * s.z];
    },
    /** Live run: a new partial scene (after a `file` event). Files that just got a score start growing now. */
    setScene(next) {
      next.files.forEach((f, fi) => {
        if (isScanned(f) && !born.has(fi)) born.set(fi, tNow());
      });
      scene = next;
      L = buildLattice(next);
      build();
    },
    /** Sweep plane over file `fi` (scan in progress), or null. */
    setSweep(fi) {
      if (fi === null) {
        sweep = null;
        return;
      }
      if (sweep === null) sweepX = fi * GEOM.fileGap;
      sweep = fi;
      sweepTo = fi * GEOM.fileGap;
    },
    /** Seal frame around the lattice: null = none, else a grey level (signed 0.5, verified 1, failed 0.2). */
    setSeal(level) {
      sealLevel = level;
      if (parts.seal) parts.seal.visible = level !== null;
      paint();
    },
    retheme(c) {
      colors = c;
      paint();
    },
    dispose() {
      for (const o of parts.objects) {
        if (o.geometry !== boxGeo) o.geometry.dispose();
        if (o.isInstancedMesh) o.dispose();
      }
      for (const m of [
        grow.material,
        growGauge.material,
        baseMat,
        hidden,
        cellMat,
        lineMat,
        flatMat,
        frameMat,
      ])
        m.dispose();
      boxGeo.dispose();
    },
  };
}

export { LEVEL };
