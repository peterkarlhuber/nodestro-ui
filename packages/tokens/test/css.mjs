// A small parser for the generated stylesheet: rules with their @media condition and declarations.
// Independent of lib/build.mjs on purpose, so the tests read the CSS the way a browser would see its structure.

/** [{ media: string | null, selector: string, declarations: Map(property -> value) }] */
export function parseCss(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") {
      stack.push({ prelude: text.slice(start, i).trim(), bodyStart: i + 1 });
      start = i + 1;
    } else if (c === "}") {
      const open = stack.pop();
      if (!open) throw new Error(`unbalanced } at ${i}`);
      if (!open.prelude.startsWith("@")) {
        const declarations = new Map();
        for (const part of text.slice(open.bodyStart, i).split(";")) {
          const colon = part.indexOf(":");
          if (colon < 0) {
            if (part.trim()) throw new Error(`not a declaration: ${part.trim()}`);
            continue;
          }
          const property = part.slice(0, colon).trim();
          if (declarations.has(property)) throw new Error(`duplicate ${property} in ${open.prelude}`);
          declarations.set(property, part.slice(colon + 1).trim());
        }
        const media = stack.find((s) => s.prelude.startsWith("@media"))?.prelude ?? null;
        rules.push({ media, selector: open.prelude.replace(/\s+/g, " "), declarations });
      }
      start = i + 1;
    }
  }
  if (stack.length) throw new Error("unbalanced {");
  return rules;
}

export function findRule(rules, selector, media = null) {
  const found = rules.filter((r) => r.selector === selector && r.media === media);
  if (found.length !== 1) throw new Error(`expected one rule ${selector} (${media}), found ${found.length}`);
  return found[0];
}
