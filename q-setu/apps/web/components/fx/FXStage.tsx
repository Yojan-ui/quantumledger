"use client";

/**
 * A demo stage's own post-processing, on the site's one shared canvas.
 *
 * drei's <View> draws its scene straight into the view's rectangle, so an ordinary EffectComposer
 * (which owns the whole canvas) can't be used. Instead the demo's scene is portalled into a scene of
 * its own and rendered by a `postprocessing` EffectComposer into an off-screen target sized to the
 * view; the result is one full-screen quad in the View's scene, which the View then draws, scissored
 * into its rectangle as usual. Nothing outside the demo stages (the homepage, the globe) changes.
 *
 * Passes: depth of field (top tier only) → bloom (only pixels brighter than 1: the emissive,
 * role-coloured parts the shaders push past it), hue/saturation (Q-Day's desaturation), vignette and
 * film noise → chromatic aberration (only on impacts). Camera shake and the punch-in are applied to
 * the camera around this render alone, so the director's camera is never disturbed.
 *
 * Scenes drive it through useFX(), a mutable object they write to in useFrame (never React state):
 *   fx.hit(strength)   an impact: shake + chromatic aberration, decaying over ~0.5 s
 *   fx.desat 0..1      desaturation          fx.time 0..1  the scene clock's speed (slow motion)
 *   fx.punch 0..1      punch-in (narrower field of view)   fx.focus  the depth of field's subject
 * The budget (components/fx/budget) drops DoF, then halves bloom, then turns all of this off.
 */
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  CopyPass,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from "postprocessing";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { compileAll } from "@/components/world/SceneView";
import { useBudget } from "./budget";

export interface FX {
  /** When the last impact landed (performance.now()) and how hard (0..1). */
  impactAt: number;
  impact: number;
  hit: (strength?: number) => void;
  desat: number;
  punch: number;
  /** The scene clock's speed: 1 normal, 0.2 slow motion. Scenes multiply their dt by it. */
  time: number;
  focus: THREE.Vector3 | null;
  /** Whether post-processing is on (scenes may simplify when it isn't). */
  post: boolean;
}

const FXContext = createContext<FX | null>(null);

interface Pipe {
  composer: EffectComposer;
  dof: DepthOfFieldEffect | null;
  hue: HueSaturationEffect;
  ca: ChromaticAberrationEffect;
  caPass: EffectPass;
  target: THREE.WebGLRenderTarget;
  w: number;
  h: number;
  cam: THREE.Camera;
}

/**
 * Reports the camera in use inside the stage's own scene (a scene's DirectorCamera makes its own
 * camera the default there, not the View's), so the composer renders through it.
 */
function CameraBridge({ into }: { into: { current: THREE.Camera | null } }) {
  const camera = useThree((s) => s.camera);
  into.current = camera;
  return null;
}
/** The stage's effects controller (see the header). */
export function useFX(): FX {
  const fx = useContext(FXContext);
  if (!fx) throw new Error("useFX() outside <FXStage>");
  return fx;
}

const QUAD_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const QUAD_FS = /* glsl */ `
  uniform sampler2D tMap; varying vec2 vUv;
  void main(){ gl_FragColor = texture2D(tMap, vUv);
  #include <colorspace_fragment>
  }`;

