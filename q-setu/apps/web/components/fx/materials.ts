"use client";

/**
 * The demo stages' shaders. Colours always come from the palette (components/world/palette).
 * Emissive parts are written above 1.0 (linear) so the stage's bloom, which only picks up bright
 * pixels, makes exactly those glow: the "selective" bloom is decided here, by brightness.
 *
 *  - glass(): fresnel rim glow in a role colour over a faint tinted body.
 *  - solid(): lit solid with a noise dissolve (uDissolve 0 → 1) and a glowing burn edge.
 *  - energyTube(): scrolling energy along a TubeGeometry, with comet heads and their tails.
 *  - lightCone(): a soft volumetric cone of light from above.
 */
import * as THREE from "three";

/** Ashima's 3D simplex noise (MIT), with its analytic gradient. */
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+10.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v, out vec3 gradient){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  vec4 m2=m*m; vec4 m4=m2*m2;
  vec4 pdotx=vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3));
  vec4 temp=m2*m*pdotx;
  gradient=-8.*(temp.x*x0+temp.y*x1+temp.z*x2+temp.w*x3);
  gradient+=m4.x*p0+m4.y*p1+m4.z*p2+m4.w*p3; gradient*=105.;
  return 105.*dot(m4,pdotx);
}
float snoise(vec3 v){vec3 g; return snoise(v,g);}
/** Divergence-free flow (Bridson): the cross product of two noise potentials' gradients. */
vec3 curlNoise(vec3 p){
  vec3 g1; vec3 g2;
  snoise(p, g1); snoise(p + vec3(31.416, -47.853, 12.793), g2);
  return cross(g1, g2) * 0.06;
}
`;

const col = (c: THREE.Color) => c.clone();

/** Fresnel glass: a faint tinted body and a bright rim in a role colour. */
export function glass(color: THREE.Color, { rim = 2.4, body = 0.06, power = 2.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: col(color) },
      uRim: { value: rim },
      uBody: { value: body },
      uPower: { value: power },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uRim; uniform float uBody; uniform float uPower; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), uPower);
        vec3 c = uColor * (uBody + f * uRim);
        gl_FragColor = vec4(c, (uBody * 2.5 + f) * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * A lit solid that can dissolve: noise cuts it away from uDissolve 0 (whole) to 1 (gone), with a
 * glowing edge in uEdge. uGlow scales its emissive (above ~2 it blooms). `instanced` reads each
 * instance's matrix (for InstancedMesh).
 */
export function solid(
  color: THREE.Color,
  {
    glow = 0.25,
    edge = color,
    light = new THREE.Vector3(0.4, 0.9, 0.5),
    instanced = false,
  }: { glow?: number; edge?: THREE.Color; light?: THREE.Vector3; instanced?: boolean } = {},
) {
  const M = instanced ? "modelMatrix * instanceMatrix" : "modelMatrix";
  const N = instanced ? "mat3(modelMatrix) * mat3(instanceMatrix)" : "mat3(modelMatrix)";
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: col(color) },
      uEdge: { value: col(edge) },
      uGlow: { value: glow },
      uDissolve: { value: 0 },
      uScale: { value: 6 },
      uLight: { value: light.clone().normalize() },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec4 wp = ${M} * vec4(position,1.);
        vP = position;
        vN = normalize(${N} * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform vec3 uColor; uniform vec3 uEdge; uniform float uGlow; uniform float uDissolve;
      uniform float uScale; uniform vec3 uLight; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float n = snoise(vP * uScale) * .5 + .5;
        float cut = uDissolve * 1.15 - .08;
        if (n < cut) discard;
        vec3 N = normalize(vN);
        float diff = max(dot(N, uLight), 0.) * .75 + .25;
        float rim = pow(1. - max(dot(N, normalize(vV)), 0.), 3.);
        vec3 c = uColor * (diff * .55 + uGlow) + uColor * rim * .9;
        float e = 1. - smoothstep(0., .07, n - cut);
        c += uEdge * e * step(.001, uDissolve) * 4.;
        gl_FragColor = vec4(c, uOpacity);
      }`,
    transparent: true,
  });
}

/**
 * Energy along a tube (uv.x runs along its length): faint scrolling bands, and up to 8 comets.
 * uHeads[i] is a comet's head position along the tube (0..1, < 0 = none); its tail trails behind.
 */
export function energyTube(
  color: THREE.Color,
  { base = 0.35, speed = 0.6, vertexColors = false } = {},
) {
  return new THREE.ShaderMaterial({
    vertexColors,
    uniforms: {
      uColor: { value: col(color) },
      uTime: { value: 0 },
      uBase: { value: base },
      uSpeed: { value: speed },
      uHeads: { value: new Array(8).fill(-1) },
      uTail: { value: 9 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main(){
        vUv = uv;
        #ifdef USE_COLOR
        vC = color;
        #else
        vC = vec3(1.);
        #endif
        vec4 wp = modelMatrix * vec4(position,1.);
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uBase; uniform float uSpeed;
      uniform float uHeads[8]; uniform float uTail; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main(){
        float u = vUv.x;
        float bands = pow(.5 + .5 * sin((u * 40. - uTime * uSpeed * 6.2831)), 6.);
        float rim = pow(1. - abs(dot(normalize(vN), normalize(vV))), 1.5);
        float e = uBase * (.35 + .65 * bands) * (.4 + rim);
        for (int i = 0; i < 8; i++) {
          float h = uHeads[i];
          if (h < 0.) continue;
          float d = h - u;
          e += d >= 0. ? 3.2 * exp(-d * uTail) : 3.2 * exp(d * 120.);
        }
        gl_FragColor = vec4(uColor * vC * e, clamp(e, 0., 1.) * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** A soft cone of light from above (open cone geometry, apex up): fades down and at its edges. */
export function lightCone(color: THREE.Color, strength = 0.18) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col(color) }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position,1.);
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uStrength;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float a = pow(facing, 2.) * pow(vUv.y, 1.6) * uStrength;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}
