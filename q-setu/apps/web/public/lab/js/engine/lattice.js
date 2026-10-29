// Source lattice + finding pillars + score slabs for one finished run (data: /api/lab/runs/:id/scene).
// Draw calls: cells (Points) 1, file rails 1, solid pillars 1, wireframe pillars 1, slabs 1.
import { easeOutCubic, MOTION } from "../motion.js";
import { buildLattice, focusPose, GEOM, overviewPose } from "./layout.js";

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

export async function latticeLayer({ THREE, scene: world, colors }, scene, L) {
  const group = new THREE.Group();
  // levels are perceptual (sRGB-like); colours live in linear space, so raise to 2.2 before mixing
  const shade = (level, c = new THREE.Color()) =>
    c.copy(colors.bg).lerp(colors.ink, Math.pow(level, 2.2));
  const disposables = [];
  const own = (...xs) => (disposables.push(...xs), xs[0]);

  // one cell per source line (or per linesPerCell lines in long files), on the floor
  const cellGeo = own(new THREE.BufferGeometry());
  cellGeo.setAttribute("position", new THREE.BufferAttribute(L.cells, 3));
  const cellMat = own(
    new THREE.PointsMaterial({ size: 0.09, sizeAttenuation: true, color: shade(0.34) }),
  );
  group.add(new THREE.Points(cellGeo, cellMat));

  // one rail per input file, from line 1 to its last line
  const rails = new Float32Array(scene.files.length * 6);
  scene.files.forEach((f, fi) =>
    rails.set([fi * GEOM.fileGap, 0, 0, fi * GEOM.fileGap, 0, (f.lines || 1) * L.zPerLine], fi * 6),
  );
  const railGeo = own(new THREE.BufferGeometry());
  railGeo.setAttribute("position", new THREE.BufferAttribute(rails, 3));
  const railMat = own(new THREE.LineBasicMaterial({ color: shade(0.22) }));
  group.add(new THREE.LineSegments(railGeo, railMat));

  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
  function instanced(pack, material) {
    const n = Math.max(1, pack.levels.length);
    const mesh = new THREE.InstancedMesh(boxGeo, material, n);
    mesh.count = pack.levels.length;
    if (pack.levels.length) mesh.instanceMatrix.array.set(pack.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    mesh.computeBoundingSphere();
    group.add(mesh);
    return mesh;
  }
  const solidMat = own(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.06 }),
  );
  const wireMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
  const slabMat = own(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 }),
  );
  const solid = instanced(L.solid, solidMat);
  const wire = instanced(L.wire, wireMat);
  const slabPack = { matrices: L.slabs, levels: new Float32Array(scene.files.length).fill(0.5) };
  const slabs = instanced(slabPack, slabMat);

  // fog scales with the lattice so the far end fades but nothing near is lost
  const span = Math.hypot(L.bounds.max[0] - L.bounds.min[0], L.bounds.max[2] - L.bounds.min[2]);
  world.fog.density = 1.1 / Math.max(20, span * 2.2);

  let hovered = null; // {mesh, i}
  let selected = null; // global finding index
  const tmp = new THREE.Color();
  function paint() {
    for (const [mesh, pack] of [
      [solid, L.solid],
      [wire, L.wire],
      [slabs, slabPack],
    ]) {
      for (let i = 0; i < pack.levels.length; i++) {
        let lv = pack.levels[i];
        const isSel =
          mesh !== slabs &&
          selected !== null &&
          L.offsets[pack.ref[i * 2]] + pack.ref[i * 2 + 1] === selected;
        if (selected !== null && mesh !== slabs && !isSel) lv *= 0.45;
        if (isSel || (hovered && hovered.mesh === mesh && hovered.i === i)) lv = 1;
        mesh.instanceColor.setXYZ(i, ...shade(lv, tmp).toArray());
      }
      mesh.instanceColor.needsUpdate = true;
    }
    cellMat.color.copy(shade(0.34));
    railMat.color.copy(shade(0.22));
  }
  paint();

  function describe(mesh, i) {
    if (mesh === slabs) {
      const f = scene.files[i];
      return {
        id: `file:${i}`,
        kind: "file",
        fi: i,
        selectable: false,
        lines: [
          f.name,
          `score ${f.score} / 100 · ${f.grade}`,
          `${f.lines} lines · ${f.findings.length} finding(s)`,
        ],
      };
    }
    const pack = mesh === solid ? L.solid : L.wire;
    const fi = pack.ref[i * 2],
      n = pack.ref[i * 2 + 1];
    const f = scene.files[fi],
      x = f.findings[n];
    const q = x.quantumSafe
      ? "quantum-safe"
      : x.quantumVulnerable
        ? "quantum-vulnerable"
        : "not quantum-safe";
    return {
      id: `f:${fi}:${n}`,
      kind: "finding",
      fi,
      n,
      selectable: true,
      lines: [
        `${f.name}:${x.line}`,
        `${x.severity} · ${x.algorithm}`,
        `${x.ruleId} · weight ${x.weight} · ${q}`,
      ],
    };
  }

  let grow = 0;
  return {
    group,
    L,
    update(dt, _now, breath) {
      if (grow < 1) grow = Math.min(1, grow + dt / MOTION.rollMs);
      const g = easeOutCubic(grow);
      group.scale.set(breath, Math.max(0.001, g) * breath, breath);
    },
    pick(raycaster) {
      const hits = raycaster.intersectObjects([solid, wire, slabs], false);
      const h = hits.find((x) => x.instanceId !== undefined && x.instanceId < x.object.count);
      return h ? { ...describe(h.object, h.instanceId), mesh: h.object, i: h.instanceId } : null;
    },
    highlight(hit) {
      hovered = hit ? { mesh: hit.mesh, i: hit.i } : null;
      paint();
    },
    select(ref) {
      selected = ref ? L.offsets[ref.fi] + ref.n : null;
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
    retheme(c) {
      colors = c;
      paint();
    },
    dispose() {
      for (const m of [solid, wire, slabs]) m.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}
