/**
 * Short fading trails behind moving packets: a ring buffer of a point's recent positions, written into
 * a line geometry's position and colour attributes, newest bright, oldest fading to the background.
 * The trail is sampled by time, so a faster packet leaves a longer streak.
 */
import * as THREE from "three";

export class Trail {
  readonly positions: Float32Array;
  readonly alphas: Float32Array;
  private head = 0;
  private filled = 0;
  constructor(readonly length = 12) {
    this.positions = new Float32Array(length * 3);
    this.alphas = new Float32Array(length);
  }
  reset(at: THREE.Vector3Like) {
    for (let i = 0; i < this.length; i++) this.positions.set([at.x, at.y, at.z], i * 3);
    this.filled = 0;
  }
  push(at: THREE.Vector3Like) {
    this.positions.set([at.x, at.y, at.z], this.head * 3);
    this.head = (this.head + 1) % this.length;
    this.filled = Math.min(this.length, this.filled + 1);
  }
  /**
   * Writes the trail, newest first, as line segments into `pos` (2 points per segment) and the fade
   * into `col` (the line colour times alpha, so it fades on an additive or dark background).
   * Returns the number of vertices written.
   */
  write(pos: Float32Array, col: Float32Array, color: THREE.Color, fade = 1): number {
    let v = 0;
    const n = this.filled;
    for (let k = 0; k < n - 1; k++) {
      const i = (this.head - 1 - k + this.length * 2) % this.length;
      const j = (i - 1 + this.length) % this.length;
      const a0 = (1 - k / n) ** 1.6 * fade;
      const a1 = (1 - (k + 1) / n) ** 1.6 * fade;
      pos.set(this.positions.subarray(i * 3, i * 3 + 3), v * 3);
      col.set([color.r * a0, color.g * a0, color.b * a0], v * 3);
      v++;
      pos.set(this.positions.subarray(j * 3, j * 3 + 3), v * 3);
      col.set([color.r * a1, color.g * a1, color.b * a1], v * 3);
      v++;
    }
    return v;
  }
}
