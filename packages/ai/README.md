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

Styles: `@import '@nodestro/ui-ai/styles.css';` after the core styles. Texts: keys `ai.*` in six languages
(`aiMessages`); a product can answer any key itself through `UiTextProvider` from `@nodestro/ui-core`.
