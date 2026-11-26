# @nodestro/ui-help

Brand-neutral help content for the stable error codes of the platform API, for the context help of
`@nodestro/ui-core` (`HelpProvider`, `HelpTip`, `ErrorHelp`, `HelpSearch`). Texts and an error map only: no styles,
no runtime dependency besides `@nodestro/ui-core` (peer), no network.

| Export | What it is |
|---|---|
| `platformHelp(locale, options?)` | `{ entries, errors }` for `HelpProvider` in one language (any tag, English fallback) |
| `HELP_ERRORS` | error code family (`"access.*"`) or exact code -> help entry id |
| `helpMessages` | the catalog: `help.<topic>.title`, `.summary` and `.keywords` in en, de, fr, es, it, pt-BR |

## Use

```tsx
import { HelpProvider, HelpSearch, ErrorHelp } from '@nodestro/ui-core';
import { platformHelp } from '@nodestro/ui-help';

const help = useMemo(() => platformHelp(i18n.language, { hrefs: { 'help.access': '/docs/access' } }), [i18n.language]);
const entries = useMemo(() => ({ ...help.entries, ...productEntries }), [help, productEntries]);

<HelpProvider entries={entries} errors={{ ...help.errors, ...productErrors }} onOpen={openHelpPanel}>
  <ErrorHelp code={problem.code}>{message}</ErrorHelp>
  <HelpSearch />
</HelpProvider>;
```

An entry explains a family of error codes in one or two sentences: what went wrong and what to do. The product adds
its own entries (product-specific help stays in the product), maps single codes to them (an exact code wins over a
family), and may answer any text itself through the `translate` option.

## Coverage

Every error code of the platform API has an entry here or a listed exception. The repository checks this against a
pinned copy of the API's code list (`errors/` at the repository root, `test/components/help-coverage.test.ts`).
