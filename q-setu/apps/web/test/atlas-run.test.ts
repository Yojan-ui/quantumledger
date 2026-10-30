import { afterEach, describe, expect, it, vi } from "vitest";
import { atlas } from "@/lib/client/atlas";
import { atlasRun, getAtlasRun } from "@/lib/client/atlas-run";

afterEach(() => {
  atlasRun.dispose();
  vi.restoreAllMocks();
});
describe("pipeline run lifecycle", () => {
  it("resets statuses when switching workspace and prevents concurrent start posts", async () => {
    vi.spyOn(atlas, "stages").mockResolvedValue({
      stages: [{ id: "detect", label: "Detect", plain: "", steps: ["detect"] }],
    });
    vi.spyOn(atlas, "runs").mockResolvedValue({ active: null, runs: [] });
    vi.spyOn(atlas, "runEvents").mockImplementation((_ws, _id, on) => {
      on({ seq: 1, ts: 1, type: "step_end", step: "detect", exit_code: 0 });
      return () => {};
    });
    await atlasRun.init("one", true);
    atlasRun.follow("one", "old");
    expect(getAtlasRun().status).toEqual(["done"]);
    await atlasRun.init("two", true);
    expect(getAtlasRun().status).toEqual(["idle"]);
    let finish!: (r: { run_id: string }) => void;
    const start = vi.spyOn(atlas, "startRun").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = atlasRun.start();
    await atlasRun.start();
    expect(start).toHaveBeenCalledTimes(1);
    finish({ run_id: "new" });
    await first;
  });
});
