// Pages for the browser checks: the components rendered on the server (react-dom/server) with the stylesheets a
// product loads (tokens, a brand theme, core and ai styles), opened in Chrome through playwright-core.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const BRANDS = ["neutral", "nodestro", "example"] as const;
export const THEMES = ["light", "dark"] as const;
export type Brand = (typeof BRANDS)[number];
export type Theme = (typeof THEMES)[number];

const require = createRequire(import.meta.url);
export const AXE_SOURCE: string = require("axe-core").source;

const CHROME_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/opt/google/chrome/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

/** Chrome or Chromium: CHROME_PATH, else a standard location. A missing browser fails the run (no silent skip). */
export function chromePath(): string {
  const found = [process.env.CHROME_PATH, ...CHROME_CANDIDATES].find((path) => path && existsSync(path));
  if (!found) throw new Error("No Chrome or Chromium found; set CHROME_PATH");
  return found;
}

export async function launch(): Promise<Browser> {
  return chromium.launch({ executablePath: chromePath(), args: ["--font-render-hinting=none", "--disable-lcd-text"] });
}

async function buildFiles(dir: string): Promise<Map<string, Buffer>> {
  const { buildPackage } = await import(join(ROOT, "scripts/lib/workspaces.mjs"));
  return buildPackage(join(ROOT, dir));
}

const cache = new Map<string, string>();

/** The stylesheets in the order a product loads them. */
export async function stylesheet(brand: Brand): Promise<string> {
  if (!cache.has(brand)) {
    const tokens = await buildFiles("packages/tokens");
    const themes = await buildFiles("packages/themes");
    const parts = [
      tokens.get("dist/tokens.css"),
      themes.get(`dist/${brand}.css`),
      readFileSync(join(ROOT, "packages/core/src/styles.css")),
      readFileSync(join(ROOT, "packages/ai/src/styles.css")),
    ];
    if (parts.some((p) => !p)) throw new Error(`missing stylesheet for ${brand}`);
    cache.set(brand, parts.map(String).join("\n"));
  }
  return cache.get(brand)!;
}

const BASE = `
body { margin: 0; padding: 24px; background: var(--ui-color-bg); color: var(--ui-color-text); font-family: var(--ui-font-sans); }
main { display: flex; flex-direction: column; gap: 16px; max-width: 760px; }
`;

export async function open(page: Page, element: ReactElement, brand: Brand, theme: Theme, title = "Fixture"): Promise<void> {
  const html = `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><title>${title}</title>
<style>${await stylesheet(brand)}\n${BASE}</style></head><body><main>${renderToStaticMarkup(element)}</main></body></html>`;
  await page.setContent(html, { waitUntil: "load" });
}
