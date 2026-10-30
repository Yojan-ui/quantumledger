import { AtlasError, atlas } from "./atlas";

/** Public GitHub repository roots only. Credentials, query tokens and arbitrary hosts are refused. */
export function githubRepo(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a public GitHub URL: https://github.com/owner/repo");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(url.pathname)
  )
    throw new Error(
      "Use a public https://github.com/owner/repo URL without credentials, tokens or a branch path.",
    );
  const path = url.pathname.replace(/\/$/, "").replace(/\.git$/, "");
  if (path.split("/").some((p) => p === "." || p === ".."))
    throw new Error("Enter a repository owner and name.");
  return `https://github.com${path}`;
}

export function intakeError(error: unknown): string {
  if (error instanceof AtlasError) {
    if (error.code === "clone_failed")
      return "Could not clone this repository. Check the name and make sure it is public. Private repositories are not supported; no token is accepted.";
    if (error.code === "atlas_down")
      return "Atlas is unavailable. Start the backend on port 8100, then retry.";
    if (error.status === 401 || error.status === 403)
      return "Sign in with an Atlas operator account to scan a repository.";
    if (error.code === "manifests_unconfirmed")
      return "This repository contains suggested service manifests. Review and confirm them before running.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Could not reach Atlas. Try again.";
}

export async function cloneGitHub(input: string, onProgress: (message: string) => void) {
  const url = githubRepo(input);
  const id = `github-${crypto.randomUUID().slice(0, 20)}`;
  onProgress("Creating an empty workspace…");
  await atlas.createWorkspace(id, url.split("/").slice(-2).join("/"), "empty");
  onProgress("Cloning public source…");
  const source = await atlas.clone(id, url);
  return { id, source };
}
