// How a product consumes a package: a vendored tarball (file:vendor/*.tgz) installed by npm without a registry.
// Checks that npm records the same integrity as artifacts/manifest.json, that the exports resolve, and that a
// tampered tarball fails both the SHA-256 check and npm's integrity check (with a cold cache, as in CI).
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { MANIFEST, packWorkspace, packageFiles } from "../scripts/lib/workspaces.mjs";
import { gzipStored, tar } from "../scripts/lib/tarball.mjs";

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const work = mkdtempSync(join(tmpdir(), "ui-consume-"));
const pack = await packWorkspace("packages/tokens");
const recorded = JSON.parse(readFileSync(MANIFEST, "utf-8")).packages.find((p) => p.name === pack.name);

function project(name, tarball) {
  const dir = join(work, name);
  mkdirSync(join(dir, "vendor"), { recursive: true });
  writeFileSync(join(dir, "vendor", pack.file), tarball);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "consumer", version: "1.0.0", private: true, dependencies: { [pack.name]: `file:vendor/${pack.file}` } }),
  );
  return dir;
}

function npm(dir, args, cache) {
  return spawnSync(NPM, [...args, "--ignore-scripts", "--no-audit", "--no-fund", "--offline", "--cache", cache], {
    cwd: dir,
    encoding: "utf-8",
    shell: process.platform === "win32",
  });
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

describe("consuming the vendored tarball", () => {
  let dir;
  before(() => {
    dir = project("consumer", pack.tarball);
    const result = npm(dir, ["install"], join(work, "cache-install"));
    assert.equal(result.status, 0, result.stderr);
  });
  after(() => rmSync(work, { recursive: true, force: true }));

  it("npm records the integrity from artifacts/manifest.json", () => {
    const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf-8"));
    const entry = lock.packages[`node_modules/${pack.name}`];
    assert.equal(entry.resolved, `file:vendor/${pack.file}`);
    assert.equal(entry.integrity, recorded.integrity);
    assert.equal(entry.version, pack.version);
  });

  it("the exports resolve and the JSON loads", () => {
    const script = `
      import tokens from "${pack.name}/tokens.json" with { type: "json" };
      import { createRequire } from "node:module";
      const require = createRequire(import.meta.url);
      require.resolve("${pack.name}/tokens.css");
      require.resolve("${pack.name}/contrast-pairs.json");
      console.log(tokens.prefix, Object.keys(tokens.tokens).length);`;
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: dir, encoding: "utf-8" });
    assert.match(out, /^ui \d+\n$/);
  });

  it("npm ci reinstalls from the lockfile with a cold cache", () => {
    const result = npm(dir, ["ci"], join(work, "cache-ci"));
    assert.equal(result.status, 0, result.stderr);
  });

  it("a tampered tarball fails the SHA-256 check and npm ci (EINTEGRITY)", async () => {
    // A well-formed tarball with one changed color: valid gzip and tar, only the content differs.
    const files = await packageFiles("packages/tokens");
    const css = files.get("dist/tokens.css").toString("utf-8");
    const changed = css.replace(/--ui-color-text: #[0-9a-f]{6}/, "--ui-color-text: #777777");
    assert.notEqual(changed, css);
    files.set("dist/tokens.css", Buffer.from(changed, "utf-8"));
    const tampered = gzipStored(tar(files));
    assert.notEqual(sha256(tampered), recorded.sha256);

    const bad = project("tampered", tampered);
    writeFileSync(join(bad, "package-lock.json"), readFileSync(join(dir, "package-lock.json")));
    const result = npm(bad, ["ci"], join(work, "cache-tampered"));
    assert.notEqual(result.status, 0, "npm ci accepted a tampered tarball");
    assert.match(result.stderr, /EINTEGRITY/);
  });
});

// All packages together, as a product vendors them. React is the product's (a peer dependency), so the install
// leaves peers to the product (--legacy-peer-deps, offline); the check is what npm records and what ships.
describe("consuming every package together", async () => {
  const { packAll } = await import("../scripts/lib/workspaces.mjs");
  const packs = await packAll();
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8")).packages;
  const dir = join(work, "all");
  let result;
  before(() => {
    mkdirSync(join(dir, "vendor"), { recursive: true });
    const dependencies = {};
    for (const p of packs) {
      writeFileSync(join(dir, "vendor", p.file), p.tarball);
      dependencies[p.name] = `file:vendor/${p.file}`;
    }
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "consumer-all", version: "1.0.0", private: true, dependencies }));
    result = spawnSync(NPM, ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--offline", "--legacy-peer-deps", "--cache", join(work, "cache-all")], {
      cwd: dir,
      encoding: "utf-8",
      shell: process.platform === "win32",
    });
  });
  after(() => rmSync(work, { recursive: true, force: true }));

  it("installs offline with the integrity of artifacts/manifest.json for every package", () => {
    assert.equal(result.status, 0, result.stderr);
    const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf-8"));
    assert.ok(packs.length >= 4);
    for (const p of packs) {
      const entry = lock.packages[`node_modules/${p.name}`];
      assert.equal(entry.integrity, manifest.find((m) => m.name === p.name).integrity, p.name);
    }
  });

  it("every export of every package resolves to a shipped file", () => {
    for (const p of packs) {
      const pkg = JSON.parse(readFileSync(join(dir, "node_modules", p.name, "package.json"), "utf-8"));
      for (const [key, target] of Object.entries(pkg.exports)) {
        const files = typeof target === "string" ? [target] : Object.values(target);
        for (const file of files) assert.ok(existsSync(join(dir, "node_modules", p.name, file)), `${p.name} ${key} -> ${file}`);
      }
    }
  });

  it("the shipped modules import only React, another package of this repository or their own files", () => {
    for (const p of packs) {
      const base = join(dir, "node_modules", p.name);
      const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
      for (const file of walk(base).filter((f) => /\.(js|d\.ts)$/.test(f))) {
        const text = readFileSync(file, "utf-8");
        const specifiers = [
          ...text.matchAll(/^\s*(?:import|export)\b[^"';]*?\bfrom\s*["']([^"']+)["']/gm),
          ...text.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
          ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
        ];
        assert.ok(!file.endsWith("index.js") || specifiers.length > 0, `${file}: no imports found`);
        for (const m of specifiers) {
          assert.match(m[1], /^(\.\.?\/|react$|react\/jsx-runtime$|@nodestro\/ui-(core|tokens)$)/, `${file}: ${m[1]}`);
        }
      }
    }
  });
});
