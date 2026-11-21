// Builds the package files from the one source, src/tokens.json:
//   dist/tokens.css          custom properties: globals, light (default), dark, system dark, reduced motion
//   dist/tokens.json         the same tokens as data, resolved per theme
//   dist/contrast-pairs.json the WCAG pairs every theme (also a brand theme) must meet
// The output depends only on the source files and the package version: same input, same bytes.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isHexColor } from "./contrast.mjs";

export const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const TYPES = new Set(["color", "dimension", "duration", "number", "fontFamily", "fontWeight", "cubicBezier", "shadow"]);
const THEME_SELECTORS = {
  light: ":root,\n[data-theme='light']",
  dark: "[data-theme='dark']",
};
export const SYSTEM_DARK_SELECTOR = ":root:not([data-theme='light'])";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function loadSource(dir = PACKAGE_DIR) {
  return {
    version: readJson(join(dir, "package.json")).version,
    tokens: readJson(join(dir, "src", "tokens.json")),
    contrast: readJson(join(dir, "src", "contrast-pairs.json")),
  };
}

/** Throws on the first problem: unknown type, bad name, missing theme value, unsafe value, bad pair. */
export function validate({ tokens: source, contrast }) {
  const problems = [];
  if (source.prefix !== "ui") problems.push(`prefix must be "ui", got ${source.prefix}`);
  if (JSON.stringify(source.themes) !== JSON.stringify(Object.keys(THEME_SELECTORS))) {
    problems.push(`themes must be ${Object.keys(THEME_SELECTORS).join(", ")}`);
  }
  if (!source.themes?.includes(source.defaultTheme)) problems.push(`unknown default theme ${source.defaultTheme}`);
  for (const [name, token] of Object.entries(source.tokens)) {
    if (!NAME.test(name)) problems.push(`${name}: bad name`);
    if (!TYPES.has(token.type)) problems.push(`${name}: unknown type ${token.type}`);
    if (typeof token.description !== "string" || token.description.length < 3) problems.push(`${name}: no description`);
    const themed = "values" in token;
    if (themed === ("value" in token)) problems.push(`${name}: needs exactly one of value or values`);
    const values = themed ? token.values : { all: token.value };
    if (themed) {
      for (const theme of source.themes) if (!(theme in token.values)) problems.push(`${name}: no value for ${theme}`);
      for (const theme of Object.keys(token.values)) {
        if (!source.themes.includes(theme)) problems.push(`${name}: unknown theme ${theme}`);
      }
    }
    for (const value of [...Object.values(values), token.reducedMotion ?? ""]) {
      if (typeof value !== "string") problems.push(`${name}: value must be a string`);
      else if (/[;{}<>]|\/\*|\*\//.test(value)) problems.push(`${name}: unsafe characters in ${value}`);
    }
    if (token.type === "color") {
      for (const value of Object.values(values)) {
        if (!isHexColor(value) && !/^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1|0?\.\d+)\)$/.test(value)) {
          problems.push(`${name}: color must be #rrggbb or rgba(r, g, b, a), got ${value}`);
        }
      }
    }
  }
  for (const { fg, bg, min } of contrast.pairs) {
    for (const name of [fg, bg]) {
      const token = source.tokens[name];
      if (!token) problems.push(`contrast pair: unknown token ${name}`);
      else if (token.type !== "color" || !token.values) problems.push(`contrast pair: ${name} is not a themed color`);
      else for (const v of Object.values(token.values)) if (!isHexColor(v)) problems.push(`contrast pair: ${name} is not opaque`);
    }
    if (min !== 3 && min !== 4.5) problems.push(`contrast pair ${fg}/${bg}: minimum must be 3 or 4.5`);
  }
  if (problems.length) throw new Error(`invalid token source:\n  ${problems.join("\n  ")}`);
}

const cssVar = (prefix, name) => `--${prefix}-${name}`;

function block(selector, lines, indent = "") {
  return `${indent}${selector.replaceAll("\n", `\n${indent}`)} {\n${lines.map((l) => `${indent}  ${l}\n`).join("")}${indent}}\n`;
}

/** The stylesheet. Globals on :root, light on :root (default), dark by attribute and by system setting. */
export function renderCss({ version, tokens: source }) {
  const { prefix } = source;
  const entries = Object.entries(source.tokens);
  const globals = entries.filter(([, t]) => "value" in t);
  const themed = entries.filter(([, t]) => "values" in t);
  const themeLines = (theme) => [
    `color-scheme: ${theme};`,
    ...themed.map(([name, t]) => `${cssVar(prefix, name)}: ${t.values[theme]};`),
  ];
  const parts = [
    `/* ui-tokens ${version}. Generated from src/tokens.json: do not edit.\n` +
      `   Light is the default. Dark: data-theme="dark" on any element, or the system setting when the root has no\n` +
      `   data-theme="light". Every component uses these semantic tokens, never literal colors. */\n`,
    block(":root", globals.map(([name, t]) => `${cssVar(prefix, name)}: ${t.value};`)),
    block(THEME_SELECTORS.light, themeLines("light")),
    block(THEME_SELECTORS.dark, themeLines("dark")),
    `@media (prefers-color-scheme: dark) {\n${block(SYSTEM_DARK_SELECTOR, themeLines("dark"), "  ")}}\n`,
  ];
  const reduced = globals.filter(([, t]) => "reducedMotion" in t);
  if (reduced.length) {
    const lines = reduced.map(([name, t]) => `${cssVar(prefix, name)}: ${t.reducedMotion};`);
    parts.push(`@media (prefers-reduced-motion: reduce) {\n${block(":root", lines, "  ")}}\n`);
  }
  return parts.join("\n");
}

/** The same tokens as data. */
export function renderJson({ version, tokens: source }) {
  const tokens = {};
  for (const [name, t] of Object.entries(source.tokens)) {
    const out = { cssVar: cssVar(source.prefix, name), type: t.type, description: t.description };
    if ("values" in t) out.values = Object.fromEntries(source.themes.map((theme) => [theme, t.values[theme]]));
    else out.value = t.value;
    if ("reducedMotion" in t) out.reducedMotion = t.reducedMotion;
    tokens[name] = out;
  }
  const data = {
    format: 1,
    version,
    prefix: source.prefix,
    themes: source.themes,
    defaultTheme: source.defaultTheme,
    selectors: { ...THEME_SELECTORS, systemDark: SYSTEM_DARK_SELECTOR },
    tokens,
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Every generated file as path (relative to the package) -> Buffer. */
export function buildFiles(dir = PACKAGE_DIR) {
  const source = loadSource(dir);
  validate(source);
  return new Map([
    ["dist/contrast-pairs.json", Buffer.from(`${JSON.stringify(source.contrast, null, 2)}\n`, "utf-8")],
    ["dist/tokens.css", Buffer.from(renderCss(source), "utf-8")],
    ["dist/tokens.json", Buffer.from(renderJson(source), "utf-8")],
  ]);
}
