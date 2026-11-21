// Writes the generated files of every package into packages/<dir>/dist/ (ignored by git) for local inspection.
// The tarball does not need this step: scripts/pack.mjs builds in memory from the same source.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, buildPackage, workspaceDirs } from "./lib/workspaces.mjs";

for (const dir of workspaceDirs()) {
  const abs = join(ROOT, dir);
  for (const [path, data] of await buildPackage(abs)) {
    mkdirSync(dirname(join(abs, path)), { recursive: true });
    writeFileSync(join(abs, path), data);
    console.log(join(dir, path));
  }
}
