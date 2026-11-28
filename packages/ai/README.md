# @nodestro/ui-ai

Brand-neutral React components for AI products. Props and i18n keys only: no data fetching, no product
dependency, no timers that decide anything. Peers: React and `@nodestro/ui-core`.

| Component | Purpose |
|---|---|
| `ApprovalCard` | something waits for a person: a step's result, a tool call (`kind="tool"`, exact `arguments`), a budget decision. Comment (optionally required to reject), time left, "remember this decision", busy and error states. Calls `onApprove`/`onReject` with `{ comment, remember }` |
| `RememberOptions` | how long (this call only, until revoked, until a date) and for whom (this agent, all agents) a decision holds; `rejectOnly` when approving can never be remembered |
| `ToolCallRow` | a tool call: name, status in words, duration, summary, arguments and result behind a disclosure |
| `ChatMessage` | one message: author, time, content, streaming and error states, attachments (safe links only) |
| `SourceList` | numbered sources; titles are text, links only http(s), new tab without referrer |

```tsx
import { ApprovalCard } from '@nodestro/ui-ai';

<ApprovalCard
  kind="tool"
  title={request.tool}
  arguments={request.input}
  secondsLeft={secondsLeft}
  allowComment
  rememberAgent={canRemember ? `${workflowId}/${request.node_id}` : null}
  rejectOnly={request.capability.access === 'destructive' ? 'destructive' : null}
  pending={decide.isPending ? decide.variables : null}
  onApprove={({ comment, remember }) => decide.mutate({ decision: 'approved', comment, remember })}
  onReject={({ comment, remember }) => decide.mutate({ decision: 'rejected', comment, remember })}
/>;
```

Since 0.3.0 a product can use the card for all of its approvals and keep its own data and decisions: `label` names
the card (a list of cards may need where each one waits), `extra` adds fields after the comment (for example a note
to the agent), `remember`/`onRememberChange` hold the remembered choice in the product and `rememberIncomplete` adds
the product's own reason that a chosen rule is not complete yet (for example while the asking agent is not known);
other attributes (`data-*`, `id`) go to the card's root element. A decision blocked for a reason the person can fix
(a missing comment) stays focusable and is described by the reason next to it (`aria-disabled`, core 0.2.3 `Button`);
one that cannot be taken at all (sending, time up, an incomplete rule) is disabled.

Since 0.4.0 a card also fits a decision that cannot be undone, such as ending a run: `confirmReject` asks for a
second press of "Really reject?", which takes focus; Escape (kept inside the card, so a dialog around it stays open),
moving focus away or `CONFIRM_REJECT_MS` (5 s) undo the first press. `actionsHelp` puts a help button next to the
decisions, `footer` shows what comes under them (for example earlier decisions) and `readOnly` shows the card without
comment, remember options and decisions (someone else decides, or it was decided elsewhere). Approving may carry the
product's own input (an `extra` field): the button stays enabled and the product checks the input in `onApprove`.

Styles: `@import '@nodestro/ui-ai/styles.css';` after the core styles. Texts: keys `ai.*` in six languages
(`aiMessages`); a product can answer any key itself through `UiTextProvider` from `@nodestro/ui-core`.
