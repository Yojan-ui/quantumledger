/**
 * Device budget simulation for QuantumLedger Edge. RAM is *accounted*, not measured: we sum the bytes
 * of every key, buffer and piece of session state the device must hold (JS heap can't be capped).
 * CPU is throttled by spinning `slowdown − 1` times as long as each operation took, which emulates
 * a slower microcontroller inside a Web Worker.
 */
export interface Budget {
  ramBytes: number;
  /** 1 = this machine's speed. 20 ≈ a Cortex-M4-class device running the same pure-JS code. */
  cpuSlowdown: number;
}

export class BudgetExceeded extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceeded";
  }
}

export class BudgetMeter {
  private live = new Map<string, number>();
  peak = 0;
  cpuMs = 0;
  simulatedMs = 0;

  constructor(readonly budget: Budget) {}

  get used(): number {
    let n = 0;
    for (const v of this.live.values()) n += v;
    return n;
  }

  hold(label: string, bytes: number): void {
    this.live.set(label, bytes);
    this.peak = Math.max(this.peak, this.used);
    if (this.used > this.budget.ramBytes) {
      throw new BudgetExceeded(
        `RAM budget exceeded: ${this.used} B needed, ${this.budget.ramBytes} B available (${label})`,
      );
    }
  }

  release(label: string): void {
    this.live.delete(label);
  }

  /** Run `fn`, then stall to emulate a slower CPU. Returns fn's result. */
  run<T>(fn: () => T): T {
    const t = performance.now();
    const out = fn();
    const dt = performance.now() - t;
    const stall = dt * (this.budget.cpuSlowdown - 1);
    const until = performance.now() + stall;
    while (performance.now() < until) {
      /* spin: emulates a slower device */
    }
    this.cpuMs += dt;
    this.simulatedMs += dt * this.budget.cpuSlowdown;
    return out;
  }
}
