# @nodestro/ui-core

Brand-neutral, accessible React building blocks. Every style value is a `--ui-` token, so a brand theme changes the
look without touching a component. No runtime dependencies besides React (peer); no install scripts; works under a
strict Content-Security-Policy (`style-src 'self'`): no inline styles, no injected `<style>`.

| Component | What it does for accessibility |
|---|---|
| `Button`, `IconButton` | `type="button"` by default; busy keeps focus and sets `aria-busy`; an icon button needs a `label` |
| `Field`, `TextInput`, `TextArea`, `Select` | label, hint and error linked to the control (`for`, `aria-describedby`, `aria-invalid`) |
| `Dialog`, `ConfirmDialog` | native `<dialog>`, focus moves in, Tab is trapped, Escape closes, focus returns to the opener; the confirmation starts on Cancel |
| `ListDetail` | a listbox with one tab stop; arrow keys, Home and End; details labelled by the selected entry |
| `Collapsible` | heading plus disclosure button (`aria-expanded`, `aria-controls`), hidden region while collapsed |
| `Tooltip` | shown on hover and focus, Escape hides it, always linked with `aria-describedby` (WCAG 1.4.13) |
| `HelpTip`, `HelpProvider`, `ErrorHelp`, `helpCoverage` | context help by id, error code to help, and a coverage check for the product's tests |
| `HelpSearch`, `createHelpIndex` | offline full-text search over the registered help: labelled search landmark, result count in a polite status, arrow keys between field and results, Escape empties the field |
| `Badge`, `Spinner` | text first, the tone only adds colour |

## Use

```css
@import '@nodestro/ui-tokens/tokens.css';
@import '@nodestro/ui-themes/example.css'; /* optional: a brand theme */
@import '@nodestro/ui-core/styles.css';
```

```tsx
import { Button, Field, TextInput, UiTextProvider } from '@nodestro/ui-core';

<UiTextProvider locale={i18n.language} translate={(key, values) => (i18n.exists(`ui:${key}`) ? i18n.t(`ui:${key}`, values) : undefined)}>
  <Field label="Name" hint="As others see it">
    <TextInput value={name} onChange={(e) => setName(e.target.value)} />
  </Field>
</UiTextProvider>;
```

## Texts

The package ships its texts in six languages (en, de, fr, es, it, pt-BR) under keys `core.*` (`coreMessages`).
`UiTextProvider` sets the language (any tag: `de-AT` becomes `de`, `pt` becomes `pt-BR`) and may answer any key from
the product's own texts; keys it does not answer come from the package. Placeholders use `{{name}}`.

## Context help (N-17)

The package ships no help content. The product registers its entries and the error codes they explain:

```tsx
<HelpProvider entries={{ 'flow.approval': { title: 'Approvals', summary: '…', href: '/docs/approvals' } }}
              errors={{ 'approval.expired': 'flow.approval' }} onOpen={(id) => openHelpPanel(id)}>
  <HelpTip id="flow.approval" />
  <ErrorHelp code={error.code}>{message}</ErrorHelp>
</HelpProvider>
```

An error map key is an exact code or a family ending in `.*` (`'approval.*'`: every code that starts with
`approval.`); the exact code wins, then the longest family. `helpCoverage(codes, registry, exceptions)` returns the
codes without help or exception, references to missing entries, stale exceptions (exceptions may be families too)
and error map keys that match no code; a product test asserts that all four are empty.

Help texts in six languages come as a catalog (`help.<id>.title`, `.summary`, optional `.keywords`, the same shape
as the package texts): `helpEntriesFromCatalog(catalog, locale, { hrefs, translate })` gives the entries of one
language with English as the fallback. `@nodestro/ui-help` is such a catalog for the platform API's error codes.

### Offline search

```tsx
<HelpProvider entries={entries} errors={errors} onOpen={openHelpPanel}>
  <HelpSearch />
</HelpProvider>
```

`HelpSearch` indexes the registered entries in memory (`createHelpIndex(entries, errors)`); nothing is fetched.
Every query word must start a word of the title, the keywords, the id or the summary (title counts most); case and
accents do not matter (`ubersetzung` finds `Übersetzung`, `strasse` finds `Straße`). A pasted error code finds the
entry the error map gives for it first. A result opens through `onOpen`, else follows its (safe) link, else shows
its summary as text. It has no animation, so there is nothing to reduce for `prefers-reduced-motion`.
