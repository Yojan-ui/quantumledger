import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "apps/web/**", "test-results/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        performance: "readonly",
      },
    },
  },
  {
    // tools/*.mjs are Node scripts that also pass functions into the page (page.evaluate / addInitScript).
    files: ["tools/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        performance: "readonly",
        window: "readonly",
        document: "readonly",
        location: "readonly",
        localStorage: "readonly",
        innerWidth: "readonly",
      },
    },
  },
  {
    // record-demo.mjs passes functions into the page with page.evaluate (browser globals).
    files: ["scripts/record-demo.mjs"],
    languageOptions: {
      globals: { window: "readonly", document: "readonly", requestAnimationFrame: "readonly" },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
);
