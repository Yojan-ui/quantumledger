"use client";

import { useFrame } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  CopyPass,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from "postprocessing";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { budgetNow } from "@/components/fx/budget";
import { DeployFloor } from "./DeployFloor";
import { Arcs } from "./Arcs";
import { Globe } from "./Globe";
import { IndexBars } from "./IndexBars";
import { Nodes } from "./Nodes";
import { Seat } from "./Seat";
import { Rig } from "./Rig";
import { Thicken } from "@/components/scenes/Thicken";
import { RoomArcs } from "./RoomArcs";
import { ScanArc } from "./ScanArc";
import { LedgerCore } from "./LedgerCore";
import { Shell } from "./Shell";
import type { Dots } from "./shapes";
import { world } from "./store";

interface WorldPipe {
  composer: EffectComposer;
  ca: ChromaticAberrationEffect;
  caPass: EffectPass;
  target: THREE.WebGLRenderTarget;
  quad: THREE.Scene;
  ortho: THREE.OrthographicCamera;
  w: number;
  h: number;
}

/** Demo 2's post-processing on the globe: bloom, vignette, film noise, and aberration on impacts. */
function makeWorldPipe(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(gl, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: 0,
  });
  composer.autoRenderToScreen = false;
  composer.addPass(new RenderPass(scene, camera));
  const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SOFT_LIGHT });
  noise.blendMode.opacity.value = 0.2;
  composer.addPass(
    new EffectPass(
      camera,
      new BloomEffect({
        mipmapBlur: true,
        luminanceThreshold: 0.75,
        luminanceSmoothing: 0.2,
        intensity: 1.1,
        radius: 0.7,
        resolutionScale: budgetNow().bloomScale,
      }),
      new VignetteEffect({ offset: 0.3, darkness: 0.5 }),
      noise,
    ),
  );
  const ca = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(),
    radialModulation: true,
    modulationOffset: 0.25,
  });
  const caPass = new EffectPass(camera, ca);
  composer.addPass(caPass);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  composer.addPass(new CopyPass(target, false));
  const quad = new THREE.Scene();
  quad.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { tMap: { value: target.texture } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
        fragmentShader: `uniform sampler2D tMap; varying vec2 vUv;
          void main(){ gl_FragColor = texture2D(tMap, vUv);
          #include <colorspace_fragment>
          }`,
        depthTest: false,
        depthWrite: false,
      }),
    ),
  );
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { composer, ca, caPass, target, quad, ortho, w: 0, h: 0 } satisfies WorldPipe;
}

/**
 * Render the main world ourselves (drei <View>s in Demos 1 and 3 take over R3F's loop), scissored to
 * the page's globe area so the globe can never draw over text. On Demo 2 (deploy mode) the area is
 * rendered through post-processing instead (camera view-offset to just that area, composited back);
 * every other page draws exactly as before.
 */
function RenderMain() {
  const pipe = useRef<WorldPipe | null>(null);
  useEffect(
    () => () => {
      pipe.current?.composer.dispose();
      pipe.current?.target.dispose();
      pipe.current = null;
    },
    [],
  );
  useFrame(({ gl, scene, camera, size }, dt) => {
    gl.setScissorTest(false);
    gl.autoClear = false;
    gl.clear();
    const r = world.focusRect;
    const fxOn = !!r && world.mode === "deploy" && budgetNow().post;
    if (r && fxOn) {
      const p = (pipe.current ??= makeWorldPipe(gl, scene, camera));
      const pr = gl.getPixelRatio();
      const w = Math.max(1, Math.round(r.width * pr));
      const h = Math.max(1, Math.round(r.height * pr));
      if (w !== p.w || h !== p.h) {
        p.w = w;
        p.h = h;
        p.composer.inputBuffer.setSize(w, h);
        p.composer.outputBuffer.setSize(w, h);
        for (const pass of p.composer.passes) pass.setSize(w, h);
        p.target.setSize(w, h);
      }
      // Render just the area: the Rig's view offset, narrowed to the area's rectangle.
      const cam = camera as THREE.PerspectiveCamera;
      const v = cam.view;
      const ox = v?.enabled ? v.offsetX : 0;
      const oy = v?.enabled ? v.offsetY : 0;
      cam.setViewOffset(size.width, size.height, ox + r.left, oy + r.top, r.width, r.height);
      const now = performance.now();
      const k = world.breathe ? world.fxHit.s * Math.exp(-(now - world.fxHit.at) / 260) : 0;
      p.ca.offset.set(0.005 * k, 0.003 * k);
      p.caPass.enabled = k > 0.002;
      p.composer.render(dt);
      cam.setViewOffset(size.width, size.height, ox, oy, size.width, size.height);
      gl.setRenderTarget(null);
      gl.setViewport(r.left, size.height - r.top - r.height, r.width, r.height);
      gl.setScissor(r.left, size.height - r.top - r.height, r.width, r.height);
      gl.setScissorTest(true);
      gl.render(p.quad, p.ortho);
      gl.setScissorTest(false);
      gl.setViewport(0, 0, size.width, size.height);
      return;
    }
    if (r) {
      // drei <View>s leave the viewport set to their own rectangle; the world needs the whole canvas.
      gl.setViewport(0, 0, size.width, size.height);
      gl.setScissor(r.left, size.height - r.top - r.height, r.width, r.height);
      gl.setScissorTest(true);
      gl.render(scene, camera);
      gl.setScissorTest(false);
    }
  }, 1);
  return null;
}

export function World({ dots }: { dots: Dots }) {
  const globe = useRef<THREE.Group>(null);
  return (
    <>
      <RenderMain />
      <Rig globe={globe} />
      <group ref={globe}>
        <Thicken width={1.6}>
          <Globe dots={dots} />
          <Arcs />
          <Nodes />
          <Seat />
          <ScanArc />
          <RoomArcs />
          <IndexBars />
          <LedgerCore />
        </Thicken>
        <Shell />
      </group>
      <DeployFloor />
    </>
  );
}
