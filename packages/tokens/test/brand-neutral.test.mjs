// The package carries no product brand: brands are themes the products supply.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PACKAGE_DIR, buildFiles } from "../lib/build.mjs";

const BRANDS = /nodestro|axentra|tabrion|locria|levuvo|orkexa|midnight|citron/i;
// The package scope and the repository URL are names, not branding; they are the only allowed mentions.
const ALLOWED = [/@nodestro\/ui-[a-z]+/g, /github\.com\/peterkarlhuber\/nodestro-ui/g];

function strip(text) {
  return ALLOWED.reduce((t, pattern) => t.replace(pattern, ""), text);
}

describe("brand neutrality", () => {
  const shipped = new Map([
    ...buildFiles(),
    ["README.md", readFileSync(join(PACKAGE_DIR, "README.md"))],
    ["package.json", readFileSync(join(PACKAGE_DIR, "package.json"))],
    ["src/tokens.json", readFileSync(join(PACKAGE_DIR, "src", "tokens.json"))],
    ["src/contrast-pairs.json", readFileSync(join(PACKAGE_DIR, "src", "contrast-pairs.json"))],
    ["lib/build.mjs", readFileSync(join(PACKAGE_DIR, "lib", "build.mjs"))],
  ]);
  for (const [path, data] of shipped) {
    it(`${path} names no product or brand`, () => {
      const match = strip(data.toString("utf-8")).match(BRANDS);
      assert.equal(match, null, `${path} mentions ${match?.[0]}`);
    });
  }

  it("uses only the neutral --ui- prefix", () => {
    const css = buildFiles().get("dist/tokens.css").toString("utf-8");
    for (const m of css.matchAll(/--([a-z0-9]+)-/g)) assert.equal(m[1], "ui", `custom property with prefix --${m[1]}-`);
  });
});
