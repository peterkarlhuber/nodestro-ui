# Consuming the packages

There is no npm registry and there are no releases (assumption A-7, confirmed with a change by P0-6). A product
vendors the tarball of a package, built from a pinned commit of this repository, and checks it twice: against the
SHA-256 in the pin, and through the `integrity` npm writes into its lockfile.

## What this repository produces

`npm run pack` writes to `dist/` (or `--out DIR`):

- `<scope>-<name>-<version>.tgz` per package, for example `nodestro-ui-tokens-0.1.0.tgz`;
- `<file>.sha256` beside each tarball (`sha256sum -c` format);
- `manifest.json`: per package `name`, `version`, `directory`, `file`, `size`, `sha256` and `integrity` (the
  `sha512-…` string npm puts into `package-lock.json`).

The tarballs are reproducible: the same commit gives the same bytes on every platform and on Node 22 and 24. The
expected values are committed in `artifacts/manifest.json`; CI fails if a build differs from it
(`npm run pack:check`), so every change to a shipped byte shows up in review as a new SHA-256
(`npm run pack:manifest` updates it). The CI run also uploads the tarballs as the `ui-packages` artifact (14 days).

A tarball holds `package/package.json` (no scripts, no dependencies for `tokens`), `package/README.md`,
`package/LICENSE` and the generated files.

## How a product pins and installs a package

nodestro-studio is the first consumer (`frontend/vendor/`, `platform/internal-ui.txt`, `scripts/vendor_ui.mjs`); the
steps below are what it does.

1. **Pin** in the product's `platform/internal-ui.txt` (proposed in the P0-8 annex), one line per package:

   ```
   @nodestro/ui-tokens <commit-sha> sha256=<sha256 from artifacts/manifest.json at that commit>
   ```

   `bump_pins.py` gets a pin kind `npm-tarball` that sets the commit and the hash together.

2. **Vendor:** a script in the product (like `nodestro-api/scripts/vendor_app_ui.py`) checks out this repository at
   the pinned commit, runs `npm run pack -- --out <tmp>`, compares each tarball's SHA-256 with the pin and with
   `artifacts/manifest.json` of that commit, and copies it to `vendor/`. Building locally from the commit and
   comparing to the committed hash works because the build is reproducible; it needs no release asset.

3. **Depend** on the file in the product's `package.json` and commit the lockfile:

   ```json
   "dependencies": { "@nodestro/ui-tokens": "file:vendor/nodestro-ui-tokens-0.1.0.tgz" }
   ```

   `package-lock.json` then records `"resolved": "file:vendor/nodestro-ui-tokens-0.1.0.tgz"` and the `integrity`
   from `manifest.json`.

4. **Check before install** in the product's CI, before `npm ci`:

   ```sh
   (cd vendor && sha256sum -c nodestro-ui-tokens-0.1.0.tgz.sha256)
   ```

   This check is required, not optional: with a warm npm cache, `npm ci` can install the cached content of a
   tarball without noticing that the file in `vendor/` changed (P0-6, tested with npm 10.9.9). With a cold cache npm
   stops with `EINTEGRITY`; `test/consume.test.mjs` here checks both the integrity value and that failure.

5. **Use:**

   ```css
   @import '@nodestro/ui-tokens/tokens.css';
   @import '@nodestro/ui-themes/<brand>.css';
   @import '@nodestro/ui-core/styles.css';
   @import '@nodestro/ui-ai/styles.css';
   ```

   React and the other packages are peer dependencies: the product installs all four tarballs it uses and React
   itself, so there is one copy of each.

   ```js
   import tokens from '@nodestro/ui-tokens/tokens.json' with { type: 'json' };
   ```

The studio frontends are built into their Python wheels at build time, so the npm dependency never reaches a Python
consumer.

## Versions and the contract

Each package has its own version. `api/<package>.json` records its public surface (exports, type declarations, i18n
keys, CSS classes, token and brand names); CI compares it with `origin/master` and fails when the surface changes
without a version bump, or when something is removed or changed without a breaking bump (below 1.0 the next minor,
which a caret range `^0.1.0` does not accept). The product's side of the contract is its own CI: it type-checks and
tests what it uses against the vendored tarballs, and its peer ranges make npm refuse a mismatched set.
