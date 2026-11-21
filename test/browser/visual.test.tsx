// Visual snapshot of the approval card per brand (light and dark): every element's colours, borders, radii and type
// as Chrome computes them, compared with test/browser/__snapshots__/. The same component renders in every brand (same
// structure), and the brands really differ. Screenshots go to test-results/ for review (not compared: pixels depend
// on the fonts of the machine).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApprovalFixture } from "./fixtures";
import { BRANDS, ROOT, THEMES, launch, open, type Brand, type Theme } from "./harness";

const PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-left-color",
  "border-top-width",
  "border-left-width",
  "border-top-left-radius",
  "font-family",
  "font-size",
  "font-weight",
  "padding-top",
  "padding-left",
  "box-shadow",
] as const;

interface Node {
  path: string;
  style: Record<string, string>;
}

let browser: Browser;
let page: Page;
const results = new Map<string, Node[]>();

beforeAll(async () => {
  browser = await launch();
  page = await browser.newPage({ viewport: { width: 820, height: 1200 }, deviceScaleFactor: 1 });
});
afterAll(async () => browser?.close());

async function snapshot(brand: Brand, theme: Theme): Promise<Node[]> {
  await open(page, <ApprovalFixture />, brand, theme, `Approval card ${brand} ${theme}`);
  const nodes = await page.evaluate((props) => {
    const root = document.querySelector("article.ui-approval");
    if (!root) throw new Error("no approval card");
    const out: Array<{ path: string; style: Record<string, string> }> = [];
    const walk = (el: Element, path: string) => {
      const style = getComputedStyle(el);
      const own: Record<string, string> = {};
      for (const prop of props) own[prop] = style.getPropertyValue(prop);
      out.push({ path, style: own });
      [...el.children].forEach((child, i) => {
        const name = child.tagName.toLowerCase() + ([...child.classList].filter((c) => c.startsWith("ui-")).map((c) => `.${c}`).join("") || "");
        walk(child, `${path} > ${name}:${i}`);
      });
    };
    walk(root, "article.ui-approval");
    return out;
  }, PROPS as unknown as string[]);
  mkdirSync(join(ROOT, "test-results"), { recursive: true });
  await page.locator("article.ui-approval").screenshot({ path: join(ROOT, "test-results", `approval-card.${brand}.${theme}.png`), animations: "disabled" });
  return nodes;
}

describe("approval card per brand", () => {
  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      it(`${brand} ${theme} matches its snapshot`, async () => {
        const nodes = await snapshot(brand, theme);
        results.set(`${brand}.${theme}`, nodes);
        const text = `${nodes.map((n) => JSON.stringify(n)).join("\n")}\n`;
        await expect(text).toMatchFileSnapshot(join(ROOT, "test/browser/__snapshots__", `approval-card.${brand}.${theme}.jsonl`));
      });
    }
  }

  it("is the same component in every brand and theme (same elements)", () => {
    expect(results.size).toBe(BRANDS.length * THEMES.length);
    const paths = [...results.values()].map((nodes) => nodes.map((n) => n.path).join("\n"));
    for (const p of paths) expect(p).toBe(paths[0]);
  });

  it("looks different in every brand (the theme reaches the component)", () => {
    const primary = (key: string) =>
      results.get(key)!.find((n) => n.path.includes("ui-button--primary"))!.style["background-color"];
    for (const theme of THEMES) {
      const colours = BRANDS.map((brand) => primary(`${brand}.${theme}`));
      expect(new Set(colours).size, colours.join(", ")).toBe(BRANDS.length);
    }
    const radius = (key: string) => results.get(key)![0].style["border-top-left-radius"];
    expect(new Set(BRANDS.map((brand) => radius(`${brand}.light`))).size).toBe(BRANDS.length);
  });
});
