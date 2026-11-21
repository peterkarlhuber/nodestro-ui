// Reads the custom properties of a product stylesheet: name -> { light, dark } or { value }.
// Only top-level rules count (no @media, no rule sets that are not listed in the selector map).
// A property declared for both themes is themed; one declared once is a global value.

function normalizeSelector(selector) {
  return selector.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").trim();
}

/** Top-level rules as [{ selector, declarations: Map(name -> value) }]. */
export function parseRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let depth = 0;
  let start = 0;
  let selector = null;
  let bodyStart = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") {
      if (depth === 0) {
        selector = text.slice(start, i);
        bodyStart = i + 1;
      }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        const body = text.slice(bodyStart, i);
        const declarations = new Map();
        if (!selector.trim().startsWith("@")) {
          for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
            declarations.set(m[1], m[2].replace(/\s+/g, " ").trim());
          }
        }
        rules.push({ selector: normalizeSelector(selector), declarations });
        start = i + 1;
      }
    }
  }
  return rules;
}

/**
 * The inventory of one stylesheet. `selectors` maps a normalized selector to "light", "dark" or "global";
 * rules with other selectors are ignored. Returns name -> { light, dark } | { value }, in declaration order.
 */
export function inventory(css, selectors, prefix) {
  const seen = new Map();
  for (const { selector, declarations } of parseRules(css)) {
    const role = selectors[selector];
    if (!role) continue;
    for (const [name, value] of declarations) {
      if (!name.startsWith(prefix)) continue;
      if (!seen.has(name)) seen.set(name, {});
      seen.get(name)[role] = value;
    }
  }
  const out = new Map();
  for (const [name, roles] of seen) {
    if ("light" in roles && "dark" in roles) out.set(name, { light: roles.light, dark: roles.dark });
    else out.set(name, { value: roles.global ?? roles.light ?? roles.dark });
  }
  return out;
}
