"use client";

/**
 * GPU particles for the demo stages: N points (the budget's count, 6k–40k) whose positions are
 * computed entirely in the vertex shader. No buffers are written per frame; a scene drives them
 * with uniforms:
 *   uCenter/uRadius  the cloud, drifting along a curl-noise flow field (uAmp, uFreq)
 *   uBurst           seconds since a burst (< 0 = none): every point flies outward and fades
 *   uSuck/uTarget    0..1: points stream into a target point, staggered
 *   uGather/uShapeAt/uShapeSize  0..1: points fly onto the surface of a box (a shape assembling)
 *   uStream/uStreamFrom/uStreamSpread/uStreamSpeed  a steady stream from a line into uTarget
 *   uColorA/uColorB  mixed per point; a few points burn bright enough to bloom
 */
import * as THREE from "three";
import { NOISE } from "./materials";

export type ParticleUniforms = {
  uTime: { value: number };
  uCenter: { value: THREE.Vector3 };
  uRadius: { value: number };
  uAmp: { value: number };
  uFreq: { value: number };
  uBurst: { value: number };
  uBurstSpeed: { value: number };
  uSuck: { value: number };
  uTarget: { value: THREE.Vector3 };
  uGather: { value: number };
  uShapeAt: { value: THREE.Vector3 };
  uShapeSize: { value: THREE.Vector3 };
  uColorA: { value: THREE.Color };
  uColorB: { value: THREE.Color };
  uSize: { value: number };
  uPR: { value: number };
  uOpacity: { value: number };
  uBright: { value: number };
  uStream: { value: number };
  uStreamFrom: { value: THREE.Vector3 };
  uStreamSpread: { value: number };
  uStreamSpeed: { value: number };
};

const VS = /* glsl */ `
  ${NOISE}
  attribute vec4 aSeed;
  uniform float uTime; uniform vec3 uCenter; uniform float uRadius; uniform float uAmp; uniform float uFreq;
  uniform float uBurst; uniform float uBurstSpeed; uniform float uSuck; uniform vec3 uTarget;
  uniform float uGather; uniform vec3 uShapeAt; uniform vec3 uShapeSize;
  uniform float uStream; uniform vec3 uStreamFrom; uniform float uStreamSpread; uniform float uStreamSpeed;
  uniform float uSize; uniform float uPR;
  varying float vSeed; varying float vA; varying float vHot;
  vec3 boxPoint(vec4 s){
    float face = floor(s.x * 6.);
    vec2 uv = s.yz * 2. - 1.;
    vec3 p = face < 1. ? vec3(1., uv) : face < 2. ? vec3(-1., uv) : face < 3. ? vec3(uv.x, 1., uv.y)
      : face < 4. ? vec3(uv.x, -1., uv.y) : face < 5. ? vec3(uv, 1.) : vec3(uv, -1.);
    return p * .5;
  }
  void main(){
    vSeed = aSeed.x;
    vec3 dir = normalize(aSeed.xyz * 2. - 1. + 1e-4);
    vec3 base = dir * (.3 + .7 * pow(aSeed.w, .5)) * uRadius;
    vec3 p = uCenter + base;
    p += curlNoise(p * uFreq + vec3(0., uTime * .12, 0.)) * uAmp * uRadius;
    float a = 1.;
    if (uBurst >= 0.) {
      float b = 1. - exp(-uBurst * 2.2);
      p += dir * uBurstSpeed * (.4 + aSeed.w) * b;
      p.y -= .25 * uBurst * uBurst * .2;
      a *= exp(-uBurst * .55);
    }
    if (uSuck > 0.) {
      float s = clamp((uSuck - aSeed.w * .6) / .4, 0., 1.);
      s = s * s * (3. - 2. * s);
      p = mix(p, uTarget + dir * .03, s);
      a *= 1. - .85 * step(.999, s);
    }
    if (uGather > 0.) {
      float g = clamp((uGather - aSeed.y * .5) / .5, 0., 1.);
      g = g * g * (3. - 2. * g);
      p = mix(p, uShapeAt + boxPoint(aSeed) * uShapeSize, g);
    }
    if (uStream > 0.) {
      // A copy's journey: off the line, up and over, into the target; then round again.
      float u = fract(uTime * uStreamSpeed + aSeed.w);
      vec3 from = uStreamFrom + vec3((aSeed.x - .5) * uStreamSpread, 0., (aSeed.z - .5) * .2);
      vec3 mid = mix(from, uTarget, .45) + vec3(0., .55 + aSeed.y * .3, .2);
      p = mix(mix(from, mid, u), mix(mid, uTarget, u), u);
      p += curlNoise(p * 1.4 + uTime * .2) * .12 * (1. - u);
      a *= uStream * smoothstep(0., .12, u) * (1. - smoothstep(.88, 1., u));
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    vHot = step(.985, aSeed.z);
    vA = a;
    gl_PointSize = uSize * (.5 + aSeed.w) * (1. + vHot) * uPR / max(.1, -mv.z);
  }`;

const FS = /* glsl */ `
  uniform vec3 uColorA; uniform vec3 uColorB; uniform float uOpacity; uniform float uBright;
  varying float vSeed; varying float vA; varying float vHot;
  void main(){
    float d = length(gl_PointCoord - .5);
    if (d > .5) discard;
    float soft = 1. - smoothstep(.0, .5, d);
    vec3 c = mix(uColorA, uColorB, vSeed) * (uBright + vHot * 2.5);
    gl_FragColor = vec4(c * soft, soft * vA * uOpacity);
  }`;

/** A particle cloud (a THREE.Points to put in the scene, and its uniforms to drive). */
export function makeParticles(
  count: number,
  {
    colorA,
    colorB = colorA,
    center = new THREE.Vector3(),
    radius = 1,
    size = 0.035,
    seed = 1,
  }: {
    colorA: THREE.Color;
    colorB?: THREE.Color;
    center?: THREE.Vector3;
    radius?: number;
    size?: number;
    seed?: number;
  },
) {
  const g = new THREE.BufferGeometry();
  const s = new Float32Array(count * 4);
  let x = seed * 9301 + 49297;
  const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < s.length; i++) s[i] = rnd();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(s, 4));
  const u: ParticleUniforms = {
    uTime: { value: 0 },
    uCenter: { value: center.clone() },
    uRadius: { value: radius },
    uAmp: { value: 0.45 },
    uFreq: { value: 0.9 },
    uBurst: { value: -1 },
    uBurstSpeed: { value: 2.4 },
    uSuck: { value: 0 },
    uTarget: { value: new THREE.Vector3() },
    uGather: { value: 0 },
    uShapeAt: { value: new THREE.Vector3() },
    uShapeSize: { value: new THREE.Vector3(1, 1, 1) },
    uColorA: { value: colorA.clone() },
    uColorB: { value: colorB.clone() },
    uSize: { value: size * 100 },
    uPR: { value: 1 },
    uOpacity: { value: 0.9 },
    uBright: { value: 0.7 },
    uStream: { value: 0 },
    uStreamFrom: { value: new THREE.Vector3() },
    uStreamSpread: { value: 1 },
    uStreamSpeed: { value: 0.25 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: VS,
    fragmentShader: FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return { points, u, dispose: () => (g.dispose(), m.dispose()) };
}
