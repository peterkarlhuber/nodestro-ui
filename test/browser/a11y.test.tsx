// axe-core in Chrome: no WCAG 2.x A or AA violation in any component state, for every brand in light and dark.
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Gallery } from "./fixtures";
import { AXE_SOURCE, BRANDS, THEMES, launch, open } from "./harness";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

interface Violation {
  id: string;
  impact: string;
  help: string;
  nodes: Array<{ target: string[]; failureSummary: string }>;
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launch();
  page = await browser.newPage();
});
afterAll(async () => browser?.close());

async function axe(): Promise<{ violations: Violation[]; passes: number; incomplete: Violation[] }> {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async (tags) => {
    const result = await (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: Violation[]; passes: unknown[]; incomplete: Violation[] }> } }).axe.run(document, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations", "incomplete"],
    });
    return { violations: result.violations, passes: result.passes.length, incomplete: result.incomplete };
  }, TAGS);
}

const describeViolations = (violations: Violation[]) =>
  violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary}`).join("\n  ")}`).join("\n");

describe("accessibility (axe-core, WCAG 2.x A and AA)", () => {
  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      it(`${brand} ${theme}: no violations`, async () => {
        await open(page, <Gallery />, brand, theme, `Gallery ${brand} ${theme}`);
        const { violations, passes } = await axe();
        expect(passes).toBeGreaterThan(10);
        expect(describeViolations(violations)).toBe("");
      });
    }
  }
});
