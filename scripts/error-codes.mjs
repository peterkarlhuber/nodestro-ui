// The pinned list of the platform API's stable error codes (errors/api-error-codes.json), the input of the help
// coverage test (test/components/help-coverage.test.ts). The API keeps the list in its package
// (src/nodestro_api/error_codes.json); this copy holds the code names and patterns of one commit, so the test needs
// no network and no API checkout. Refresh it when the API's list changes:
//
//   node scripts/error-codes.mjs --write <dir> [--ref <ref>]    copy the list from <dir>/nodestro-api at <ref>
//                                                                (default HEAD; read with git show, read-only)
//   node scripts/error-codes.mjs --verify <dir> [--ref <ref>]   fail if the pinned list differs from that commit
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, readJson } from "./lib/workspaces.mjs";

export const PINNED = join(ROOT, "errors", "api-error-codes.json");
export const EXCEPTIONS = join(ROOT, "errors", "exceptions.json");
export const SOURCE = { repository: "nodestro-api", path: "src/nodestro_api/error_codes.json" };

const sorted = (values) => [...new Set(values)].sort();

/** The pinned file's text for a catalog of the API ({ codes: {code: ...}, patterns: [...] }) at a commit. */
export function pinnedText(catalog, commit) {
  const value = {
    comment: "Pinned copy of the platform API's error code names. Written by scripts/error-codes.mjs: do not edit.",
    source: { ...SOURCE, commit },
    codes: sorted(Object.keys(catalog.codes ?? {})),
    patterns: sorted(catalog.patterns ?? []),
  };
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function loadPinned() {
  return readJson(PINNED);
}

/** Every code of the pinned list, the patterns ("http.<status>") included. */
export function pinnedCodes(pinned = loadPinned()) {
  return sorted([...pinned.codes, ...pinned.patterns]);
}

/** The API's catalog and commit, read from the repository under <dir> at <ref> (never from the working tree). */
export function readSource(dir, ref = "HEAD") {
  const repo = join(dir, SOURCE.repository);
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  const commit = git("rev-parse", "--verify", `${ref}^{commit}`).trim();
  return { commit, catalog: JSON.parse(git("show", `${commit}:${SOURCE.path}`)) };
}

/** The codes added to and removed from the API since the pinned commit. */
export function difference(pinned, catalog) {
  const before = new Set(pinnedCodes(pinned));
  const after = new Set(sorted([...Object.keys(catalog.codes ?? {}), ...(catalog.patterns ?? [])]));
  return { added: [...after].filter((c) => !before.has(c)), removed: [...before].filter((c) => !after.has(c)) };
}

function option(args, name) {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = args[at + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ref = option(args, "--ref") ?? "HEAD";
  if (args.includes("--write")) {
    const { commit, catalog } = readSource(option(args, "--write"), ref);
    writeFileSync(PINNED, pinnedText(catalog, commit));
    console.log(`wrote ${PINNED} (${SOURCE.repository} ${commit})`);
  } else if (args.includes("--verify")) {
    const { commit, catalog } = readSource(option(args, "--verify"), ref);
    const { added, removed } = difference(loadPinned(), catalog);
    if (added.length || removed.length) {
      console.error(`errors/api-error-codes.json differs from ${SOURCE.repository} ${commit}:`);
      for (const code of added) console.error(`  + ${code}`);
      for (const code of removed) console.error(`  - ${code}`);
      console.error("Run node scripts/error-codes.mjs --write <dir> and add help or an exception for new codes.");
      process.exitCode = 1;
    } else console.log(`errors/api-error-codes.json matches ${SOURCE.repository} ${commit}`);
  } else {
    console.error("usage: node scripts/error-codes.mjs --write <dir> [--ref <ref>] | --verify <dir> [--ref <ref>]");
    process.exitCode = 2;
  }
}
