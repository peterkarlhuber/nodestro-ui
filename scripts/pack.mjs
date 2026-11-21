// Packs every package into a reproducible tarball.
//
//   node scripts/pack.mjs [--out DIR]   write <name>-<version>.tgz, <file>.sha256 and manifest.json to DIR (default dist/)
//   node scripts/pack.mjs --check       fail unless the tarballs match artifacts/manifest.json byte for byte
//   node scripts/pack.mjs --write-manifest   update artifacts/manifest.json (after a deliberate change)
//
// artifacts/manifest.json is committed: a change to any shipped byte shows up in review as a new SHA-256.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MANIFEST, ROOT, manifestText, packAll } from "./lib/workspaces.mjs";
import { sha256 } from "./lib/tarball.mjs";

const args = process.argv.slice(2);
const packs = await packAll();
const text = manifestText(packs);

if (args.includes("--check")) {
  const current = readFileSync(MANIFEST, "utf-8");
  if (current !== text) {
    console.error("artifacts/manifest.json does not match the tarballs built from this tree.");
    console.error("If the change is deliberate, run: npm run pack:manifest\n");
    console.error(text);
    process.exit(1);
  }
  for (const p of packs) console.log(`ok ${p.file} ${sha256(p.tarball)}`);
} else if (args.includes("--write-manifest")) {
  writeFileSync(MANIFEST, text);
  console.log(`wrote ${MANIFEST}`);
} else {
  const at = args.indexOf("--out");
  const out = at >= 0 ? args[at + 1] : join(ROOT, "dist");
  if (!out) throw new Error("--out needs a directory");
  mkdirSync(out, { recursive: true });
  for (const p of packs) {
    writeFileSync(join(out, p.file), p.tarball);
    writeFileSync(join(out, `${p.file}.sha256`), `${sha256(p.tarball)}  ${p.file}\n`);
    console.log(`${join(out, p.file)} ${sha256(p.tarball)}`);
  }
  writeFileSync(join(out, "manifest.json"), text);
}
