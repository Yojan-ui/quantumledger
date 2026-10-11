/** cubic-bezier(0.22, 1, 0.36, 1): the motion token, solved for y(x). Shared by DOM and 3D motion. */
export function easeToken(x: number): number {
  const [x1, y1, x2, y2] = [0.22, 1, 0.36, 1];
  const bx = (t: number) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
  const by = (t: number) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (bx(mid) < x) lo = mid;
    else hi = mid;
  }
  return by((lo + hi) / 2);
}
