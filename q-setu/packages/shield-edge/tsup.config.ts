import { defineConfig } from "tsup";

// One self-contained file for the container: every dependency bundled, Node built-ins left out.
export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  clean: true,
  target: "node24",
  platform: "node",
  noExternal: [/.*/],
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});
