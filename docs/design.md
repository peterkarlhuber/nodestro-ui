# Design

## Token model

The `tokens` package (`@nodestro/ui-tokens`) is the base of the shared UI library (N-16). It follows the P0-6 analysis
(annex P0-6/P0-8/P0-10, "Token-Migration"): a neutral prefix, the category structure of the axentra-studio tokens,
semantic roles only, and products that supply nothing but a theme.

### One source, two outputs

`packages/tokens/src/tokens.json` is the only place a token is defined. Each entry has a `type`, a `description`
and either one `value` (global) or `values` for every theme (themed). `lib/build.mjs` validates the source and
generates, in memory and byte-stable:

| File | Content |
|---|---|
| `dist/tokens.css` | custom properties `--ui-<name>` |
| `dist/tokens.json` | `{ format, version, prefix, themes, defaultTheme, selectors, tokens }`; each token has `cssVar`, `type`, `description` and `value` or `values.light`/`values.dark`, durations also `reducedMotion` |
| `dist/contrast-pairs.json` | the WCAG pairs every theme must meet (copied from `src/contrast-pairs.json`) |

Nothing generated is committed: the tarball is built from the source (`scripts/pack.mjs`), and `npm run build`
writes `packages/tokens/dist/` only for local inspection.

The validator rejects a token without a value for every theme, an unknown theme or type, a missing description, a
name that is not lower-case kebab-case, a color that is neither `#rrggbb` nor `rgba(r, g, b, a)`, a value with
`;`, braces, angle brackets or comment markers (so a value can never end the rule), and contrast pairs that name
unknown, global or translucent tokens or use a minimum other than 3 or 4.5.

### Prefix

`--ui-`, as proposed in the P0-6 annex. It names the layer (UI library), not a product, so it stays correct for every
product that adopts the package, and it cannot collide with the product prefixes `--nd-`, `--ax-` and `--tb-`, which
lets a product run old and new tokens side by side during migration.

### Categories

| Category | Names | Themed |
|---|---|---|
| Typography | `font-sans`, `font-display`, `font-mono`, `text-2xs` … `text-3xl` (rem), `leading-*`, `weight-*` | no |
| Spacing | `space-0` … `space-16` (4px grid, rem) | no |
| Shape | `radius-xs` … `radius-xl`, `radius-full` | no |
| Motion | `duration-fast`/`-normal`/`-slow` (0ms with reduced motion), `ease-standard`, `ease-emphasized` | no |
| Layers | `z-sticky`, `z-drawer`, `z-overlay`, `z-toast`, `z-tooltip` | no |
| Density | `control-height`, `row-height` | no |
| Color | `color-*` semantic roles (below) | yes |
| Elevation | `shadow-sm`, `shadow-md`, `shadow-lg` | yes |

Semantic color roles:

- **Surfaces:** `bg`, `surface`, `surface-2`, `surface-raised`, `surface-hover`, `chrome` (application frame),
  `canvas` and `grid` (editors and diagrams), `overlay`, `code-bg`, `skeleton`, `skeleton-shine`, `selected`.
- **Lines:** `border`, `border-strong` (decorative), `control-border` (3:1, WCAG 1.4.11).
- **Text:** `text`, `text-muted`, `text-subtle`, `heading`, `link`.
- **Action:** `primary`, `primary-hover`, `primary-active`, `primary-subtle`, `on-primary`, `accent`, `focus`.
- **Status:** `success`, `warning`, `danger`, `info`, `running`, `idle`, `neutral`, each with `-bg`;
  `danger-hover`, `on-danger`; `diff-added`, `diff-changed`, `diff-removed`.
- **Navigation:** `nav-bg`, `nav-bg-elevated`, `nav-text`, `nav-text-muted`, `nav-text-active`, `nav-indicator`,
  `nav-hover`, `nav-active`, `nav-border`.

The set is the union of what the three studios use (see `docs/token-mapping.md`): the axentra-studio roles, plus
the studio roles without an axentra counterpart that the annex names (`canvas`, `running`, `idle`, `grid`, and the
top bar as `chrome`, the name tabrion-studio already uses), plus tabrion-studio's `selected` and `diff-*`. Every
color role replaces at least one product variable (tested); there is no role that no product needs.

There are no primitives (palette steps) in the output. Components use roles only, and the values behind the roles
belong to the theme: the neutral default theme here, a product's brand theme elsewhere.

### Themes and selectors

```css
:root { /* globals */ }
:root, [data-theme='light'] { color-scheme: light; /* themed tokens */ }
[data-theme='dark'] { color-scheme: dark; /* themed tokens */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { /* dark again */ } }
@media (prefers-reduced-motion: reduce) { :root { --ui-duration-*: 0ms; } }
```

- Light is the default, as in axentra-studio and tabrion-studio. nodestro-studio defaults to dark and keeps that by
  setting `data-theme` on `<html>`, which it already does.
- `data-theme` works on any element, so a subtree (a preview, a dialog) can use the other theme.
- Without an explicit `data-theme="light"` on the root, the system setting selects dark: a page without a theme
  script still follows the user.
- The selectors are in `tokens.json` (`selectors`), so a brand theme can use exactly the same ones.

### Brands

The package is brand-neutral (decision E-0R-3 A and the P0-6 annex): no product name, logo color, font or motif. A
brand is a stylesheet (or JSON that a product turns into one) loaded after `tokens.css` that sets role values for both
themes with the same selectors. It lives in the product, or later in a clearly separate brand folder of this
repository (`brands/<name>/`), never in a base package. A brand may set any token, including radii, durations and
fonts; that is how the products keep their look while sharing the roles. `contrast-pairs.json` is the contract a
brand theme must meet.

