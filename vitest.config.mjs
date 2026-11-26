// Component tests (jsdom): behaviour, keyboard, ARIA and i18n of @nodestro/ui-core and @nodestro/ui-ai, run against
// the package sources. The browser checks (axe, visual snapshots per brand) have their own config.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const at = (path) => fileURLToPath(new URL(path, import.meta.url));

export const alias = {
  "@nodestro/ui-core": at("./packages/core/src/index.ts"),
  "@nodestro/ui-ai": at("./packages/ai/src/index.ts"),
  "@nodestro/ui-help": at("./packages/help/src/index.ts"),
};

export default defineConfig({
  resolve: { alias },
  esbuild: { jsx: "automatic" },
  test: {
    name: "components",
    environment: "jsdom",
    include: ["test/components/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
