// WCAG 2.x AA for the semantic text/background pairs in every theme.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFiles } from "../lib/build.mjs";
import { contrastRatio } from "../lib/contrast.mjs";

const files = buildFiles();
const json = JSON.parse(files.get("dist/tokens.json").toString("utf-8"));
const { pairs } = JSON.parse(files.get("dist/contrast-pairs.json").toString("utf-8"));

describe("contrast", () => {
  for (const theme of json.themes) {
    describe(`${theme} theme`, () => {
      for (const { fg, bg, min } of pairs) {
        it(`${fg} on ${bg} meets ${min}:1`, () => {
          const ratio = contrastRatio(json.tokens[fg].values[theme], json.tokens[bg].values[theme]);
          assert.ok(ratio >= min, `${fg} on ${bg}: ${ratio.toFixed(2)}:1 < ${min}:1`);
        });
      }
    });
  }

  it("every foreground role is checked against at least one background", () => {
    const foreground =
      /^color-(text(-.+)?|heading|link|primary|on-.+|focus|control-border|accent|success|warning|danger|info|running|idle|neutral|nav-text(-.+)?|nav-indicator)$/;
    const checked = new Set(pairs.map((p) => p.fg));
    const roles = Object.keys(json.tokens).filter((n) => foreground.test(n));
    assert.ok(roles.length >= 20, `only ${roles.length} foreground roles found`);
    for (const role of roles) assert.ok(checked.has(role), `${role} is in no contrast pair`);
  });

  it("every status color is checked on its own background", () => {
    for (const status of ["success", "warning", "danger", "info", "running", "idle", "neutral"]) {
      assert.ok(
        pairs.some((p) => p.fg === `color-${status}` && p.bg === `color-${status}-bg` && p.min === 4.5),
        `color-${status} on color-${status}-bg is not checked`,
      );
    }
  });

  it("text pairs use 4.5:1 and only non-text roles use 3:1", () => {
    for (const { fg, min } of pairs) {
      if (min === 3) assert.match(fg, /^color-(focus|control-border|nav-indicator|accent)$/, `${fg} may not use 3:1`);
      else assert.equal(min, 4.5);
    }
  });

  it("contrastRatio matches known WCAG values", () => {
    assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 1e-9);
    assert.ok(Math.abs(contrastRatio("#ffffff", "#ffffff") - 1) < 1e-9);
    assert.equal(contrastRatio("#767676", "#ffffff").toFixed(2), "4.54");
    assert.equal(contrastRatio("#777777", "#ffffff").toFixed(2), "4.48");
    assert.throws(() => contrastRatio("red", "#ffffff"));
    assert.throws(() => contrastRatio("#fff", "#ffffff"));
  });
});
