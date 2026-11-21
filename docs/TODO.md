# TODO

Open work for N-16 (shared UI library), in order. The first step (this repository's skeleton and the `tokens`
package) is done; `core`, `ai` and product adoption are wave 3.

## tokens

- [ ] Brand themes for the three studios, generated from `migration/*.json` (product values per role), in the products
  or in `brands/<name>/` outside the base packages; contrast-checked with `contrast-pairs.json` like the default theme.
- [ ] Decide whether nodestro-studio keeps 11px and 18px text (two nearest-step changes, see `docs/token-mapping.md`)
  through its brand theme or takes the shared scale.
- [ ] Density variants (`data-density`) once `core` has components that use `control-height` and `row-height`.
- [ ] Size budget per package in CI (P0-6 recommendation), with `core`.

## core and ai (wave 3)

- [ ] `packages/core`: Button, IconButton, Dialog/ConfirmDialog (native `<dialog>`, CSP `style-src 'self'`), form
  fields, Toast, Tooltip/HelpTip, Tabs, Menu, DataTable, Badge/Alert/EmptyState/Skeleton/Spinner,
  UnsavedChangesGuard, theme switch, i18n bootstrap for six languages. Seeds: axentra-studio `src/components/ui/`,
  tabrion-studio `Dialog`. Peers: react, lucide-react, i18next (add them to `ALLOWED_EXTERNAL` in
  `test/package-graph.test.mjs`).
- [ ] Correct the "MIT" origin comments in tabrion-studio before any of its code moves here (P0-10).
- [ ] Peer versions aligned first: lucide-react 0.515 vs 1.66, Vite 6 vs 8, vitest 4 vs 5.
- [ ] `packages/ai`: approval cards, tool-call rows, chat messages, composer with attachments, safe Markdown with code
  blocks, reasoning view, model picker with license notice. Seed: nodestro-studio `src/assistant/`.
- [ ] Contract tests per brand: visual snapshots, axe (no A/AA violations), i18n key coverage for six languages.
- [ ] Lint (eslint with jsx-a11y, `--max-warnings=0`) and Prettier with the first TypeScript/React package.

## Product adoption (wave 3)

- [ ] `platform/internal-ui.txt` and a `bump_pins.py` pin kind `npm-tarball` in nodestro-studio (P0-8).
- [ ] Vendor script in each product with the SHA-256 check before `npm ci` (`docs/consuming.md`).
- [ ] Alias layer per product (`--nd-bg: var(--ui-color-bg)`, generated from `migration/*.json`), then a codemod per
  repository, then remove the alias layer.
- [ ] Contract test in each product's CI so that a version bump cannot break it unnoticed.
- [ ] Locria and Studio render the same approval card from the package with their own brand (snapshot per brand).

## Repository

- [ ] npm ecosystem in `.github/dependabot.yml` with the first dependency.
- [ ] Re-run `node scripts/mapping.mjs --verify <dir with the product checkouts>` before product adoption; the
  mapping records the commit that last changed each product file.
