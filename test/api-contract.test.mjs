// A version bump cannot break a product unnoticed: the recorded surface (api/<package>.json) must be current, and
// against the surface on the base branch (API_BASE, default origin/master) every change needs a version bump, and a
// breaking one (anything removed or changed) a breaking bump (0.x: the next minor; from 1.0: the next major).
// Products check the other side in their own CI (they pin the tarballs and test what they use).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, it } from "node:test";
import { apiFile, apiText, compare, surface } from "../scripts/lib/api.mjs";
import { ROOT, workspaceDirs } from "../scripts/lib/workspaces.mjs";

const BASE = process.env.API_BASE || "origin/master";

function baseline(dir) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${BASE}:${relative(ROOT, apiFile(dir))}`], { cwd: ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return null; // a new package, or no base branch in this checkout
  }
}

const v = (version, extra = {}) => ({ name: "x", version, declarations: { "a.d.ts": ["export declare function a(): void;"] }, messages: ["k"], ...extra });

describe("API contract", () => {
  for (const dir of workspaceDirs()) {
    describe(dir, async () => {
      const current = await surface(dir);

      it("the recorded surface is current (npm run api)", () => {
        assert.equal(readFileSync(apiFile(dir), "utf-8"), apiText(current));
      });

      it(`changes against ${BASE} come with a matching version bump`, (t) => {
        const base = baseline(dir);
        if (!base) {
          t.diagnostic(`no recorded surface on ${BASE}: a new package`);
          return;
        }
        const { removed, added, problem } = compare(base, current);
        assert.equal(problem, null, `${problem}\nremoved: ${removed.join("\n  ")}\nadded: ${added.join("\n  ")}`);
      });
    });
  }

  it("classifies changes (unit check of the rule)", () => {
    assert.equal(compare(v("0.1.0"), v("0.1.0")).problem, null);
    assert.match(compare(v("0.1.0"), v("0.1.0", { messages: ["k", "new"] })).problem, /version stayed/);
    assert.equal(compare(v("0.1.0"), v("0.1.1", { messages: ["k", "new"] })).problem, null);
    assert.match(compare(v("0.1.0"), v("0.1.1", { messages: [] })).problem, /need 0\.2\.0/);
    assert.equal(compare(v("0.1.0"), v("0.2.0", { messages: [] })).problem, null);
    assert.match(compare(v("1.2.3"), v("1.3.0", { declarations: { "a.d.ts": ["export declare function a(x: string): void;"] } })).problem, /need 2\.0\.0/);
    assert.equal(compare(v("1.2.3"), v("2.0.0", { declarations: { "a.d.ts": [] } })).problem, null);
    assert.match(compare(v("0.2.0"), v("0.1.9")).problem, /went down/);
  });
});
