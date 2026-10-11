import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  clean: true,
  target: "node20",
  platform: "node",
  noExternal: ["@qsetu/core", "@qsetu/sdk"],
  banner: { js: "#!/usr/bin/env node" },
});
