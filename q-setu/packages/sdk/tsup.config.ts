import { defineConfig } from "tsup";

// Publishable ESM build. @qsetu/core is bundled in; the audited @noble libraries stay as dependencies.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  noExternal: ["@qsetu/core"],
});
