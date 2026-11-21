// Brand themes: valid overrides of existing tokens only, every WCAG contrast pair met in light and dark, the same
// selectors as the base stylesheet, reduced motion kept, and the Nodestro theme equal to the studio's own values.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { PACKAGE_DIR, SELECTORS, buildFiles, loadBrands, loadTokenSource, renderBrandCss, resolveBrand, validateBrand } from "../lib/build.mjs";

const require = createRequire(import.meta.url);
const tokensDir = dirname(require.resolve("@nodestro/ui-tokens/package.json"));
const { contrastRatio } = await import(join(tokensDir, "lib", "contrast.mjs"));
const { buildFiles: buildTokens } = await import(join(tokensDir, "lib", "build.mjs"));

const { tokens: source, contrast } = loadTokenSource();
const brands = loadBrands();
const files = buildFiles();
const version = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf-8")).version;
const exported = Object.keys(JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf-8")).exports);

describe("brand themes", () => {
  it("are the neutral default, the Nodestro theme and one example brand", () => {
    assert.deepEqual(brands.map((b) => b.name), ["example", "neutral", "nodestro"]);
    assert.deepEqual(Object.keys(brands.find((b) => b.name === "neutral").tokens), []);
  });

  it("each has a stylesheet export and an entry in themes.json", () => {
    const data = JSON.parse(files.get("dist/themes.json").toString("utf-8"));
    assert.deepEqual(Object.keys(data.brands).sort(), brands.map((b) => b.name));
    for (const brand of brands) {
      assert.ok(files.has(`dist/${brand.name}.css`));
      assert.ok(exported.includes(`./${brand.name}.css`), `no export for ${brand.name}.css`);
    }
  });

  it("use the selectors of the base stylesheet", () => {
    const base = JSON.parse(buildTokens().get("dist/tokens.json").toString("utf-8")).selectors;
    assert.deepEqual(SELECTORS, base);
  });

  for (const brand of brands) {
    describe(brand.name, () => {
      it("overrides only existing tokens with valid values", () => {
        validateBrand(brand, source);
      });

      for (const theme of source.themes) {
        it(`${theme}: meets every contrast pair`, () => {
          const resolved = resolveBrand(brand, source)[theme];
          const failing = contrast.pairs
            .map(({ fg, bg, min }) => ({ fg, bg, min, ratio: contrastRatio(resolved[fg], resolved[bg]) }))
            .filter((p) => p.ratio < p.min)
            .map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)} < ${p.min}`);
          assert.deepEqual(failing, []);
        });
      }

      it("declares each override once per theme block, and nothing else", () => {
        const css = files.get(`dist/${brand.name}.css`).toString("utf-8");
        const themed = Object.keys(brand.tokens).filter((n) => "values" in source.tokens[n]);
        const globals = Object.keys(brand.tokens).filter((n) => "value" in source.tokens[n]);
        const count = (name) => (css.match(new RegExp(`--ui-${name}:`, "g")) ?? []).length;
        for (const name of themed) assert.equal(count(name), 3, `${name}: light, dark and system dark`);
        for (const name of globals) assert.equal(count(name), "reducedMotion" in source.tokens[name] ? 2 : 1, name);
        assert.doesNotMatch(css, /[\s;{]color-scheme\s*:/);
        const declared = new Set([...css.matchAll(/(--ui-[a-z0-9-]+):/g)].map((m) => m[1].slice(5)));
        assert.deepEqual([...declared].sort(), Object.keys(brand.tokens).sort());
      });
    });
  }

  it("a brand duration still yields to reduced motion", () => {
    const css = files.get("dist/nodestro.css").toString("utf-8");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.match(reduced, /--ui-duration-fast: 0ms;/);
    assert.match(reduced, /--ui-duration-normal: 0ms;/);
  });

  it("rejects unknown tokens, a missing theme, unsafe and invalid values", () => {
    const bad = (tokens) => () => validateBrand({ name: "x", description: "A test brand.", tokens }, source);
    assert.throws(bad({ "color-nope": { light: "#000000", dark: "#000000" } }), /unknown token/);
    assert.throws(bad({ "color-text": { light: "#000000" } }), /exactly light and dark/);
    assert.throws(bad({ "color-text": { light: "red; }", dark: "#000000" } }), /unsafe/);
    assert.throws(bad({ "color-text": { light: "red", dark: "#000000" } }), /#rrggbb/);
    assert.throws(bad({ "radius-sm": { light: "1px", dark: "1px" } }), /global/);
    assert.throws(bad({ "duration-fast": "1s" }), /ms/);
  });

  it("renders the neutral theme as a stylesheet without declarations", () => {
    assert.doesNotMatch(renderBrandCss({ name: "neutral", tokens: {} }, version, source), /--ui-/);
  });
});

describe("the Nodestro theme matches nodestro-studio's Midnight Citron values", () => {
  const migration = JSON.parse(readFileSync(join(PACKAGE_DIR, "..", "..", "migration", "nodestro-studio.json"), "utf-8"));
  const nodestro = brands.find((b) => b.name === "nodestro");
  const normalize = (value) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/([,(])\.(\d)/g, "$10.$2");

  it("takes every themed color and shadow the studio maps to a role", () => {
    let checked = 0;
    for (const variable of migration.variables) {
      const token = source.tokens[variable.token];
      if (!token || !("values" in token) || !("light" in variable)) continue;
      const own = nodestro.tokens[variable.token];
      assert.ok(own, `${variable.name} -> ${variable.token} is not in the theme`);
      for (const theme of ["light", "dark"]) assert.equal(normalize(own[theme]), normalize(variable[theme]), `${variable.name} ${theme}`);
      checked++;
    }
    assert.ok(checked >= 30, `only ${checked} roles checked`);
  });

  it("keeps the studio's radii and durations", () => {
    for (const variable of migration.variables) {
      if (!/^--nd-(radius|duration)-/.test(variable.name)) continue;
      assert.equal(nodestro.tokens[variable.token], variable.value, variable.name);
    }
  });
});
