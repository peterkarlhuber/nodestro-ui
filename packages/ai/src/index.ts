// @nodestro/ui-ai: components for AI products. Props and i18n keys only: no data fetching, no product dependency.
// Styles: import "@nodestro/ui-ai/styles.css" after "@nodestro/ui-core/styles.css".
export { ApprovalCard, formatCountdown, type ApprovalCardProps, type ApprovalDecision, type ApprovalKind } from "./ApprovalCard.js";
export { ChatMessage, type ChatAttachment, type ChatMessageProps, type ChatRole } from "./ChatMessage.js";
export { aiMessages, useAiText, type AiKey } from "./messages.js";
export {
  DEFAULT_REMEMBER,
  REMEMBER_DURATIONS,
  RememberOptions,
  rememberComplete,
  type RejectOnlyReason,
  type RememberChoice,
  type RememberDuration,
  type RememberOptionsProps,
  type RememberScope,
} from "./RememberOptions.js";
export { SourceList, domainOf, safeHref, type Source, type SourceListProps } from "./SourceList.js";
export { TOOL_CALL_TONE, ToolCallRow, type ToolCallRowProps, type ToolCallStatus } from "./ToolCallRow.js";
