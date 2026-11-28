# nodestro-ui

Brand-neutral UI building blocks shared by the products (N-16 of the development plan). One repository with
independently versioned npm workspace packages under `packages/`. No registry: each package ships as a reproducible
tarball that products vendor and check by SHA-256.

| Package | Directory | Status |
|---|---|---|
| `@nodestro/ui-tokens` | `packages/tokens` | 0.1.0: design tokens (`--ui-*` CSS custom properties and JSON), light and dark |
| `@nodestro/ui-themes` | `packages/themes` | 0.1.0: brand themes (token overrides): `neutral`, `nodestro`, `example` |
| `@nodestro/ui-core` | `packages/core` | 0.2.1: buttons, fields, dialogs, list and detail, collapsible sections, tooltip, context help, offline help search |
| `@nodestro/ui-ai` | `packages/ai` | 0.2.0: approval card with remembered decisions, tool call row, chat message, source list |
| `@nodestro/ui-help` | `packages/help` | 0.1.0: help entries for the platform API's error codes in six languages (texts only) |

The component packages take React 19 as a peer dependency and have no other runtime dependency; help takes only
`@nodestro/ui-core` as a peer; tokens and themes have none at all. The development dependencies (TypeScript, Vitest, jsdom, axe-core, playwright-core) are pinned in
`package-lock.json`. Node.js 24 LTS is the target, 22.12 or later is supported.

## Layout

```
packages/tokens/       src/tokens.json (the one source), src/contrast-pairs.json, lib/build.mjs, test/
packages/themes/       src/brands/<brand>.json (overrides), lib/build.mjs, test/
packages/core/         src/*.tsx, src/locales/<lang>.ts, src/styles.css (compiled by scripts/lib/react-package.mjs)
packages/ai/           the same layout; imports @nodestro/ui-core
packages/help/         src/locales/<lang>.ts (help texts), src/errors.ts (error code -> entry); no stylesheet
scripts/pack.mjs       reproducible tarballs, artifacts check
scripts/api.mjs        records the public surface of each package in api/<package>.json
scripts/mapping.mjs    renders docs/token-mapping.md from migration/*.json, verifies it against product checkouts
scripts/error-codes.mjs  pins the API's error code list in errors/, verifies it against an API checkout
errors/                api-error-codes.json (pinned copy, with its API commit), exceptions.json (codes without help)
migration/             each product's current variables and the token that replaces them
artifacts/manifest.json  expected name, version, SHA-256 and npm integrity of every tarball
api/                   the recorded public surface per package (exports, declarations, i18n keys, CSS classes, tokens)
test/                  repository-wide tests: package graph, reproducible build, vendored install, mapping, API
                       contract, brand neutrality; test/components/ (Vitest, jsdom), test/browser/ (Chrome: axe,
                       visual snapshots per brand)
docs/                  design.md (token model), consuming.md (distribution), token-mapping.md, TODO.md
```

## Commands

```sh
npm ci --ignore-scripts
npm test                 # node:test suites and the component tests (Vitest, jsdom)
npm run test:browser     # axe-core and visual snapshots per brand in Chrome (CHROME_PATH or a standard location)
npm run api              # record the public surface after a deliberate change (with its version bump)
npm run build            # write packages/*/dist/ for inspection (not committed)
npm run pack             # dist/<package>.tgz, .sha256, manifest.json
npm run pack:check       # tarballs must match artifacts/manifest.json
npm run pack:manifest    # update artifacts/manifest.json after a deliberate change
npm run mapping          # render docs/token-mapping.md
npm run mapping:check
node scripts/mapping.mjs --verify <dir>   # compare migration/*.json with product checkouts in <dir>
node scripts/error-codes.mjs --verify <dir> [--ref origin/master]   # pinned error codes vs <dir>/nodestro-api
node scripts/error-codes.mjs --write <dir> [--ref origin/master]    # re-pin them (then add help or exceptions)
```

## Rules

- Base packages carry no product brand. Brands are themes supplied by the products (see `docs/design.md`).
- No package depends on a product (tested in `test/package-graph.test.mjs`), and no component fetches data.
- Every stable error code of the platform API has a help entry in `@nodestro/ui-help` or a listed exception
  (`test/components/help-coverage.test.ts`, against the pinned list in `errors/`).
- A change of a package's public surface needs a version bump, a breaking one a breaking bump
  (`test/api-contract.test.mjs` against `origin/master`).
- No publish, no releases, no tags. Products consume tarballs as described in `docs/consuming.md`.

## License

Proprietary, see `LICENSE`. The repository is public; that grants no rights of use.
