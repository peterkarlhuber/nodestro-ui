// Builds the brand themes from src/brands/<name>.json:
//   dist/<name>.css   the token values of the brand that differ from the neutral default, with the selectors of
//                     @nodestro/ui-tokens (load it after tokens.css)
//   dist/themes.json  every brand's overrides as data
// A brand sets semantic roles only (and may set global scales such as radii and durations); it can never add a
// token. Validation uses the token source of the workspace package @nodestro/ui-tokens (read, not imported).
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

export const SELECTORS = {
  light: ":root,\n[data-theme='light']",
  dark: "[data-theme='dark']",
  systemDark: ":root:not([data-theme='light'])",
};
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const COLOR = /^(#[0-9a-fA-F]{6}|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1|0?\.\d+)\))$/;
const UNSAFE = /[;{}<>]|\/\*|\*\//;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** The token source of @nodestro/ui-tokens (src/tokens.json) through the workspace link. */
export function loadTokenSource() {
  const dir = dirname(require.resolve("@nodestro/ui-tokens/package.json"));
  return { tokens: readJson(join(dir, "src", "tokens.json")), contrast: readJson(join(dir, "src", "contrast-pairs.json")) };
}

/** Every brand, sorted by name: { name, description, tokens }. */
export function loadBrands(dir = PACKAGE_DIR) {
  const folder = join(dir, "src", "brands");
  return readdirSync(folder)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: f, ...readJson(join(folder, f)) }));
}

/** Throws on the first problems: unknown token, missing theme, bad value, file name and brand name differ. */
export function validateBrand(brand, source = loadTokenSource().tokens) {
  const problems = [];
  if (!NAME.test(brand.name ?? "")) problems.push(`bad brand name ${brand.name}`);
  if (brand.file && brand.file !== `${brand.name}.json`) problems.push(`${brand.file}: name must be ${brand.file.replace(/\.json$/, "")}`);
  if (typeof brand.description !== "string" || brand.description.length < 10) problems.push(`${brand.name}: no description`);
  for (const [name, value] of Object.entries(brand.tokens ?? {})) {
    const token = source.tokens[name];
    if (!token) {
      problems.push(`${brand.name}: unknown token ${name}`);
      continue;
    }
    const themed = "values" in token;
    if (themed) {
      if (typeof value !== "object" || value === null) problems.push(`${brand.name}: ${name} needs a light and a dark value`);
      else if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...source.themes].sort()))
        problems.push(`${brand.name}: ${name} needs exactly ${source.themes.join(" and ")}`);
    } else if (typeof value !== "string") problems.push(`${brand.name}: ${name} is global and takes one value`);
    const values = themed && typeof value === "object" && value ? Object.values(value) : [value];
    for (const v of values) {
      if (typeof v !== "string" || UNSAFE.test(v)) problems.push(`${brand.name}: ${name} has an unsafe value ${v}`);
      else if (token.type === "color" && !COLOR.test(v)) problems.push(`${brand.name}: ${name} must be #rrggbb or rgba(r, g, b, a), got ${v}`);
    }
    if (token.type === "duration" && "reducedMotion" in token && typeof value === "string" && !/^\d+ms$/.test(value))
      problems.push(`${brand.name}: ${name} must be a duration in ms`);
  }
  if (problems.length) throw new Error(`invalid brand:\n  ${problems.join("\n  ")}`);
}

/** The full theme of a brand: the default values with the brand's overrides, per theme. */
export function resolveBrand(brand, source = loadTokenSource().tokens) {
  const out = {};
  for (const theme of source.themes) {
    out[theme] = {};
    for (const [name, token] of Object.entries(source.tokens)) {
      const own = brand.tokens?.[name];
      out[theme][name] = "values" in token ? (own?.[theme] ?? token.values[theme]) : (own ?? token.value);
    }
  }
  return out;
}

function block(selector, lines, indent = "") {
  return `${indent}${selector.replaceAll("\n", `\n${indent}`)} {\n${lines.map((l) => `${indent}  ${l}\n`).join("")}${indent}}\n`;
}

export function renderBrandCss(brand, version, source = loadTokenSource().tokens) {
  const prefix = source.prefix;
  const entries = Object.entries(brand.tokens ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const globals = entries.filter(([name]) => "value" in source.tokens[name]);
  const themed = entries.filter(([name]) => "values" in source.tokens[name]);
  const line = (name, value) => `--${prefix}-${name}: ${value};`;
  const parts = [
    `/* ui-themes ${version}, brand "${brand.name}". Generated from src/brands/${brand.name}.json: do not edit.\n` +
      `   Load after @nodestro/ui-tokens/tokens.css. ${entries.length ? `${entries.length} tokens differ from the neutral default.` : "The neutral default: no overrides."} */\n`,
  ];
  if (globals.length) parts.push(block(":root", globals.map(([n, v]) => line(n, v))));
  if (themed.length) {
    const lines = (theme) => themed.map(([n, v]) => line(n, v[theme]));
    parts.push(block(SELECTORS.light, lines("light")));
    parts.push(block(SELECTORS.dark, lines("dark")));
    parts.push(`@media (prefers-color-scheme: dark) {\n${block(SELECTORS.systemDark, lines("dark"), "  ")}}\n`);
  }
  // A brand duration must still give way to reduced motion (the base stylesheet's rule would lose to this one).
  const motion = globals.filter(([name]) => "reducedMotion" in source.tokens[name]);
  if (motion.length) {
    const lines = motion.map(([name]) => line(name, source.tokens[name].reducedMotion));
    parts.push(`@media (prefers-reduced-motion: reduce) {\n${block(":root", lines, "  ")}}\n`);
  }
  return parts.join("\n");
}

/** Every generated file as path (relative to the package) -> Buffer. */
export function buildFiles(dir = PACKAGE_DIR) {
  const { version } = readJson(join(dir, "package.json"));
  const source = loadTokenSource().tokens;
  const brands = loadBrands(dir);
  const files = new Map();
  const data = { format: 1, version, brands: {} };
  for (const brand of brands) {
    validateBrand(brand, source);
    files.set(`dist/${brand.name}.css`, Buffer.from(renderBrandCss(brand, version, source), "utf-8"));
    data.brands[brand.name] = { description: brand.description, tokens: brand.tokens ?? {} };
  }
  files.set("dist/themes.json", Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf-8"));
  return new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
