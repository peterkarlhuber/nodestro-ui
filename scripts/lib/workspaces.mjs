// The packages of this repository and how each one becomes a tarball.
//
// Contract for a package under packages/<dir>/: package.json (private, no scripts, "files" lists what ships),
// README.md, and either lib/build.mjs exporting buildFiles(dir) -> Map(relative path -> Buffer) for the generated
// files (data packages: tokens, themes) or src/index.ts (component packages: compiled by scripts/lib/react-package.mjs).
// The tarball holds package.json, README.md, the repository LICENSE and the generated files, nothing else.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildReactPackage } from "./react-package.mjs";
import { gzipStored, integrity, sha256, tar } from "./tarball.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MANIFEST = join(ROOT, "artifacts", "manifest.json");

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** Workspace directories (relative to the root), sorted. Only the packages/* pattern is supported. */
export function workspaceDirs() {
  const { workspaces } = readJson(join(ROOT, "package.json"));
  if (JSON.stringify(workspaces) !== JSON.stringify(["packages/*"])) {
    throw new Error('root package.json: workspaces must be ["packages/*"]');
  }
  return readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROOT, "packages", d.name, "package.json")))
    .map((d) => `packages/${d.name}`)
    .sort();
}

/** npm's tarball name: @scope/name 1.2.3 -> scope-name-1.2.3.tgz */
export function tarballName(name, version) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

/** The generated files of one package (absolute directory): Map(relative path -> Buffer). */
export async function buildPackage(abs) {
  if (existsSync(join(abs, "lib", "build.mjs"))) {
    const { buildFiles } = await import(pathToFileURL(join(abs, "lib", "build.mjs")).href);
    return buildFiles(abs);
  }
  if (existsSync(join(abs, "src", "index.ts"))) return buildReactPackage(abs);
  throw new Error(`${abs}: neither lib/build.mjs nor src/index.ts`);
}

/** The files of one package as they go into the tarball. */
export async function packageFiles(dir) {
  const abs = join(ROOT, dir);
  const files = new Map([
    ["package.json", readFileSync(join(abs, "package.json"))],
    ["README.md", readFileSync(join(abs, "README.md"))],
    ["LICENSE", readFileSync(join(ROOT, "LICENSE"))],
  ]);
  const shipped = readJson(join(abs, "package.json")).files ?? [];
  for (const [path, data] of await buildPackage(abs)) {
    if (!shipped.some((f) => path === f || (f.endsWith("/") && path.startsWith(f)))) {
      throw new Error(`${dir}: ${path} is built but not listed in "files"`);
    }
    files.set(path, data);
  }
  return files;
}

/** One package as { name, version, directory, file, tarball }. */
export async function packWorkspace(dir) {
  const { name, version } = readJson(join(ROOT, dir, "package.json"));
  const tarball = gzipStored(tar(await packageFiles(dir)));
  return { name, version, directory: dir, file: tarballName(name, version), tarball };
}

export function manifestEntry({ name, version, directory, file, tarball }) {
  return { name, version, directory, file, size: tarball.length, sha256: sha256(tarball), integrity: integrity(tarball) };
}

export function manifestText(packs) {
  return `${JSON.stringify({ format: 1, packages: packs.map(manifestEntry) }, null, 2)}\n`;
}

export async function packAll() {
  const packs = [];
  for (const dir of workspaceDirs()) packs.push(await packWorkspace(dir));
  return packs;
}
