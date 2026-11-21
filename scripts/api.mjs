// Records the public surface of every package in api/<package>.json (see scripts/lib/api.mjs).
//
//   node scripts/api.mjs --write   after a deliberate change (and its version bump)
//   node scripts/api.mjs --check   fail when a recorded surface is not current
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { apiFile, apiText, surface } from "./lib/api.mjs";
import { workspaceDirs } from "./lib/workspaces.mjs";

const write = process.argv.includes("--write");
let stale = 0;
for (const dir of workspaceDirs()) {
  const text = apiText(await surface(dir));
  const file = apiFile(dir);
  let current = "";
  try {
    current = readFileSync(file, "utf-8");
  } catch {
    // not recorded yet
  }
  if (current === text) continue;
  if (write) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    console.log(`wrote ${file}`);
  } else {
    console.error(`${file} is not current; run: npm run api`);
    stale++;
  }
}
process.exit(stale ? 1 : 0);
