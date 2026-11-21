// Browser checks in Chrome (playwright-core, no browser download): axe-core without A/AA violations and the visual
// snapshot of the approval card per brand. Needs Google Chrome or Chromium (CHROME_PATH, or a standard location).
import { defineConfig } from "vitest/config";
import { alias } from "./vitest.config.mjs";

export default defineConfig({
  resolve: { alias },
  esbuild: { jsx: "automatic" },
  test: {
    name: "browser",
    environment: "node",
    include: ["test/browser/**/*.test.{ts,tsx}"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
