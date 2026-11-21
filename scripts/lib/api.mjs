// The public surface of each package, as products depend on it: the exports map, the type declarations of the
// component packages (one entry per top-level declaration), the i18n keys, the CSS classes, the token names and the
// brand names. Recorded in api/<package>.json; test/api-contract.test.mjs compares it with the last recorded version
// on the base branch, so a change that can break a product needs a matching version bump.
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT, buildPackage, readJson } from "./workspaces.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

/** Top-level declarations of a .d.ts text, comments removed and whitespace normalized. */
export function declarations(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  return source.statements
    .map((statement) => printer.printNode(ts.EmitHint.Unspecified, statement, source).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const sorted = (values) => [...new Set(values)].sort();

/** The surface of the package in `dir` (relative to the repository root). */
export async function surface(dir) {
  const abs = join(ROOT, dir);
  const pkg = readJson(join(abs, "package.json"));
  const files = await buildPackage(abs);
  const out = { name: pkg.name, version: pkg.version, exports: pkg.exports ?? {}, peerDependencies: pkg.peerDependencies ?? {} };
  const dts = [...files.keys()].filter((path) => path.endsWith(".d.ts") && !path.startsWith("dist/locales/")).sort();
  if (dts.length) {
    out.declarations = Object.fromEntries(dts.map((path) => [path.slice("dist/".length), declarations(path, files.get(path).toString("utf-8"))]));
    const en = files.get("dist/locales/en.js")?.toString("utf-8") ?? "";
    out.messages = sorted([...en.matchAll(/^\s*"([a-z][\w.-]*)":/gm)].map((m) => m[1]));
    out.classes = sorted([...(files.get("dist/styles.css")?.toString("utf-8") ?? "").matchAll(/\.(ui-[a-z0-9_-]+)/g)].map((m) => m[1]));
  }
  if (files.has("dist/tokens.json")) {
    const tokens = JSON.parse(files.get("dist/tokens.json").toString("utf-8"));
    out.tokens = Object.entries(tokens.tokens).map(([name, t]) => `${t.cssVar} ${t.type}${t.values ? " themed" : ""}`).sort();
    out.selectors = tokens.selectors;
  }
  if (files.has("dist/themes.json")) {
    out.brands = Object.keys(JSON.parse(files.get("dist/themes.json").toString("utf-8")).brands).sort();
  }
  return out;
}

export function apiFile(dir) {
  return join(ROOT, "api", `${dir.split("/").pop()}.json`);
}

export function apiText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Every listed item of a surface as "section: item" (objects flattened to key=value). */
function items(value) {
  const out = [];
  for (const [section, content] of Object.entries(value)) {
    if (section === "name" || section === "version") continue;
    if (Array.isArray(content)) for (const item of content) out.push(`${section}: ${item}`);
    else if (content && typeof content === "object") {
      for (const [key, inner] of Object.entries(content)) {
        if (Array.isArray(inner)) for (const item of inner) out.push(`${section}/${key}: ${item}`);
        else out.push(`${section}/${key}: ${JSON.stringify(inner)}`);
      }
    }
  }
  return out;
}

function parse(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`not a plain semver version: ${version}`);
  return m.slice(1).map(Number);
}

/**
 * The bump a change needs and whether the version change provides it. Removing or changing anything is breaking
 * (a new major version, or a new minor version below 1.0, where the minor is the compatibility line of a caret
 * range); only adding is compatible (any higher version).
 */
export function compare(base, current) {
  const before = new Set(items(base));
  const after = new Set(items(current));
  const removed = [...before].filter((item) => !after.has(item));
  const added = [...after].filter((item) => !before.has(item));
  const [bMajor, bMinor, bPatch] = parse(base.version);
  const [cMajor, cMinor, cPatch] = parse(current.version);
  const higher = cMajor > bMajor || (cMajor === bMajor && (cMinor > bMinor || (cMinor === bMinor && cPatch > bPatch)));
  const breakingBump = bMajor === 0 ? cMajor > 0 || cMinor > bMinor : cMajor > bMajor;
  let problem = null;
  if (!higher && (removed.length || added.length)) problem = `the surface changed but the version stayed ${current.version}`;
  else if (removed.length && !breakingBump) {
    problem = `removed or changed items need ${bMajor === 0 ? `0.${bMinor + 1}.0` : `${bMajor + 1}.0.0`} or higher, got ${current.version}`;
  } else if (!higher && current.version !== base.version) problem = `the version went down from ${base.version} to ${current.version}`;
  return { removed, added, problem };
}
