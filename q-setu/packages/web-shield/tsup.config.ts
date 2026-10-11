import { defineConfig } from "tsup";

// One self-contained, minified file served as /qsetu.js. It runs both as a page script and as the Service Worker.
export default defineConfig({
  entry: { qsetu: "src/browser/qsetu.ts" },
  format: ["iife"],
  minify: true,
  clean: true,
  target: "es2020",
  outDir: "dist",
  noExternal: [/.*/],
  platform: "browser",
  outExtension: () => ({ js: ".js" }),
});
