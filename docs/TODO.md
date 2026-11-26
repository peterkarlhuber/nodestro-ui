# TODO

Open work for N-16 (shared UI library), in order. Done: the skeleton and `tokens` (wave 2); `themes`, `core`, `ai`,
the browser checks and the first product step in nodestro-studio (wave 3, N-16 step 2).

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
- [ ] Offline full-text search for help (N-17, small building block next to `HelpProvider`).
- [ ] Lint (eslint with jsx-a11y, `--max-warnings=0`) and Prettier.
- [ ] Correct the "MIT" origin comments in tabrion-studio before any of its code moves here (P0-10).
- [ ] `admin` package (layout of settings pages, state displays), after the first products use core.

## Product adoption

- [x] nodestro-studio: vendored tarballs with SHA-256 check before `npm ci`, `platform/internal-ui.txt`, pin kind in
  `bump_pins.py`, one component in use (the remember options of the tool approval card), contract test.
- [ ] nodestro-studio: move the approval cards (step, tool, budget) to `ApprovalCard`, then the tool call rows,
  messages and sources (its docs/TODO.md lists the order).
- [ ] Alias layer per product (`--nd-bg: var(--ui-color-bg)`, generated from `migration/*.json`), then a codemod per
  repository, then remove the alias layer.
- [ ] A second product renders the same approval card with its own brand.

## Repository

- [x] npm ecosystem in `.github/dependabot.yml`.
- [x] CI-FAST: `.github/ci-manifest.json` lists the mandatory jobs of `ci.yml` (`check (node 22)`, `check (node 24)`,
  `browser (axe, snapshots per brand)`); `ci-ok.yml` reports on them (report-only, as in the other repositories), with
  the byte-identical `.github/scripts/ci_ok.py`, its tests and `ruff.toml`. No new job; K8 applies from now on.
- [ ] Run `python3 -I .github/scripts/ci_ok.py --self-check --root .` whenever the manifest or a job name in
  `ci.yml` changes (it is not a PR step in this wave, per studio `docs/architecture/ci-fast/ci-ok.md`).
- [ ] Re-run `node scripts/mapping.mjs --verify <dir with the product checkouts>` before further product adoption.
