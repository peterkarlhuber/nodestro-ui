// The tarballs are reproducible: byte-identical on every build, with the SHA-256 recorded in artifacts/manifest.json.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { gunzipSync } from "node:zlib";
import { MANIFEST, manifestText, packAll, packageFiles } from "../scripts/lib/workspaces.mjs";
import { MTIME, gzipStored, sha256, tar } from "../scripts/lib/tarball.mjs";

const first = await packAll();
const second = await packAll();

/** The entries of a tar archive: [{ path, mode, uid, gid, mtime, type, uname, data }]. */
function untar(buffer) {
  const entries = [];
  for (let offset = 0; offset + 512 <= buffer.length; ) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const str = (start, length) => header.subarray(start, start + length).toString("utf-8").replace(/\0.*$/s, "");
    const num = (start, length) => parseInt(str(start, length).trim(), 8);
    const size = num(124, 12);
    entries.push({
      path: str(0, 100),
      mode: num(100, 8),
      uid: num(108, 8),
      gid: num(116, 8),
      mtime: num(136, 12),
      type: str(156, 1),
      uname: str(265, 32),
      data: buffer.subarray(offset + 512, offset + 512 + size),
    });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

describe("reproducible tarballs", () => {
  it("packs at least the tokens package", () => {
    assert.ok(first.some((p) => p.name === "@nodestro/ui-tokens"));
  });

  it("two builds give byte-identical tarballs", () => {
    assert.equal(first.length, second.length);
    for (let i = 0; i < first.length; i++) {
      assert.equal(first[i].file, second[i].file);
      assert.ok(first[i].tarball.equals(second[i].tarball), `${first[i].file} differs between builds`);
    }
  });

  it("the SHA-256 of every tarball is the one in artifacts/manifest.json", () => {
    const recorded = JSON.parse(readFileSync(MANIFEST, "utf-8"));
    for (const p of first) {
      const entry = recorded.packages.find((e) => e.name === p.name);
      assert.ok(entry, `${p.name} missing from artifacts/manifest.json (npm run pack:manifest)`);
      assert.equal(entry.version, p.version);
      assert.equal(entry.file, p.file);
      assert.equal(entry.sha256, sha256(p.tarball), `${p.file}: tarball changed; if deliberate, npm run pack:manifest`);
    }
    assert.equal(readFileSync(MANIFEST, "utf-8"), manifestText(first));
  });

  for (const p of first) {
    it(`${p.file} has a fixed gzip header and fixed tar metadata`, () => {
      assert.deepEqual([...p.tarball.subarray(0, 10)], [0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 255]);
      const entries = untar(gunzipSync(p.tarball));
      const paths = entries.map((e) => e.path);
      assert.deepEqual(paths, [...paths].sort(), "entries are not sorted");
      for (const e of entries) {
        assert.match(e.path, /^package\/[^/]/);
        assert.equal(e.type, "0", `${e.path} is not a regular file`);
        assert.equal(e.mode, 0o644);
        assert.equal(e.uid, 0);
        assert.equal(e.gid, 0);
        assert.equal(e.uname, "");
        assert.equal(e.mtime, MTIME);
      }
    });

    it(`${p.file} holds exactly package.json, README.md, LICENSE and the built files`, async () => {
      const files = await packageFiles(p.directory);
      const entries = untar(gunzipSync(p.tarball));
      assert.deepEqual(entries.map((e) => e.path), [...files.keys()].sort().map((f) => `package/${f}`));
      for (const e of entries) assert.ok(e.data.equals(files.get(e.path.slice("package/".length))), `${e.path} differs`);
      assert.ok(files.has("package.json") && files.has("README.md") && files.has("LICENSE"));
      assert.equal(files.get("LICENSE").toString("utf-8"), readFileSync(new URL("../LICENSE", import.meta.url), "utf-8"));
    });
  }

  it("gzipStored round-trips through zlib, including inputs larger than one stored block", () => {
    for (const size of [0, 1, 65535, 65536, 200000]) {
      const data = Buffer.alloc(size, 7);
      for (let i = 0; i < size; i += 1013) data[i] = i % 251;
      assert.ok(gunzipSync(gzipStored(data)).equals(data), `size ${size}`);
    }
  });

  it("tar refuses unsafe paths", () => {
    for (const path of ["../x", "/etc/x", "a//b", "a/./b"]) {
      assert.throws(() => tar(new Map([[path, Buffer.alloc(1)]])), /unsafe path/);
    }
  });
});
