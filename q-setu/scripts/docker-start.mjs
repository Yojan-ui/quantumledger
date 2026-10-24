/**
 * The container's entrypoint: runs the Next web app and the Attack Lab engine together, so a single
 * public deployment serves the site, the real-TLS scanner and a populated Lab. The engine listens on
 * loopback inside the container (LAB_PORT, default 4100); the web app reaches it via ATTACK_LAB_API.
 * If either process exits, the container exits, so the platform restarts it.
 */
import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function stop(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(code), 2000).unref();
}

function run(name, args, env) {
  const child = spawn("pnpm", args, { stdio: "inherit", env: { ...process.env, ...env } });
  child.on("exit", (code, signal) => {
    console.log(`[${name}] exited (code ${code ?? "null"}, signal ${signal ?? "none"})`);
    stop(code ?? 0);
  });
  children.push(child);
}

process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));

// The Attack Lab engine (loopback only). Seeded so the Lab is populated in production.
run("lab", ["--filter", "@qsetu/attack-lab", "start"], { ATTACK_LAB_SEED: "1" });
// The web app + API.
run("web", ["--filter", "@qsetu/web", "start"]);
