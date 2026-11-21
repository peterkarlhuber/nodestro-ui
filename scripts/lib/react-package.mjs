// Builds a React component package (packages/<dir>/src/**/*.ts(x) and src/styles.css) in memory, byte-stable:
//
//   dist/**/*.js     ES2022 modules, JSX compiled for the automatic runtime (react/jsx-runtime)
//   dist/**/*.d.ts   type declarations (the public API a consumer type-checks against)
//   dist/styles.css  the package stylesheet, copied unchanged
//
// The TypeScript compiler is the pinned devDependency of the workspace, so the output depends only on the source,
// the compiler version and the options below. The build also type-checks: any diagnostic fails it.
//
// A component package may import another workspace package (`@nodestro/ui-core`); for the type check the name maps
// to that package's source, the emitted import stays the package name (a peer dependency of the consumer).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACKAGES = join(ROOT, "packages");

/** The compiler options of every component package (also used by the editor through packages/<dir>/tsconfig.json). */
export const COMPILER_OPTIONS = {
  target: "ES2022",
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  module: "ESNext",
  moduleResolution: "Bundler",
  jsx: "react-jsx",
  strict: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  noFallthroughCasesInSwitch: true,
  isolatedModules: true,
  verbatimModuleSyntax: true,
  declaration: true,
  skipLibCheck: true,
  newLine: "lf",
  removeComments: false,
  types: [],
};

function sourceFiles(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
    });
}

/** The workspace packages a component package may import, name -> its src/index.ts (for the type check only). */
function workspacePaths() {
  const paths = {};
  for (const dir of readdirSync(PACKAGES).sort()) {
    const pkgFile = join(PACKAGES, dir, "package.json");
    const index = join(PACKAGES, dir, "src", "index.ts");
    try {
      const { name } = JSON.parse(readFileSync(pkgFile, "utf-8"));
      statSync(index);
      paths[name] = [index];
    } catch {
      // not a component package
    }
  }
  return paths;
}

function convert(options) {
  const { options: converted, errors } = ts.convertCompilerOptionsFromJson(options, ROOT);
  if (errors.length) throw new Error(ts.formatDiagnostics(errors, formatHost()));
  return converted;
}

function formatHost() {
  return { getCanonicalFileName: (f) => f, getCurrentDirectory: () => ROOT, getNewLine: () => "\n" };
}

/** Map(relative path -> Buffer) of the generated files of the package in `dir`. */
export function buildReactPackage(dir) {
  const src = join(dir, "src");
  const files = sourceFiles(src);
  const options = {
    ...convert({ ...COMPILER_OPTIONS, lib: undefined }),
    lib: COMPILER_OPTIONS.lib,
    rootDir: PACKAGES,
    outDir: join(ROOT, ".build-out"),
    baseUrl: ROOT,
    paths: workspacePaths(),
    noEmitOnError: true,
  };
  const host = ts.createCompilerHost(options);
  const emitted = new Map();
  host.writeFile = (fileName, text) => emitted.set(fileName, text);
  const program = ts.createProgram({ rootNames: files, options, host });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    throw new Error(`${relative(ROOT, dir)}: type errors\n${ts.formatDiagnostics(diagnostics, formatHost())}`);
  }
  const result = program.emit();
  if (result.emitSkipped || result.diagnostics.length) {
    throw new Error(ts.formatDiagnostics(result.diagnostics, formatHost()));
  }
  // Only the files of this package; imports of another workspace package were type-checked against its source.
  const own = join(options.outDir, relative(PACKAGES, src)) + sep;
  const out = new Map();
  for (const [fileName, text] of [...emitted].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!fileName.startsWith(own)) continue;
    const path = `dist/${fileName.slice(own.length).split(sep).join("/")}`;
    if (/sourceMappingURL/.test(text)) throw new Error(`${path}: unexpected source map reference`);
    out.set(path, Buffer.from(text.endsWith("\n") ? text : `${text}\n`, "utf-8"));
  }
  out.set("dist/styles.css", readFileSync(join(src, "styles.css")));
  return out;
}
