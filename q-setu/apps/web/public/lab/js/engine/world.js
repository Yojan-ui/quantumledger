// THE world: one renderer, one scene, one fixed canvas. A route attaches a stage spec
// {el, key, make(ctx) -> layer, pose(layer, aspect), onSelect(hit)}; the canvas draws only inside el's rect
// (scissor). Same key across routes keeps the layer and flies the camera; a new key swaps the layer.
// Layer: {group, update(dt, now), pick(raycaster), highlight(hit), project(ref), retheme(colors), dispose()}.
import * as THREE from "three";
import { breathe, clamp01, flightDuration, flightProgress, MOTION } from "../motion.js";

const FOV = 38;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function themeColors() {
  return {
    bg: new THREE.Color(css("--world-clear") || "black"),
    ink: new THREE.Color(css("--text") || "white"),
  };
}

const POST_FRAG = `
uniform float uTime; uniform vec3 uClear; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float n = hash(floor(gl_FragCoord.xy) + fract(uTime) * 91.7);
  // result = n*g + clear*v + dst*(1 - g - v): uniform grain (g) plus a radial fade to the clear colour (v)
  float g = 0.018;
  float v = 0.42 * smoothstep(0.75, 1.4, length((vUv - 0.5) * 2.0));
  float a = g + v;
  gl_FragColor = vec4((vec3(n) * g + uClear * v) / a, a);
}`;
const POST_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createWorld({ onLost = () => {} } = {}) {
  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return null;
  const canvas = document.createElement("canvas");
  canvas.className = "world";
  canvas.setAttribute("aria-hidden", "true");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  document.body.prepend(canvas);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.info.autoReset = false;
  const dprCap = matchMedia("(pointer: coarse)").matches ? 1.5 : 2;
  let dpr = Math.min(devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  let colors = themeColors();
  scene.fog = new THREE.FogExp2(colors.bg, 0.02);
  renderer.setClearColor(colors.bg, 1);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(-6, 14, 10);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  rim.position.set(8, 6, -14);
  scene.add(key, rim);

  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uClear: { value: colors.bg.clone() } },
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
  post.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(post);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const cam = { pos: new THREE.Vector3(0, 8, 20), target: new THREE.Vector3() };
  let flight = null; // {fromPos, fromTarget, toPos, toTarget, t0, dur}
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  let stage = null; // {spec, layer, tip, listeners}
  const layers = new Map(); // key -> layer (only the latest is kept)
  let token = 0;
  let raf = 0;
  let last = 0;
  let pointer = null; // {x, y} css px inside stage, or null
  let hover = null;
  let dead = false;
  const frames = [];
  let calls = 0;
  let slow = 0;

  const gl = renderer.getContext();
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

  function retheme() {
    colors = themeColors();
    scene.fog.color.copy(colors.bg);
    renderer.setClearColor(colors.bg, 1);
    postMat.uniforms.uClear.value.copy(colors.bg);
    for (const l of layers.values()) l.retheme && l.retheme(colors);
  }
  const themeObs = new MutationObserver(retheme);
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function setPose(pose, instant) {
    const toPos = new THREE.Vector3(...pose.pos);
    const toTarget = new THREE.Vector3(...pose.target);
    if (instant) {
      cam.pos.copy(toPos);
      cam.target.copy(toTarget);
      flight = null;
      return;
    }
    const dist = cam.pos.distanceTo(toPos) + cam.target.distanceTo(toTarget);
    flight = {
      fromPos: cam.pos.clone(),
      fromTarget: cam.target.clone(),
      toPos,
      toTarget,
      t0: performance.now(),
      dur: flightDuration(dist),
    };
  }

  function stageRect() {
    const r = stage.spec.el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function unbind() {
    if (!stage) return;
    for (const [t, fn] of stage.listeners) stage.spec.el.removeEventListener(t, fn);
    stage.tip.remove();
    stage.spec.el.removeAttribute("data-world");
    stage.spec.el.style.cursor = "";
    if (stage.layer && stage.layer.highlight) stage.layer.highlight(null);
  }

  function setTip(hit) {
    const tip = stage.tip;
    if (!hit) {
      tip.hidden = true;
      stage.spec.el.style.cursor = "";
      return;
    }
    tip.replaceChildren(
      ...hit.lines.map((l, i) =>
        Object.assign(document.createElement(i ? "span" : "b"), { textContent: l }),
      ),
    );
    tip.hidden = false;
    tip.style.transform = `translate(${Math.round(pointer.x + 14)}px, ${Math.round(pointer.y + 14)}px)`;
    stage.spec.el.style.cursor = stage.spec.onSelect && hit.selectable ? "pointer" : "";
  }

  async function attach(spec) {
    if (dead) return false;
    const my = ++token;
    if (stage && stage.spec.el !== spec.el) unbind();
    let layer = layers.get(spec.key);
    const fresh = !layer;
    if (fresh) {
      for (const [k, l] of layers) {
        scene.remove(l.group);
        l.dispose();
        layers.delete(k);
      }
      try {
        layer = await spec.make({ THREE, scene, colors, renderer });
      } catch (e) {
        if (my === token) spec.el.removeAttribute("data-world");
        throw e;
      }
      if (my !== token || dead) {
        layer.dispose();
        return false;
      }
      layers.set(spec.key, layer);
      scene.add(layer.group);
    }
    const tip = Object.assign(document.createElement("div"), { className: "tip", hidden: true });
    tip.setAttribute("role", "tooltip");
    spec.el.append(tip);
    const listeners = [
      [
        "pointermove",
        (e) => {
          const r = spec.el.getBoundingClientRect();
          pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
          parallax.tx = (pointer.x / r.width) * 2 - 1;
          parallax.ty = (pointer.y / r.height) * 2 - 1;
        },
      ],
      [
        "pointerleave",
        () => {
          pointer = null;
          parallax.tx = parallax.ty = 0;
        },
      ],
      [
        "click",
        () => {
          if (hover && hover.selectable && spec.onSelect) spec.onSelect(hover);
        },
      ],
    ];
    for (const [t, fn] of listeners) spec.el.addEventListener(t, fn);
    stage = { spec, layer, tip, listeners };
    hover = null;
    const r = stageRect();
    const pose = spec.pose(layer, r.w / Math.max(1, r.h), FOV);
    if (fresh) {
      // arrival: fly in from further out along the same view direction
      const p = new THREE.Vector3(...pose.pos),
        t = new THREE.Vector3(...pose.target);
      const back = p.clone().sub(t).multiplyScalar(1.7).add(t);
      setPose({ pos: back.toArray(), target: pose.target }, true);
    }
    setPose(pose, false);
    if (layer.select) layer.select(spec.selected ?? null);
    spec.el.setAttribute("data-world", "on");
    start();
    return true;
  }

  function detach() {
    token++;
    unbind();
    stage = null;
    pointer = null;
    hover = null;
    renderer.setScissorTest(false);
    renderer.clear();
  }

  function resize() {
    const w = innerWidth,
      h = innerHeight;
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) renderer.setSize(w, h, false);
  }

  function frame(now) {
    raf = 0;
    if (dead || !stage || document.hidden) return;
    const dt = last ? Math.min(100, now - last) : 16.7;
    last = now;
    frames.push(dt);
    if (frames.length > 1200) frames.shift();
    // adaptive quality: sustained slow frames lower the pixel ratio (never below 1)
    slow = dt > 22 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 90 && dpr > 1) {
      dpr = Math.max(1, dpr - 0.25);
      renderer.setPixelRatio(dpr);
      slow = 0;
    }
    resize();
    renderer.info.reset();
    renderer.setScissorTest(false);
    renderer.clear();
    const r = stageRect();
    const vx = Math.max(0, r.x),
      vy = Math.max(0, r.y);
    const vw = Math.min(innerWidth, r.x + r.w) - vx,
      vh = Math.min(innerHeight, r.y + r.h) - vy;
    if (vw >= 1 && vh >= 1) {
      // camera: flight, then parallax (<= 2 deg) around the target
      if (flight) {
        const t = clamp01((now - flight.t0) / flight.dur);
        const k = flightProgress(t);
        cam.pos.lerpVectors(flight.fromPos, flight.toPos, k);
        cam.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
        if (t >= 1) flight = null;
      }
      parallax.x += (parallax.tx - parallax.x) * 0.06;
      parallax.y += (parallax.ty - parallax.y) * 0.06;
      const rad = (MOTION.parallaxMaxDeg * Math.PI) / 180;
      const off = cam.pos.clone().sub(cam.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), -parallax.x * rad);
      const side = new THREE.Vector3().crossVectors(off, new THREE.Vector3(0, 1, 0)).normalize();
      off.applyAxisAngle(side, parallax.y * rad);
      camera.position.copy(cam.target).add(off);
      camera.lookAt(cam.target);
      camera.aspect = r.w / Math.max(1, r.h);
      camera.updateProjectionMatrix();
      stage.layer.update(dt, now, breathe(now));
      // picking, once per frame, against the layer's instanced meshes
      if (pointer && !flight) {
        ndc.set((pointer.x / r.w) * 2 - 1, -(pointer.y / r.h) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hit = stage.layer.pick(raycaster);
        if ((hit && hit.id) !== (hover && hover.id)) {
          stage.layer.highlight(hit);
          hover = hit;
        }
        setTip(hit);
      } else if (hover && !pointer) {
        stage.layer.highlight(null);
        hover = null;
        setTip(null);
      }
      renderer.setScissorTest(true);
      const y = innerHeight - (r.y + r.h);
      renderer.setViewport(r.x, y, r.w, r.h);
      renderer.setScissor(vx, innerHeight - (vy + vh), vw, vh);
      renderer.render(scene, camera);
      postMat.uniforms.uTime.value = now / 1000;
      renderer.render(postScene, postCam);
    }
    calls = renderer.info.render.calls;
    start();
  }

  function start() {
    if (!raf && !dead && stage && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  const onVis = () => start();
  document.addEventListener("visibilitychange", onVis);

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    dead = true;
    cancelAnimationFrame(raf);
    if (stage) unbind();
    stage = null;
    canvas.remove();
    document.removeEventListener("visibilitychange", onVis);
    themeObs.disconnect();
    onLost();
  });

  const api = {
    attach,
    detach,
    get active() {
      return !dead && !!stage;
    },
    get dead() {
      return dead;
    },
  };
  // Read-only hook for tools/route_check.mjs: frame stats and screen positions of real data items.
  window.__lab3d = {
    get active() {
      return api.active;
    },
    get flying() {
      return !!flight;
    },
    stats() {
      const s = [...frames].sort((a, b) => a - b);
      const sum = frames.reduce((a, b) => a + b, 0);
      return {
        frames: frames.length,
        fps: frames.length ? +(1000 / (sum / frames.length)).toFixed(1) : null,
        p95Ms: s.length ? +s[Math.floor(s.length * 0.95)].toFixed(1) : null,
        worstMs: s.length ? +s[s.length - 1].toFixed(1) : null,
        drawCalls: calls,
        dpr,
        gpu,
      };
    },
    resetStats() {
      frames.length = 0;
    },
    project(ref) {
      if (!stage || !stage.layer.project) return null;
      const p = stage.layer.project(ref);
      if (!p) return null;
      const v = new THREE.Vector3(...p).project(camera);
      const r = stageRect();
      return { x: r.x + ((v.x + 1) / 2) * r.w, y: r.y + ((1 - v.y) / 2) * r.h };
    },
  };
  return api;
}
