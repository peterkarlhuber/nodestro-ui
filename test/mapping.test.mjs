// The mapping from each product's variables to the tokens is complete and points at tokens that exist.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DOC, loadMappings, loadTokens, renderDoc } from "../scripts/mapping.mjs";

const mappings = loadMappings();
const source = loadTokens();
// Unique custom properties per product file, as counted in the P0-6 analysis (annex P0-6, section 2).
const INVENTORY = { "nodestro-studio": 53, "axentra-studio": 102, "tabrion-studio": 84 };

describe("token mapping", () => {
  it("covers the three studio products", () => {
    assert.deepEqual(mappings.map((m) => m.product).sort(), Object.keys(INVENTORY).sort());
  });

  for (const m of mappings) {
    describe(m.product, () => {
      it("records every variable of the product file", () => {
        assert.equal(m.variables.length, INVENTORY[m.product]);
        const names = m.variables.map((v) => v.name);
        assert.equal(new Set(names).size, names.length, "duplicate variable");
        for (const name of names) assert.ok(name.startsWith(m.source.prefix), `${name} lacks ${m.source.prefix}`);
        assert.match(m.source.commit, /^[0-9a-f]{40}$/);
      });

      it("maps every variable to an existing token, or says why it stays in the product", () => {
        for (const v of m.variables) {
          if (v.token) {
            assert.ok(source.tokens[v.token], `${v.name} -> unknown token ${v.token}`);
          } else {
            assert.equal(v.token, null, `${v.name}: token must be a name or null`);
            assert.ok(v.note && v.note.length > 10, `${v.name} stays in the product without a reason`);
          }
        }
      });

      it("maps themed variables to themed tokens", () => {
        // A global product value may map to a themed token (the brand sets it for both themes), not the reverse.
        for (const v of m.variables.filter((x) => x.token && "light" in x)) {
          assert.ok("dark" in v, `${v.name} has light without dark`);
          assert.ok("values" in source.tokens[v.token], `${v.name} differs per theme but ${v.token} is global`);
        }
      });

      it("maps every color variable", () => {
        for (const v of m.variables) {
          const values = [v.value, v.light, v.dark].filter(Boolean);
          const isColor = values.length && values.every((x) => /^(#[0-9a-f]{3,8}|rgba?\()/i.test(x));
          if (isColor && !v.token) assert.match(v.note, /brand/i, `${v.name} is a color but has no token and is not a brand value`);
        }
      });
    });
  }

  it("every semantic color role of the tokens is used by at least one product", () => {
    const used = new Set(mappings.flatMap((m) => m.variables.map((v) => v.token)));
    for (const name of Object.keys(source.tokens).filter((n) => n.startsWith("color-"))) {
      assert.ok(used.has(name), `${name} replaces no product variable`);
    }
  });

  it("docs/token-mapping.md is current (npm run mapping)", () => {
    assert.equal(readFileSync(DOC, "utf-8"), renderDoc(mappings, source));
  });
});
