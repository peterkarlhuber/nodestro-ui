// @vitest-environment node
// N-17 acceptance: every stable error code of the platform API has a help entry or a deliberate, listed exception.
// The codes come from the pinned copy errors/api-error-codes.json (scripts/error-codes.mjs writes it from an API
// commit and verifies it against a checkout), the exceptions from errors/exceptions.json. No network.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOCALES, createHelpIndex, helpCoverage, helpIdForError } from "@nodestro/ui-core";
import { HELP_ERRORS, helpMessages, platformHelp } from "@nodestro/ui-help";
import { pinnedCodes, pinnedText } from "../../scripts/error-codes.mjs";

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf-8");
const pinned = JSON.parse(read("errors/api-error-codes.json"));
const exceptions: Record<string, string> = JSON.parse(read("errors/exceptions.json")).exceptions;
const codes: string[] = pinnedCodes(pinned);

describe("pinned API error codes", () => {
  it("name their source commit and are in canonical form (written by scripts/error-codes.mjs)", () => {
    expect(pinned.source.commit).toMatch(/^[0-9a-f]{40}$/);
    const catalog = { codes: Object.fromEntries(pinned.codes.map((code: string) => [code, {}])), patterns: pinned.patterns };
    expect(read("errors/api-error-codes.json")).toBe(pinnedText(catalog, pinned.source.commit));
    expect(codes.length).toBeGreaterThan(1000);
    expect(codes).toContain("http.<status>");
  });
});

describe("help coverage of the API error codes", () => {
  it("every code has help or a listed exception; no dangling, stale or unused entry", () => {
    expect(helpCoverage(codes, platformHelp("en"), exceptions)).toEqual({ missing: [], dangling: [], staleExceptions: [], unusedMappings: [] });
  });

  it("every exception gives a reason", () => {
    for (const [key, reason] of Object.entries(exceptions)) expect(reason.length, key).toBeGreaterThan(20);
  });

  it("every help entry explains at least one code family", () => {
    const targets = new Set(Object.values(HELP_ERRORS));
    expect(Object.keys(platformHelp("en").entries).sort()).toEqual([...targets].sort());
  });

  it("resolves codes the way ErrorHelp does", () => {
    const help = platformHelp("en");
    expect(helpIdForError(help, "access.denied")).toBe("help.access");
    expect(helpIdForError(help, "run.agent.BudgetExceededError")).toBe("help.runs");
    expect(helpIdForError(help, "http.<status>")).toBe("help.requests");
    expect(helpIdForError(help, "internal")).toBe("help.requests");
  });
});

describe("platform help in six languages", () => {
  it("has a title, a summary and keywords per entry in every language", () => {
    for (const locale of LOCALES) {
      const { entries } = platformHelp(locale);
      for (const [id, entry] of Object.entries(entries)) {
        expect(entry.title, `${locale} ${id}`).toBe((helpMessages[locale] as Record<string, string>)[`${id}.title`]);
        expect(String(entry.summary).length, `${locale} ${id}`).toBeGreaterThan(60);
        expect(entry.keywords, `${locale} ${id}`).toBeTruthy();
      }
    }
  });

  it("resolves language tags and falls back to English", () => {
    expect(platformHelp("de-AT").entries["help.access"].title).toBe("Anmeldung und Zugriff");
    expect(platformHelp("nl").entries["help.access"].title).toBe("Sign-in and access");
    const own = platformHelp("fr", { translate: (key) => (key === "help.runs.title" ? "Mes exécutions" : undefined), hrefs: { "help.runs": "/docs/runs" } });
    expect(own.entries["help.runs"]).toMatchObject({ title: "Mes exécutions", href: "/docs/runs" });
  });

  it("is found offline by words of the language, by code family and by a pasted code", () => {
    const de = platformHelp("de");
    const index = createHelpIndex(de.entries, de.errors);
    expect(index.search("Sicherung")[0]?.id).toBe("help.backup");
    expect(index.search("pairing")[0]?.id).toBe("help.access");
    expect(index.search("pairing.code_invalid")[0]?.id).toBe("help.access");
    const pt = platformHelp("pt-BR");
    expect(createHelpIndex(pt.entries).search("orcamento")[0]?.id).toBe("help.budget");
  });
});
