// Staged inputs as plates: one per input of the input screen, depth = bytes (against the per-file limit),
// engraved marks = lines (capped), edges only = rejected by the server's validation, slim pole = host/URL.
// Rebuilt whenever the staged list or the server's preview changes. Draw calls: plates, edges, marks, floor = 4.
import { buildPlates, overviewPose, PLATE } from "./layout.js";
import { growStandard, shade } from "./materials.js";

export function platesLayer({ THREE, scene: world, colors }) {
  const group = new THREE.Group();
  const t0 = performance.now();
  const tNow = () => performance.now() - t0;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const grow = growStandard(THREE, { color: 0xffffff, roughness: 0.5, metalness: 0.05 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const markMat = new THREE.PointsMaterial({ size: 0.07, sizeAttenuation: true, color: 0xffffff });
  const floorMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const tmp = new THREE.Color();
  const born = new Map(); // item key -> ms
  let items = [],
    P = buildPlates([]),
    objs = [],
    solid = null,
    wirePick = null,
    hovered = null;
  world.fog.density = 0.02;

  function clear() {
    for (const o of objs) {
      group.remove(o);
      if (o.geometry !== boxGeo) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    }
    objs = [];
  }
  function build() {
    clear();
    const ns = P.solid.ref.length;
    const geo = boxGeo.clone();
    geo.setAttribute(
      "aBorn",
      new THREE.InstancedBufferAttribute(
        Float32Array.from(
          { length: Math.max(1, ns) },
          (_, k) => born.get(items[P.solid.ref[k]]?.key) ?? 0,
        ),
        1,
      ),
    );
    solid = new THREE.InstancedMesh(geo, grow.material, Math.max(1, ns));
    solid.count = ns;
    if (ns) solid.instanceMatrix.array.set(P.solid.matrices);
    solid.instanceMatrix.needsUpdate = true;
    solid.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, ns) * 3),
      3,
    );
    solid.computeBoundingSphere();
    const nw = P.wire.ref.length;
    wirePick = new THREE.InstancedMesh(boxGeo, hidden, Math.max(1, nw));
    wirePick.count = nw;
    if (nw) wirePick.instanceMatrix.array.set(P.wire.matrices);
    wirePick.instanceMatrix.needsUpdate = true;
    wirePick.computeBoundingSphere();
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.BufferAttribute(P.wire.edges, 3));
    const edges = new THREE.LineSegments(eg, edgeMat);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.BufferAttribute(P.marks, 3));
    const marks = new THREE.Points(mg, markMat);
    const fg = new THREE.BufferGeometry();
    const w = Math.max(4, items.length) * PLATE.gap;
    fg.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          -PLATE.gap / 2,
          0,
          PLATE.maxD / 2 + 0.4,
          w - PLATE.gap / 2,
          0,
          PLATE.maxD / 2 + 0.4,
        ]),
        3,
      ),
    );
    const floor = new THREE.LineSegments(fg, floorMat);
    objs = [solid, wirePick, edges, marks, floor];
    for (const o of objs) group.add(o);
    paint();
  }
  function paint() {
    for (let k = 0; k < P.solid.ref.length; k++) {
      const it = items[P.solid.ref[k]];
      const hot = hovered && hovered.mesh === solid && hovered.i === k;
      solid.instanceColor.setXYZ(
        k,
        ...shade(colors, hot ? 1 : it.kind === "url" ? 0.7 : 0.82, tmp).toArray(),
      );
    }
    solid.instanceColor.needsUpdate = true;
    edgeMat.color.copy(shade(colors, hovered && hovered.mesh === wirePick ? 1 : 0.75, tmp));
    markMat.color.copy(shade(colors, 0.2, tmp));
    floorMat.color.copy(shade(colors, 0.24, tmp));
  }
  build();

  return {
    group,
    update(_dt, _now, breath) {
      grow.uNow.value = tNow();
      group.scale.setScalar(breath);
    },
    /** items: [{key, name, kind, bytes, lines, rejected, maxBytes, tip: [lines]}] from the input view. */
    set(next) {
      const now = tNow();
      for (const it of next) if (!born.has(it.key)) born.set(it.key, now);
      items = next;
      P = buildPlates(items);
      build();
    },
    pick(raycaster) {
      const hits = raycaster.intersectObjects([solid, wirePick], false);
      const h = hits.find((x) => x.instanceId !== undefined && x.instanceId < x.object.count);
      if (!h) return null;
      const it = items[(h.object === solid ? P.solid : P.wire).ref[h.instanceId]];
      return {
        id: `plate:${it.key}`,
        kind: "input",
        selectable: false,
        lines: it.tip,
        mesh: h.object,
        i: h.instanceId,
      };
    },
    highlight(hit) {
      hovered = hit ? { mesh: hit.mesh, i: hit.i } : null;
      paint();
    },
    overview: (aspect, fov) => {
      const b = { min: [...P.bounds.min], max: [...P.bounds.max] };
      b.max[0] = b.min[0] + Math.ceil(Math.max(4, P.n) / 4) * 4 * PLATE.gap; // whole rows of 4
      return overviewPose(b, fov, aspect, [0.35, 0.75, 0.9]);
    },
    retheme(c) {
      colors = c;
      paint();
    },
    dispose() {
      clear();
      for (const m of [grow.material, hidden, edgeMat, markMat, floorMat]) m.dispose();
      boxGeo.dispose();
    },
  };
}
