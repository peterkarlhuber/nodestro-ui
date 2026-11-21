// tokens.css and tokens.json say the same thing, both follow from src/tokens.json, and the build is stable.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFiles, loadSource } from "../lib/build.mjs";
import { findRule, parseCss } from "./css.mjs";

const files = buildFiles();
const json = JSON.parse(files.get("dist/tokens.json").toString("utf-8"));
const rules = parseCss(files.get("dist/tokens.css").toString("utf-8"));
const source = loadSource();

/** Every custom property the CSS declares, per context. */
function cssContexts() {
  const pick = (selector, media) => {
    const decl = new Map(findRule(rules, selector, media).declarations);
    decl.delete("color-scheme");
    return decl;
  };
  return {
    global: pick(":root", null),
    light: pick(json.selectors.light.replace(/\s+/g, " "), null),
    dark: pick(json.selectors.dark, null),
    systemDark: pick(json.selectors.systemDark, "@media (prefers-color-scheme: dark)"),
    reducedMotion: pick(":root", "@media (prefers-reduced-motion: reduce)"),
  };
}

/** The same contexts derived from tokens.json. */
function jsonContexts() {
  const out = { global: new Map(), light: new Map(), dark: new Map(), systemDark: new Map(), reducedMotion: new Map() };
  for (const token of Object.values(json.tokens)) {
    if ("values" in token) {
      out.light.set(token.cssVar, token.values.light);
      out.dark.set(token.cssVar, token.values.dark);
      out.systemDark.set(token.cssVar, token.values.dark);
    } else out.global.set(token.cssVar, token.value);
    if ("reducedMotion" in token) out.reducedMotion.set(token.cssVar, token.reducedMotion);
  }
  return out;
}

describe("CSS and JSON", () => {
  it("declare the same properties with the same values in every context", () => {
    const css = cssContexts();
    const data = jsonContexts();
    for (const context of Object.keys(data)) {
      assert.deepEqual([...css[context]].sort(), [...data[context]].sort(), `context ${context} differs`);
    }
  });

  it("every property in the CSS is a token in the JSON", () => {
    const known = new Set(Object.values(json.tokens).map((t) => t.cssVar));
    for (const rule of rules) {
      for (const property of rule.declarations.keys()) {
        if (property === "color-scheme") continue;
        assert.ok(known.has(property), `${property} in ${rule.selector} is not in tokens.json`);
      }
    }
  });

  it("the JSON names follow the prefix and match the source one to one, in order", () => {
    assert.equal(json.prefix, "ui");
    assert.equal(json.version, source.version);
    assert.deepEqual(Object.keys(json.tokens), Object.keys(source.tokens.tokens));
    for (const [name, token] of Object.entries(json.tokens)) {
      const src = source.tokens.tokens[name];
      assert.equal(token.cssVar, `--ui-${name}`);
      assert.equal(token.type, src.type);
      assert.equal(token.description, src.description);
      assert.deepEqual(token.value, src.value);
      assert.deepEqual(token.values, src.values);
    }
  });

  it("var() references in values point at tokens that exist", () => {
    const known = new Set(Object.values(json.tokens).map((t) => t.cssVar));
    for (const rule of rules) {
      for (const value of rule.declarations.values()) {
        for (const m of value.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(known.has(m[1]), `unknown ${m[1]}`);
      }
    }
  });

  it("the contrast pairs ship unchanged", () => {
    assert.deepEqual(JSON.parse(files.get("dist/contrast-pairs.json").toString("utf-8")), source.contrast);
  });

  it("building twice gives the same bytes", () => {
    const again = buildFiles();
    assert.deepEqual([...again.keys()], [...files.keys()]);
    for (const [path, data] of files) assert.ok(data.equals(again.get(path)), `${path} differs`);
  });
});
