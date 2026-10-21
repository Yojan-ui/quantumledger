/**
 * The key dot under the pointer, shared by the 3D key field (./KeyField, which sets it) and the
 * hero's DOM tooltip (components/trust/HeroTrust, which reads it). It lives in its own file, free of
 * three.js, so the hero can read it without pulling the 3D code into the home page's first bundle.
 */
export type KeyHover = { i: number; byte: number; x: number; y: number } | null;

let hovered: KeyHover = null;
const listeners = new Set<() => void>();

export const keyHover = {
  get: () => hovered,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

export function setKeyHover(h: KeyHover) {
  if (h?.i === hovered?.i && h?.x === hovered?.x && h?.y === hovered?.y) return;
  hovered = h;
  listeners.forEach((fn) => fn());
}