### Contrast

`src/contrast-pairs.json` lists 62 foreground/background pairs. Text pairs need 4.5:1 (WCAG 1.4.3); focus ring,
control border, navigation indicator and accent need 3:1 (WCAG 1.4.11). The tests check every pair in both themes,
that every foreground role (text, link, on-*, status colors, nav text, focus, control border, accent) is in at least
one pair, and that every status color is checked on its own `-bg`. Translucent colors (`overlay`, `grid`,
`nav-hover`, `nav-active`, `nav-border`) are not text backgrounds and are not checked.

### Distribution

See `docs/consuming.md`: a reproducible tarball per package, vendored by the products, checked by SHA-256 and by
npm's lockfile integrity. No registry.

### Deviations from the P0-6 annex (tokens)

| Annex | Here | Why |
|---|---|---|
| `tokens` holds "themes per product" and brand colors | Only the neutral theme; brands are product-supplied | Binding decision: the base package is brand-neutral. Brand themes come with product adoption (docs/TODO.md). |
| Mapping table as JSON in the `tokens` package; alias layers `legacy-nd.css` etc. | Mapping JSON in `migration/` at the repository root, rendered to `docs/token-mapping.md`; no alias layers yet | Product prefixes and brand values in the package would break brand neutrality. The alias layers belong to the product migration step and can be generated from `migration/*.json`. |
| Primitives and semantic tokens in CSS | Semantic tokens only | Primitives are theme values; exposing them invites components to bypass the roles. |
| Fonts bundled via `@fontsource` in `tokens` | System font stacks, no font files | Brand-neutral and zero dependencies; a brand theme can add its fonts (and their OFL notices). |
| `npm pack` built twice and compared | Own packer (`scripts/lib/tarball.mjs`): npm layout, fixed metadata, gzip with stored blocks | `npm pack` output depends on the npm and zlib version (Node 22 ships npm 10, Node 24 npm 11), so the SHA-256 would differ between supported Node versions. The stored stream is identical everywhere; the size cost (tens of KB) does not matter. |
| One lockstep version until 1.0 | Each package keeps its own `version`; `artifacts/manifest.json` lists each | The task asks for independently versioned packages; the annex allows it. With one package the difference does not show yet. |
| `topbar` as an extra studio role | `chrome` | tabrion-studio already names the application frame `chrome`; one role, not two. |

## Brand themes

`@nodestro/ui-themes` holds the brands, outside the base packages: `src/brands/<name>.json` lists only the tokens a
brand changes (both themes for a role, one value for a global scale), and the build turns each into
`dist/<name>.css` with the selectors of `tokens.css` (a brand that changes a duration repeats the reduced-motion
rule, which would otherwise lose to it). Three brands: `neutral` (no overrides), `nodestro` (the Midnight Citron
values of nodestro-studio, tested against `migration/nodestro-studio.json`; roles the studio file lacks are derived
from its palette) and `example` (a second, made-up brand that proves theming). Every brand meets every contrast pair
in light and dark. A product with its own brand ships its theme the same way, in its own repository.

## Components

`@nodestro/ui-core` and `@nodestro/ui-ai` are React 19 packages written in TypeScript and compiled by
`scripts/lib/react-package.mjs` (the pinned TypeScript compiler, in memory, byte-stable; the build is also the type
check). Each file becomes `dist/<file>.js` plus `.d.ts`; `src/styles.css` ships as `dist/styles.css`.

- **Accessible by construction:** native elements first (`<button>`, `<select>`, `<dialog>`), names and descriptions
  wired by the components (Field), keyboard behaviour inside the component (focus trap and focus return in Dialog,
  arrow keys in ListDetail, Escape for Tooltip and HelpTip), state as text (badges, busy, reasons next to disabled
  buttons). Checked by the component tests and by axe-core in Chrome for every brand in light and dark.
- **CSP-strict:** no inline styles and no runtime style injection; positions are pure CSS.
- **Props and texts only:** components fetch nothing and decide nothing (the approval card calls back with the
  comment and the remembered choice). Texts come from per-package catalogs in six languages through
  `UiTextProvider`; a product can answer any key from its own i18n.

| P0-6 annex | Here | Why |
|---|---|---|
| CSS Modules per component (axentra-studio) | One plain stylesheet per package, every class prefixed `ui-` | CSS Modules need the consumer's bundler to process files inside `node_modules`; a plain stylesheet works in any product (Vite, a static page) and the prefix avoids collisions as well. |
| Radix primitives where CSP-neutral | No Radix: native `<dialog>` (the tabrion-studio pattern) and native `<select>` | Fewer dependencies, no style injection, platform keyboard and screen reader behaviour. |
| lucide-react and i18next as peers | Neither: four inline SVG icons; an own catalog lookup with a `translate` hook | The products use different lucide majors (0.515 and 1.66); a product with i18next passes it as `translate`. |
| Languages en, de, fr, es, it, pt-BR | The same six | The languages of nodestro-studio and axentra-studio (`LOCALES`). |
| eslint with jsx-a11y | Not yet (docs/TODO.md) | axe-core in a real browser and the keyboard tests cover the components now. |
| Pixel snapshots | Snapshots of the computed styles (colours, borders, radii, type) per element; screenshots as CI artifacts | Pixels depend on the fonts installed on the machine; computed styles are stable and still prove the brand reaches every element. |
