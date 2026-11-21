# @nodestro/ui-tokens

Brand-neutral design tokens: CSS custom properties with the prefix `--ui-` and the same tokens as JSON, generated
from one source, with a light and a dark theme. No runtime dependencies, no install scripts.

## Files

| Import | Content |
|---|---|
| `@nodestro/ui-tokens/tokens.css` | All custom properties: globals, light theme (default), dark theme, system dark, reduced motion |
| `@nodestro/ui-tokens/tokens.json` | The same tokens as data: CSS name, type, description, value or one value per theme |
| `@nodestro/ui-tokens/contrast-pairs.json` | The foreground/background pairs every theme must meet (WCAG 2.x AA) |

## Use

```css
@import '@nodestro/ui-tokens/tokens.css';

.card {
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  padding: var(--ui-space-4);
}
```

Themes:

- Light is the default.
- `data-theme="dark"` on `<html>` or on any element switches that subtree to dark.
- Without `data-theme="light"` on the root, the system setting (`prefers-color-scheme: dark`) selects dark.
- `prefers-reduced-motion: reduce` sets every `--ui-duration-*` to `0ms`.

## Brands

This package carries no brand. A product supplies its brand as a theme: a stylesheet loaded after `tokens.css` that
sets the values of semantic tokens (for example `--ui-color-primary`, `--ui-radius-sm`) for both themes, using the
same selectors (see `selectors` in `tokens.json`). A brand theme must meet every pair in `contrast-pairs.json`.

## Install

The package is not published to a registry. Products vendor the tarball and check its SHA-256; see `docs/consuming.md`
in the repository.
