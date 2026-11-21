// One tool call of an agent: the tool, its status as text (never colour alone), how long it took, a one-line summary,
// and the arguments and result behind a disclosure.
import { Badge, Collapsible, cx, type Tone } from "@nodestro/ui-core";
import type { ReactNode } from "react";
import { useAiText } from "./messages.js";

export type ToolCallStatus = "pending" | "running" | "awaiting_approval" | "succeeded" | "failed" | "denied" | "cancelled";

export const TOOL_CALL_TONE: Readonly<Record<ToolCallStatus, Tone>> = {
  pending: "idle",
  running: "running",
  awaiting_approval: "warning",
  succeeded: "success",
  failed: "danger",
  denied: "danger",
  cancelled: "neutral",
};

export interface ToolCallRowProps {
  name: string;
  status: ToolCallStatus;
  /** Already formatted, for example "1.2 s". */
  duration?: string;
  /** One line on what the call did. */
  summary?: ReactNode;
  /** Shown as JSON in the details. */
  arguments?: unknown;
  /** The result or the error, as the product renders it. */
  result?: ReactNode;
  /** Extra content after the status (for example who approved it). */
  note?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function ToolCallRow({ name, status, duration, summary, arguments: args, result, note, defaultOpen = false, className }: ToolCallRowProps) {
  const t = useAiText();
  const hasDetails = args !== undefined || result !== undefined;
  return (
    <div className={cx("ui-tool-call", `ui-tool-call--${status}`, className)} role="group" aria-label={t("ai.toolCall.label", { name })}>
      <div className="ui-tool-call__line">
        <code className="ui-tool-call__name">{name}</code>
        <Badge tone={TOOL_CALL_TONE[status]}>{t(`ai.toolCall.status.${status}`)}</Badge>
        {duration ? <span className="ui-tool-call__meta">{t("ai.toolCall.duration", { duration })}</span> : null}
        {summary ? <span className="ui-tool-call__summary">{summary}</span> : null}
      </div>
      {note ? <div className="ui-tool-call__note">{note}</div> : null}
      {hasDetails ? (
        <Collapsible title={t("ai.toolCall.details")} defaultOpen={defaultOpen} level={4} className="ui-tool-call__details">
          {args !== undefined ? (
            <>
              <p className="ui-tool-call__label">{t("ai.toolCall.arguments")}</p>
              <pre className="ui-tool-call__code" tabIndex={0}>
                {JSON.stringify(args, null, 2)}
              </pre>
            </>
          ) : null}
          {result !== undefined ? (
            <>
              <p className="ui-tool-call__label">{t("ai.toolCall.result")}</p>
              <div className="ui-tool-call__result">{result}</div>
            </>
          ) : null}
        </Collapsible>
      ) : null}
    </div>
  );
}
