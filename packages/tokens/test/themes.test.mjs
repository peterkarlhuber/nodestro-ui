// Every token exists in every theme, in the source, the JSON and each theme block of the CSS.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFiles, loadSource } from "../lib/build.mjs";
import { findRule, parseCss } from "./css.mjs";

const source = loadSource();
const files = buildFiles();
const json = JSON.parse(files.get("dist/tokens.json").toString("utf-8"));
const rules = parseCss(files.get("dist/tokens.css").toString("utf-8"));
const names = Object.keys(source.tokens.tokens);
const themed = names.filter((n) => "values" in source.tokens.tokens[n]);
const globals = names.filter((n) => "value" in source.tokens.tokens[n]);
const cssName = (n) => `--ui-${n}`;

const themeRules = {
  light: findRule(rules, ":root, [data-theme='light']"),
  dark: findRule(rules, "[data-theme='dark']"),
};
const systemDark = findRule(rules, ":root:not([data-theme='light'])", "@media (prefers-color-scheme: dark)");

describe("themes", () => {
  it("has exactly the themes light and dark, light by default", () => {
    assert.deepEqual(json.themes, ["light", "dark"]);
    assert.equal(json.defaultTheme, "light");
  });

  it("has semantic colors and shadows for both themes and the shared scales", () => {
    assert.ok(themed.length >= 50, `only ${themed.length} themed tokens`);
    for (const group of ["font-", "text-", "space-", "radius-", "duration-", "z-"]) {
      assert.ok(globals.some((n) => n.startsWith(group)), `no ${group}* token`);
    }
    for (const n of themed) assert.match(n, /^(color|shadow)-/, `${n} is themed but neither a color nor a shadow`);
  });

  for (const theme of ["light", "dark"]) {
    it(`every themed token has a ${theme} value in the source and the JSON`, () => {
      for (const n of themed) {
        assert.equal(typeof source.tokens.tokens[n].values[theme], "string", `${n} has no ${theme} value`);
        assert.equal(typeof json.tokens[n].values[theme], "string", `${n} has no ${theme} value in tokens.json`);
      }
    });

    it(`the ${theme} block declares color-scheme and exactly the themed tokens`, () => {
      const declared = [...themeRules[theme].declarations.keys()];
      assert.deepEqual(declared, ["color-scheme", ...themed.map(cssName)]);
      assert.equal(themeRules[theme].declarations.get("color-scheme"), theme);
    });
  }

  it("the system dark block equals the dark block", () => {
    assert.deepEqual([...systemDark.declarations], [...themeRules.dark.declarations]);
  });

  it("globals are declared once on :root and nowhere per theme", () => {
    const root = findRule(rules, ":root");
    assert.deepEqual([...root.declarations.keys()], globals.map(cssName));
    for (const rule of [themeRules.light, themeRules.dark, systemDark]) {
      for (const n of globals) assert.ok(!rule.declarations.has(cssName(n)), `${n} declared in ${rule.selector}`);
    }
  });

  it("reduced motion sets every duration to 0ms", () => {
    const reduced = findRule(rules, ":root", "@media (prefers-reduced-motion: reduce)");
    const durations = names.filter((n) => n.startsWith("duration-"));
    assert.ok(durations.length > 0);
    assert.deepEqual([...reduced.declarations], durations.map((n) => [cssName(n), "0ms"]));
  });

  it("the stylesheet has no other rules", () => {
    assert.equal(rules.length, 5);
  });
});
