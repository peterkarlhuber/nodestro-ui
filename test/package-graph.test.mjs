// The package graph: no package depends on a product (nodestro-studio or any other), and tokens depends on nothing.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { ROOT, readJson, workspaceDirs } from "../scripts/lib/workspaces.mjs";

// Products and applications. A library package must never depend on one of them, in any form.
const PRODUCTS = /(^|[/@:])(nodestro-(studio|api|app-ui|desktop|cloud|server|runtime|examples|integrations|local-docker)|axentra(-studio)?|tabrion(-studio)?|locria[\w-]*|levuvo-mail|orkexa)($|[/#.@])/i;
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "bundleDependencies", "bundledDependencies"];
// External (non-workspace) dependencies each package may declare. Adding one is a reviewed change to this list.
const ALLOWED_EXTERNAL = { "packages/tokens": [] };

const root = readJson(join(ROOT, "package.json"));
const lock = readJson(join(ROOT, "package-lock.json"));
const workspaces = workspaceDirs().map((dir) => ({ dir, pkg: readJson(join(ROOT, dir, "package.json")) }));
const workspaceNames = new Set(workspaces.map((w) => w.pkg.name));

function deps(pkg) {
  const out = [];
  for (const field of DEP_FIELDS) {
    const value = pkg[field];
    if (!value) continue;
    const entries = Array.isArray(value) ? value.map((n) => [n, ""]) : Object.entries(value);
    for (const [name, spec] of entries) out.push({ field, name, spec: String(spec) });
  }
  return out;
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "dist") return [];
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("package graph", () => {
  it("every workspace package is scoped, private and has an allowlist entry", () => {
    assert.ok(workspaces.length >= 1);
    for (const { dir, pkg } of workspaces) {
      assert.match(pkg.name, /^@nodestro\/ui-[a-z]+$/, `${dir}: unexpected name ${pkg.name}`);
      assert.equal(pkg.private, true, `${dir}: must be private (no registry publish)`);
      assert.ok(dir in ALLOWED_EXTERNAL, `${dir}: add it to ALLOWED_EXTERNAL`);
    }
  });

  it("no package.json names a product as a dependency", () => {
    for (const pkg of [root, ...workspaces.map((w) => w.pkg)]) {
      for (const d of deps(pkg)) {
        assert.doesNotMatch(d.name, PRODUCTS, `${pkg.name}: ${d.field} ${d.name}`);
        assert.doesNotMatch(d.spec, PRODUCTS, `${pkg.name}: ${d.field} ${d.name}@${d.spec}`);
      }
    }
  });

  it("packages depend only on other workspace packages and their allowlist, never by path or git", () => {
    for (const { dir, pkg } of workspaces) {
      for (const d of deps(pkg)) {
        assert.ok(workspaceNames.has(d.name) || ALLOWED_EXTERNAL[dir].includes(d.name), `${dir}: ${d.field} ${d.name} not allowed`);
        assert.doesNotMatch(d.spec, /^(file:|link:|git|github:|https?:)/, `${dir}: ${d.name} uses ${d.spec}`);
      }
    }
  });

  it("tokens has no dependencies of any kind and no scripts", () => {
    const tokens = workspaces.find((w) => w.dir === "packages/tokens").pkg;
    assert.deepEqual(deps(tokens), []);
    assert.equal(tokens.scripts, undefined, "shipped package.json must not have (install) scripts");
  });

  it("no shipped package.json has scripts", () => {
    for (const { dir, pkg } of workspaces) assert.equal(pkg.scripts, undefined, `${dir} has scripts`);
  });

  it("the lockfile resolves no product and nothing outside the registry and the workspace", () => {
    assert.equal(lock.lockfileVersion, 3);
    for (const [path, entry] of Object.entries(lock.packages)) {
      assert.doesNotMatch(path, PRODUCTS, `lockfile entry ${path}`);
      if (entry.link) {
        assert.match(entry.resolved, /^packages\/[a-z]+$/, `${path} links outside the workspace`);
      } else if (entry.resolved) {
        assert.match(entry.resolved, /^https:\/\/registry\.npmjs\.org\//, `${path} resolves to ${entry.resolved}`);
        assert.ok(entry.integrity, `${path} has no integrity`);
      }
    }
  });

  it("no package source imports a product or a file outside its own package", () => {
    const builtins = new Set(builtinModules);
    for (const { dir, pkg } of workspaces) {
      const base = resolve(ROOT, dir);
      for (const file of files(base).filter((f) => /\.(m?[jt]sx?|css)$/.test(f))) {
        const text = readFileSync(file, "utf-8");
        const specifiers = [
          ...text.matchAll(/\bfrom\s+["']([^"']+)["']/g),
          ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
          ...text.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
          ...text.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g),
        ].map((m) => m[1]);
        for (const spec of specifiers) {
          const where = `${relative(ROOT, file)}: ${spec}`;
          assert.doesNotMatch(spec, PRODUCTS, where);
          if (spec.startsWith(".")) {
            const target = resolve(file, "..", spec);
            assert.ok(target.startsWith(base + "/"), `${where} leaves the package`);
          } else {
            const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
            assert.ok(
              spec.startsWith("node:") || builtins.has(name) || workspaceNames.has(name) || deps(pkg).some((d) => d.name === name),
              `${where} is not a declared dependency`,
            );
          }
        }
      }
    }
  });
});
