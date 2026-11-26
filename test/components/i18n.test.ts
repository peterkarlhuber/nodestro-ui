// @vitest-environment node
// i18n key coverage: every package key exists in all six languages (en, de, fr, es, it, pt-BR: the languages of the
// products), with the same placeholders and a real translation; every key the source uses exists, and every key
// exists because the source uses it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOCALES, coreMessages, interpolate, lookup, resolveLocale, type Catalog } from "@nodestro/ui-core";
import { REMEMBER_DURATIONS, TOOL_CALL_TONE, aiMessages } from "@nodestro/ui-ai";
import { HELP_ERRORS, helpMessages } from "@nodestro/ui-help";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
// The source of a component package uses its keys with t(); the help package's keys are entries
// (help.<topic>.title|summary|keywords), used through its error map (checked in "keys built from values").
const CATALOGS: Array<[string, Catalog, string | null]> = [
  ["core", coreMessages, "packages/core/src"],
  ["ai", aiMessages, "packages/ai/src"],
  ["help", helpMessages, null],
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "locales" ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [readFileSync(path, "utf-8")] : [];
  });
}

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();

describe("languages", () => {
  it("are the six languages of the products", () => {
    expect([...LOCALES]).toEqual(["en", "de", "fr", "es", "it", "pt-BR"]);
  });

  it("resolve from browser tags", () => {
    expect(resolveLocale("de-AT")).toBe("de");
    expect(resolveLocale("pt")).toBe("pt-BR");
    expect(resolveLocale("pt-PT")).toBe("pt-BR");
    expect(resolveLocale("PT-br")).toBe("pt-BR");
    expect(resolveLocale("nl")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });

  it("interpolate placeholders and keep unknown ones", () => {
    expect(interpolate("{{a}} and {{ b }} and {{c}}", { a: 1, b: "x" })).toBe("1 and x and {{c}}");
    expect(lookup(coreMessages, "de", "core.error.code", { code: "x.y" })).toBe("Fehlercode x.y");
    expect(lookup(coreMessages as Catalog, "it", "missing.key")).toBe("missing.key");
  });
});

for (const [name, catalog, dir] of CATALOGS) {
  describe(`${name} catalog`, () => {
    const en = catalog.en;
    const keys = Object.keys(en).sort();

    it(`has keys with the package prefix "${name}."`, () => {
      expect(keys.length).toBeGreaterThan(5);
      for (const key of keys) expect(key.startsWith(`${name}.`), key).toBe(true);
    });

    for (const locale of LOCALES) {
      it(`${locale}: exactly the English keys, non-empty, same placeholders`, () => {
        const messages = catalog[locale] as Record<string, string>;
        expect(Object.keys(messages).sort()).toEqual(keys);
        for (const key of keys) {
          expect(messages[key].trim().length, `${locale} ${key}`).toBeGreaterThan(0);
          expect(placeholders(messages[key]), `${locale} ${key}`).toEqual(placeholders((en as Record<string, string>)[key]));
        }
      });
    }

    it("every language but English is translated (not a copy of English for most keys)", () => {
      for (const locale of LOCALES.filter((l) => l !== "en")) {
        const messages = catalog[locale] as Record<string, string>;
        const same = keys.filter((key) => messages[key] === (en as Record<string, string>)[key]);
        // Words such as "Details", "System" or "Arguments" are the same in some languages; most texts are not.
        expect(same.length / keys.length, `${locale}: ${same.join(", ")}`).toBeLessThan(0.2);
      }
    });

    if (!dir) return;
    const code = sources(join(ROOT, dir)).join("\n");
    const used = new Set([...code.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]));
    const prefixes = [...code.matchAll(/\bt\(\s*`([^`$]+)\$\{/g)].map((m) => m[1]);

    it("every key the source uses exists", () => {
      expect(used.size).toBeGreaterThan(0);
      for (const key of used) expect(keys, key).toContain(key);
      for (const prefix of prefixes) expect(keys.some((k) => k.startsWith(prefix)), prefix).toBe(true);
    });

    it("every key is used by the source", () => {
      for (const key of keys) expect(used.has(key) || prefixes.some((p) => key.startsWith(p)), `${key} is not used`).toBe(true);
    });
  });
}

describe("keys built from values", () => {
  const ai = aiMessages.en as Record<string, string>;
  it("exist for every value the components accept", () => {
    for (const status of Object.keys(TOOL_CALL_TONE)) expect(ai).toHaveProperty([`ai.toolCall.status.${status}`]);
    for (const duration of REMEMBER_DURATIONS) expect(ai).toHaveProperty([`ai.remember.durations.${duration}`]);
    for (const kind of ["step", "tool", "budget"]) expect(ai).toHaveProperty([`ai.approval.kind.${kind}`]);
    for (const role of ["user", "assistant", "system", "tool"]) expect(ai).toHaveProperty([`ai.chat.role.${role}`]);
    for (const reason of ["destructive", "mcp"]) expect(ai).toHaveProperty([`ai.remember.rejectOnly.${reason}`]);
  });

  it("help: every key belongs to an entry the error map uses, every entry has all three parts", () => {
    const help = helpMessages.en as Record<string, string>;
    const ids = new Set(Object.values(HELP_ERRORS));
    for (const key of Object.keys(help)) expect(ids.has(key.replace(/\.(title|summary|keywords)$/, "")), key).toBe(true);
    for (const id of ids) for (const part of ["title", "summary", "keywords"]) expect(help).toHaveProperty([`${id}.${part}`]);
  });
});
