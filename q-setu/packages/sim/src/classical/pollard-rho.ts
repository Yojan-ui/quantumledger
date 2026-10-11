/**
 * INSECURE_DEMO_ONLY: Pollard's rho factorisation (Brent's variant). Against a 40-bit
 * modulus it finishes in about 2^10 steps, playing the role Shor's algorithm will play
 * against RSA-2048 on a cryptographically relevant quantum computer.
 */
import { gcd, isProbablePrime } from "./tiny-rsa";

export interface FactorResult {
  p: bigint;
  q: bigint;
  iterations: number;
}

export function pollardRho(n: bigint): FactorResult {
  if (n % 2n === 0n) return { p: 2n, q: n / 2n, iterations: 1 };
  if (isProbablePrime(n)) throw new Error("n is prime");
  let iterations = 0;
  for (let c = 1n; ; c++) {
    const f = (x: bigint) => (x * x + c) % n;
    let y = 2n;
    let r = 1;
    let g = 1n;
    let x = y;
    while (g === 1n) {
      x = y;
      for (let i = 0; i < r; i++) y = f(y);
      for (let k = 0; k < r && g === 1n; k++) {
        y = f(y);
        iterations++;
        g = gcd(x > y ? x - y : y - x, n);
      }
      r *= 2;
    }
    if (g !== n) {
      const [p, q] = g < n / g ? [g, n / g] : [n / g, g];
      return { p, q, iterations };
    }
  }
}
