# TODO

Open work for N-16 (shared UI library), in order. Done: the skeleton and `tokens` (wave 2); `themes`, `core`, `ai`,
the browser checks and the first product step in nodestro-studio (wave 3, N-16 step 2); N-17 help infrastructure
(wave 4).

## tokens and themes

- [ ] Brand themes of axentra-studio and tabrion-studio (in those products or here), generated from
  `migration/*.json` like the Nodestro theme, contrast-checked the same way.
- [ ] Decide whether nodestro-studio keeps 11px and 18px text (two nearest-step changes, see `docs/token-mapping.md`)
  through its brand theme or takes the shared scale (the Nodestro theme keeps the shared scale for now).
- [ ] Density variants (`data-density`) once more components use `control-height` and `row-height`.
- [ ] Size budget per package in CI (P0-6 recommendation).

## core and ai

- [ ] More of the P0-6 `core` cut: Toast, Tabs, Menu, DataTable, Alert/EmptyState/Skeleton, UnsavedChangesGuard,
  theme switch.
- [ ] More of `ai`: composer with attachments, safe Markdown with code blocks, reasoning view, model picker with
  license notice (seed: nodestro-studio `src/assistant/`).
- [x] N-17 help infrastructure: offline full-text search (`HelpSearch`, `createHelpIndex`), error code families
  (`"run.*"`) in the error map and in `helpCoverage`, help from a six-language catalog (`helpEntriesFromCatalog`),
  core 0.2.0 (ai 0.2.0 for the peer range); `@nodestro/ui-help` 0.1.0 with the help for every error code family of
  the platform API in six languages; coverage test against the pinned code list `errors/api-error-codes.json`.
- [ ] Re-pin `errors/api-error-codes.json` whenever the API's code list changes
  (`node scripts/error-codes.mjs --verify <dir> --ref origin/master`, then `--write`), and add help or an exception
  for each new family. It is a manual step like `mapping.mjs --verify`; a check in the API's CI that reads this
  repository's pinned list would make it automatic (not done: it adds a cross-repository fetch to that CI).
- [ ] Finer help for frequent single codes (exact keys win over families) once products report which errors people
  look up; product-specific help stays in the products.
- [ ] Lint (eslint with jsx-a11y, `--max-warnings=0`) and Prettier.
- [ ] Correct the "MIT" origin comments in tabrion-studio before any of its code moves here (P0-10).
- [ ] `admin` package (layout of settings pages, state displays), after the first products use core.

## Product adoption

- [x] nodestro-studio: vendored tarballs with SHA-256 check before `npm ci`, `platform/internal-ui.txt`, pin kind in
  `bump_pins.py`, one component in use (the remember options of the tool approval card), contract test.
- [x] nodestro-studio: the step and tool approval cards use `ApprovalCard` (ai 0.3.0: `label`, `extra`, controlled
  remember options, `rememberIncomplete`, root attributes; a decision blocked by a missing comment stays focusable).
- [x] nodestro-studio: the budget approval card (ai 0.4.0: `confirmReject`, `readOnly`, `actionsHelp`, `footer`).
- [ ] nodestro-studio: the tool call rows, chat messages and web sources (ai 0.5.0: root attributes; `ToolCallRow`
  `statusText`, `icon`, `details`, `disclosure`; `ChatMessage` `avatar`, `hideHead`, `label`, `statusLine`;
  `SourceList` `itemProps`, `hideEmpty`).
- [ ] Alias layer per product (`--nd-bg: var(--ui-color-bg)`, generated from `migration/*.json`), then a codemod per
  repository, then remove the alias layer.
- [ ] A second product renders the same approval card with its own brand.
- [x] nodestro-studio: bump the pins to core 0.2.0, ai 0.2.0 and help 0.1.0; show `ErrorHelp` with `platformHelp` for
  API errors and `HelpSearch` in its help panel.
- [x] `HelpTip` for every help button of a product (core 0.2.1, studio ST-068): hover and keyboard focus, hoverable
  and dismissible panel (WCAG 1.4.13), Escape closes only the panel inside a dialog, top layer above modal dialogs,
  `data-help` on the button. nodestro-studio moved its own help tooltips onto it.
- [ ] A browser check of the open panel (top layer above a modal dialog, axe on the open state); the browser checks
  here render static markup only, so today the product's browser tests (studio `e2e/settings-ui.mjs`) cover it.
- [x] The plain `Tooltip` for every button, badge and value of a product (core 0.2.2, studio ST-068): hover after a
  delay and keyboard focus at once, hoverable, Escape hides it and still reaches the dialog, one tooltip or help panel
  at a time, top layer above modal dialogs, placement inside the window, optional help entry with its link
  (`help="<id>"`). nodestro-studio moves its own `Tooltip`/`Hint` onto it.

## Repository

- [x] npm ecosystem in `.github/dependabot.yml`.
- [x] CI-FAST: `.github/ci-manifest.json` lists the mandatory jobs of `ci.yml` (`check (node 22)`, `check (node 24)`,
  `browser (axe, snapshots per brand)`); `ci-ok.yml` reports on them (report-only, as in the other repositories), with
  the byte-identical `.github/scripts/ci_ok.py`, its tests and `ruff.toml`. No new job; K8 applies from now on.
- [ ] Run `python3 -I .github/scripts/ci_ok.py --self-check --root .` whenever the manifest or a job name in
  `ci.yml` changes (it is not a PR step in this wave, per studio `docs/architecture/ci-fast/ci-ok.md`).
- [ ] Re-run `node scripts/mapping.mjs --verify <dir with the product checkouts>` before further product adoption.
