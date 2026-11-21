# nodestro-ui

Brand-neutral UI building blocks shared by the products (N-16 of the development plan). One repository with
independently versioned npm workspace packages under `packages/`. No registry: each package ships as a reproducible
tarball that products vendor and check by SHA-256.

| Package | Directory | Status |
|---|---|---|
| `@nodestro/ui-tokens` | `packages/tokens` | 0.1.0: design tokens (`--ui-*` CSS custom properties and JSON), light and dark |
| `@nodestro/ui-core` | `packages/core` | planned (wave 3) |
| `@nodestro/ui-ai` | `packages/ai` | planned (wave 3) |

No runtime or development dependencies; Node.js 24 LTS is the target, 22.12 or later is supported.

## Layout

```
packages/tokens/       src/tokens.json (the one source), src/contrast-pairs.json, lib/build.mjs, test/
scripts/pack.mjs       reproducible tarballs, artifacts check
scripts/mapping.mjs    renders docs/token-mapping.md from migration/*.json, verifies it against product checkouts
migration/             each product's current variables and the token that replaces them
artifacts/manifest.json  expected name, version, SHA-256 and npm integrity of every tarball
test/                  repository-wide tests: package graph, reproducible build, vendored install, mapping
docs/                  design.md (token model), consuming.md (distribution), token-mapping.md, TODO.md
```

## Commands

```sh
npm ci --ignore-scripts
npm test                 # all tests (node:test)
npm run build            # write packages/*/dist/ for inspection (not committed)
npm run pack             # dist/<package>.tgz, .sha256, manifest.json
npm run pack:check       # tarballs must match artifacts/manifest.json
npm run pack:manifest    # update artifacts/manifest.json after a deliberate change
npm run mapping          # render docs/token-mapping.md
npm run mapping:check
node scripts/mapping.mjs --verify <dir>   # compare migration/*.json with product checkouts in <dir>
```

## Rules

- Base packages carry no product brand. Brands are themes supplied by the products (see `docs/design.md`).
- No package depends on a product (tested in `test/package-graph.test.mjs`).
- No publish, no releases, no tags. Products consume tarballs as described in `docs/consuming.md`.

## License

Proprietary, see `LICENSE`. The repository is public; that grants no rights of use.
