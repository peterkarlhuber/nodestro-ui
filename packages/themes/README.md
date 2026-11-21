# @nodestro/ui-themes

Brand themes for `@nodestro/ui-tokens`. A theme is only the token values that differ from the neutral default, with
the same selectors (light by default, `data-theme="dark"`, the system setting, reduced motion), so it is loaded after
`tokens.css`:

```css
@import '@nodestro/ui-tokens/tokens.css';
@import '@nodestro/ui-themes/nodestro.css';
```

| Theme | Content |
|---|---|
| `neutral.css` | the neutral default, no overrides |
| `nodestro.css` | Nodestro Studio's Midnight Citron (`--nd-` values mapped to roles), its radii and motion |
| `example.css` | a second example brand that proves theming (violet, square corners); not a product |

Every theme meets every WCAG pair of `@nodestro/ui-tokens/contrast-pairs.json` in light and dark (tested), may set
roles and global scales only, never a new token. `themes.json` holds the overrides as data.

The base packages (`tokens`, `core`, `ai`) stay brand-neutral; brands live here or in the product.
