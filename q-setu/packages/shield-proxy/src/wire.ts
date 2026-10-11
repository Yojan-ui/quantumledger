/** Ring buffer of frames seen on the Shield ↔ Shield link: what an eavesdropper would record. */
export interface WireFrame {
  at: string;
  kind: "client-hello" | "server-hello" | "client-finish" | "request" | "response";
  bytes: number;
  preview: string;
  epoch?: number;
  seq?: number;
}

export class WireLog {
  private frames: WireFrame[] = [];
  constructor(private readonly max = 50) {}

  push(frame: Omit<WireFrame, "at">): void {
    this.frames.push({ at: new Date().toISOString(), ...frame });
    if (this.frames.length > this.max) this.frames.shift();
  }

  list(): WireFrame[] {
    return [...this.frames];
  }
}

export function previewB64(b64: string, n = 48): string {
  const bin = globalThis.atob(b64.slice(0, Math.ceil((n / 2) * 1.4)));
  let hex = "";
  for (let i = 0; i < bin.length && hex.length < n; i++)
    hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
  return `${hex}…`;
}
