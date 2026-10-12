/** three.js colours, read once from styles/tokens.css (the only place colours are defined). */
import * as THREE from "three";
import { token } from "@/lib/tokens";

export function palette() {
  return {
    bg: new THREE.Color(token("--bg")),
    text: new THREE.Color(token("--text")),
    text3: new THREE.Color(token("--text-3")),
    accent: new THREE.Color(token("--accent")),
    warn: new THREE.Color(token("--warn")),
    kem: new THREE.Color(token("--kem")),
    sig: new THREE.Color(token("--sig")),
    ok: new THREE.Color(token("--ok")),
    danger: new THREE.Color(token("--danger")),
  };
}
