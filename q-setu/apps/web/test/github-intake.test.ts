import { afterEach, describe, expect, it, vi } from "vitest";
import { atlas, AtlasError } from "@/lib/client/atlas";
import { cloneGitHub, githubRepo, intakeError } from "@/lib/client/github-intake";

afterEach(() => vi.restoreAllMocks());
describe("GitHub intake", () => {
  it("normalises public repo roots", () => {
    expect(githubRepo(" https://github.com/org/repo.git/ ")).toBe("https://github.com/org/repo");
  });
  it.each([
    "https://gitlab.com/o/r",
    "http://github.com/o/r",
    "https://token@github.com/o/r",
    "https://github.com/o/r?token=secret",
    "https://github.com/o/r#secret",
    "https://github.com/o/r/tree/main",
    "https://github.com/o",
    "https://github.com:444/o/r",
    "not a URL",
  ])("rejects unsafe or unsupported URL %s", (url) => {
    expect(() => githubRepo(url)).toThrow();
  });
  it("creates an empty workspace then clones through the typed client", async () => {
    const create = vi.spyOn(atlas, "createWorkspace").mockResolvedValue({} as never);
    const clone = vi
      .spyOn(atlas, "clone")
      .mockResolvedValue({ url: "https://github.com/o/r", commit: "a".repeat(40), files: 3 });
    const start = vi.spyOn(atlas, "startRun");
    const result = await cloneGitHub("https://github.com/o/r", vi.fn());
    expect(result.id).toMatch(/^github-[a-f0-9-]+$/);
    expect(create).toHaveBeenCalledWith(result.id, "o/r", "empty");
    expect(clone).toHaveBeenCalledWith(result.id, "https://github.com/o/r");
    expect(start).not.toHaveBeenCalled(); // manifests must be inspected first
  });
  it("bad input never creates a workspace", async () => {
    const create = vi.spyOn(atlas, "createWorkspace");
    await expect(cloneGitHub("https://token@github.com/o/r", vi.fn())).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it("explains private-repo and backend-down errors", () => {
    expect(intakeError(new AtlasError(502, "clone_failed", "fatal"))).toMatch(
      /Private repositories/,
    );
    expect(intakeError(new AtlasError(503, "atlas_down", "down"))).toMatch(/unavailable/);
  });
});
