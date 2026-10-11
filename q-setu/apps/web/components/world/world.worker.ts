/// <reference lib="webworker" />
/** Builds the globe's land dots off the main thread. */
import { sampleLand } from "./shapes";

self.onmessage = async (e: MessageEvent<{ maskUrl: string; candidates: number }>) => {
  const { maskUrl, candidates } = e.data;
  const bmp = await createImageBitmap(await (await fetch(maskUrl)).blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  const dots = sampleLand(
    ctx.getImageData(0, 0, bmp.width, bmp.height).data,
    bmp.width,
    bmp.height,
    candidates,
  );
  postMessage({ dots }, [dots.positions.buffer, dots.india.buffer, dots.seed.buffer]);
};
