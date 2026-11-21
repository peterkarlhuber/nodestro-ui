// The build refuses a broken source instead of emitting a broken stylesheet.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadSource, validate } from "../lib/build.mjs";

function mutate(change) {
  const source = structuredClone(loadSource());
  change(source);
  return source;
}

describe("validate", () => {
  it("accepts the source", () => {
    validate(loadSource());
  });

  const cases = {
    "a themed token without a dark value": (s) => delete s.tokens.tokens["color-text"].values.dark,
    "an unknown theme": (s) => (s.tokens.tokens["color-text"].values.sepia = "#000000"),
    "a token with value and values": (s) => (s.tokens.tokens["color-text"].value = "#000000"),
    "an unknown type": (s) => (s.tokens.tokens["space-1"].type = "length"),
    "a missing description": (s) => delete s.tokens.tokens["space-1"].description,
    "a bad name": (s) => (s.tokens.tokens.Space_1 = { type: "dimension", description: "bad", value: "1px" }),
    "a color that is neither hex nor rgba": (s) => (s.tokens.tokens["color-text"].values.light = "red"),
    "a value that closes the rule": (s) => (s.tokens.tokens["space-1"].value = "1px; } body { color: red"),
    "a value that opens a comment": (s) => (s.tokens.tokens["space-1"].value = "1px /*"),
    "another prefix": (s) => (s.tokens.prefix = "nd"),
    "a contrast pair with an unknown token": (s) => s.contrast.pairs.push({ fg: "color-nope", bg: "color-bg", min: 4.5 }),
    "a contrast pair with a translucent color": (s) => s.contrast.pairs.push({ fg: "color-text", bg: "color-overlay", min: 4.5 }),
    "a contrast pair with a lower minimum": (s) => (s.contrast.pairs[0].min = 2),
  };
  for (const [name, change] of Object.entries(cases)) {
    it(`rejects ${name}`, () => {
      assert.throws(() => validate(mutate(change)), /invalid token source/);
    });
  }
});
