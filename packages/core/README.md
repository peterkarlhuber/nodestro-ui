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

`helpCoverage(codes, registry, exceptions)` returns the codes without help or exception, references to missing
entries and stale exceptions; a product test asserts that all three are empty.
