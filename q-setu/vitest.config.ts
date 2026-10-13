import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web", import.meta.url)),
      // Server modules import "server-only" (it throws if bundled for the browser). Tests run them
      // on the server, so they get the package's react-server build, which is empty.
      "server-only": fileURLToPath(
        new URL("./apps/web/node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/web/test/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
