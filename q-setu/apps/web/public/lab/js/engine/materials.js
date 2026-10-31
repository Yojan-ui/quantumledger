// Shared materials. Growth happens in the vertex shader: each instance has a birth time (aBorn, ms since the
// layer started) and grows from its base over MOTION.rollMs (ease-out cubic) once uNow passes it. No per-frame
// JS loop over objects; a layer only advances uNow.
import { MOTION } from "../motion.js";

export function growStandard(THREE, params) {
  const material = new THREE.MeshStandardMaterial(params);
  const uNow = { value: 0 };
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uNow = uNow;
    sh.uniforms.uGrowMs = { value: MOTION.rollMs };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aBorn;\nuniform float uNow;\nuniform float uGrowMs;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat gt = clamp((uNow - aBorn) / uGrowMs, 0.0, 1.0);\nfloat gg = 1.0 - pow(1.0 - gt, 3.0);\ntransformed.y = (transformed.y + 0.5) * max(gg, 0.001) - 0.5;",
      );
  };
  material.customProgramCacheKey = () => "qlab-grow";
  return { material, uNow };
}

/** Perceptual grey level (0..1) between the clear colour and ink, in linear space. */
export const shade = (colors, level, c) =>
  c.copy(colors.bg).lerp(colors.ink, Math.pow(Math.max(0, Math.min(1, level)), 2.2));