export function FXStage({
  children,
  background,
  active,
  reduce,
}: {
  children: ReactNode;
  /** The stage's backdrop colour (the page's own, from the palette). */
  background: THREE.Color;
  /** False while the stage is off screen: nothing renders. */
  active: boolean;
  reduce: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const viewCamera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const inner = useMemo<{ current: THREE.Camera | null }>(() => ({ current: null }), []);
  const camera = viewCamera;
  const budget = useBudget();
  const [scene] = useState(() => new THREE.Scene());
  scene.background = background;

  const fx = useMemo<FX>(() => {
    const f: FX = {
      impactAt: 0,
      impact: 0,
      hit: (s = 1) => {
        f.impactAt = performance.now();
        f.impact = s;
      },
      desat: 0,
      punch: 0,
      time: 1,
      focus: null,
      post: true,
    };
    return f;
  }, []);
  fx.post = budget.post;

  // The pipeline, built in an effect (each mount gets its own, disposed by its own cleanup: React's
  // strict mode mounts twice) and rebuilt only when the budget changes tier.
  const pipeRef = useRef<Pipe | null>(null);
  useEffect(() => {
    if (!budget.post) return;
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      // No MSAA: the mipmap bloom reads black from a multisampled half-float buffer on some GPUs
      // (and software GL); the 1.5× pixel ratio keeps edges smooth.
      multisampling: 0,
    });
    composer.autoRenderToScreen = false;
    composer.addPass(new RenderPass(scene, camera));
    const dof = budget.dof
      ? new DepthOfFieldEffect(camera, {
          focusDistance: 6,
          focusRange: 3.5,
          bokehScale: 2.2,
          resolutionScale: 0.5,
        })
      : null;
    if (dof) composer.addPass(new EffectPass(camera, dof));
    const bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 0.92,
      luminanceSmoothing: 0.18,
      intensity: 1.25,
      radius: 0.72,
      resolutionScale: budget.bloomScale,
    });
    const hue = new HueSaturationEffect({ saturation: 0 });
    const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.5 });
    const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SOFT_LIGHT });
    noise.blendMode.opacity.value = 0.22;
    composer.addPass(new EffectPass(camera, bloom, hue, vignette, noise));
    const ca = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0, 0),
      radialModulation: true,
      modulationOffset: 0.25,
    });
    const caPass = new EffectPass(camera, ca);
    composer.addPass(caPass);
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    composer.addPass(new CopyPass(target, false));
    const p: Pipe = { composer, dof, hue, ca, caPass, target, w: 0, h: 0, cam: camera };
    pipeRef.current = p;
    return () => {
      composer.dispose();
      target.dispose();
      if (pipeRef.current === p) pipeRef.current = null;
    };
  }, [gl, scene, camera, budget.post, budget.dof, budget.level, budget.bloomScale]);

  const quad = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { tMap: { value: null } },
        vertexShader: QUAD_VS,
        fragmentShader: QUAD_FS,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  // Every shader in the stage compiles up front (much of a film is hidden until its moment).
  useEffect(() => {
    const t1 = setTimeout(() => compileAll(gl, scene, inner.current ?? camera), 300);
    const t2 = setTimeout(() => compileAll(gl, scene, inner.current ?? camera), 1500);
    return () => (clearTimeout(t1), clearTimeout(t2));
  }, [gl, scene, camera, inner]);

  const save = useMemo(() => ({ pos: new THREE.Vector3(), fov: 0 }), []);
  const quadMesh = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!active) return;
    const pipe = pipeRef.current;
    const cam = (inner.current ?? camera) as THREE.PerspectiveCamera;
    // The View keeps its own camera's aspect; the stage's camera is ours to keep.
    const aspect = size.width / Math.max(1, size.height);
    if (cam.aspect !== aspect) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
    // Lowest tier (or the pipeline not built yet): no off-screen pass this frame.
    if (quadMesh.current) quadMesh.current.visible = !!pipe;
    if (!pipe) return;
    const pr = gl.getPixelRatio();
    const w = Math.max(1, Math.round(size.width * pr));
    const h = Math.max(1, Math.round(size.height * pr));
    if (w !== pipe.w || h !== pipe.h) {
      // Not composer.setSize(): that would resize the whole shared canvas.
      pipe.w = w;
      pipe.h = h;
      pipe.composer.inputBuffer.setSize(w, h);
      pipe.composer.outputBuffer.setSize(w, h);
      for (const p of pipe.composer.passes) p.setSize(w, h);
      pipe.target.setSize(w, h);
    }
    if (pipe.cam !== cam) {
      pipe.cam = cam;
      pipe.composer.setMainCamera(cam);
      if (pipe.dof) pipe.dof.mainCamera = cam;
    }
    const now = performance.now();
    const k = reduce ? 0 : fx.impact * Math.exp(-(now - fx.impactAt) / 220);
    // Shake and punch-in, for this render only.
    save.pos.copy(cam.position);
    save.fov = cam.fov;
    if (k > 0.002) {
      const t = now / 1000;
      cam.position.x += Math.sin(t * 83.1) * 0.05 * k;
      cam.position.y += Math.sin(t * 71.7 + 1.3) * 0.04 * k;
    }
    if (fx.punch > 0.001) {
      cam.fov = save.fov / (1 + 0.22 * fx.punch);
      cam.updateProjectionMatrix();
    }
    pipe.ca.offset.set(0.006 * k, 0.004 * k);
    pipe.caPass.enabled = k > 0.002;
    pipe.hue.saturation = -Math.min(1, Math.max(0, fx.desat));
    // Depth of field keeps the beat's subject sharp (autofocus on its world position).
    if (pipe.dof) pipe.dof.target = fx.focus;
    const prevTarget = gl.getRenderTarget();
    const scissor = gl.getScissorTest();
    gl.setScissorTest(false);
    pipe.composer.render(dt);
    gl.setRenderTarget(prevTarget);
    gl.setScissorTest(scissor);
    cam.position.copy(save.pos);
    if (cam.fov !== save.fov) {
      cam.fov = save.fov;
      cam.updateProjectionMatrix();
    }
    quad.uniforms.tMap!.value = pipe.target.texture;
  }, 0.5);

  return (
    <>
      {budget.post ? (
        <>
          {createPortal(
            <FXContext.Provider value={fx}>
              <CameraBridge into={inner} />
              {children}
            </FXContext.Provider>,
            scene,
          )}
          <mesh
            ref={quadMesh}
            frustumCulled={false}
            renderOrder={-100}
            material={quad}
            visible={false}
          >
            <planeGeometry args={[2, 2]} />
          </mesh>
        </>
      ) : (
        <FXContext.Provider value={fx}>{children}</FXContext.Provider>
      )}
    </>
  );
}
