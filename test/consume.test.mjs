// How a product consumes a package: a vendored tarball (file:vendor/*.tgz) installed by npm without a registry.
// Checks that npm records the same integrity as artifacts/manifest.json, that the exports resolve, and that a
// tampered tarball fails both the SHA-256 check and npm's integrity check (with a cold cache, as in CI).
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
