// The component packages carry no product brand, exactly like the tokens: brands come only from a theme
// (@nodestro/ui-themes or the product's own). Source files and every shipped file are checked.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { ROOT, packageFiles } from "../scripts/lib/workspaces.mjs";

const BRANDS = /nodestro|axentra|tabrion|levuvo|orkexa|midnight|citron/i;
// The package scope and the repository URL are names, not branding; they are the only allowed mentions.
const ALLOWED = [/@nodestro\/ui-[a-z]+/g, /github\.com\/peterkarlhuber\/nodestro-ui/g];
const strip = (text) => ALLOWED.reduce((t, pattern) => t.replace(pattern, ""), text);

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "dist") return [];
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

// help ships texts only (no stylesheet); the component packages ship one each.
const STYLED = new Set(["packages/core", "packages/ai"]);

for (const dir of ["packages/core", "packages/ai", "packages/help"]) {
  describe(`${dir} is brand-neutral`, async () => {
    const shipped = await packageFiles(dir);
    it("in its sources", () => {
      for (const file of files(join(ROOT, dir))) {
        const match = strip(readFileSync(file, "utf-8")).match(BRANDS);
        assert.equal(match, null, `${relative(ROOT, file)} mentions ${match?.[0]}`);
      }
    });
    it("in every shipped file", () => {
      for (const [path, data] of shipped) {
        if (path === "LICENSE") continue; // the proprietary license names its owner
        const match = strip(data.toString("utf-8")).match(BRANDS);
        assert.equal(match, null, `${path} mentions ${match?.[0]}`);
      }
    });
    it("uses only existing --ui- tokens and ui- classes", () => {
      assert.equal(shipped.has("dist/styles.css"), STYLED.has(dir), `${dir}: dist/styles.css`);
      if (!STYLED.has(dir)) return;
      const css = shipped.get("dist/styles.css").toString("utf-8");
      for (const m of css.matchAll(/var\(--([a-z0-9]+)-/g)) assert.equal(m[1], "ui", `var(--${m[1]}-…)`);
      for (const m of css.matchAll(/^\.([a-z0-9]+)-/gm)) assert.equal(m[1], "ui", `.${m[1]}-…`);
      const tokens = JSON.parse(readFileSync(join(ROOT, "packages/tokens/src/tokens.json"), "utf-8")).tokens;
      for (const m of css.matchAll(/var\(--ui-([a-z0-9-]+)\)/g)) assert.ok(m[1] in tokens, `var(--ui-${m[1]}) is not a token`);
    });
  });
}
