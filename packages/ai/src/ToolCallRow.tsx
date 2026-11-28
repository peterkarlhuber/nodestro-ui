// One tool call of an agent: the tool, its status as text (never colour alone), how long it took, a one-line summary,
// and the arguments and result behind a disclosure. A product may name the status in its own words (`statusText`,
// still text and not colour alone), add an icon and its own details (for example where a tool comes from), and show
// the whole row as one disclosure (`disclosure`) instead of a row with a "Details" section under it.
import { Badge, Collapsible, cx, type Tone } from "@nodestro/ui-core";
import { useState, type HTMLAttributes, type ReactNode } from "react";
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

/** The row; other attributes (data-*, id) go to its root element. */
export interface ToolCallRowProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "children" | "role"> {
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
  /** An icon before the name (decorative). */
  icon?: ReactNode;
  /** The status in the product's words (for example "Succeeded · 10:02"), shown as text instead of the badge. */
  statusText?: ReactNode;
  /** More details between the arguments and the result (for example where the tool comes from). */
  details?: ReactNode;
  /** The whole row opens and closes the details (a native disclosure), as in a compact list of calls. */
  disclosure?: boolean;
}

export function ToolCallRow({
  name,
  status,
  duration,
  summary,
  arguments: args,
  result,
  note,
  defaultOpen = false,
  className,
  icon,
  statusText,
  details,
  disclosure = false,
  ...rest
}: ToolCallRowProps) {
  const t = useAiText();
  const [open, setOpen] = useState(defaultOpen);
  const hasDetails = args !== undefined || result !== undefined || Boolean(details);
  const rootClass = cx("ui-tool-call", `ui-tool-call--${status}`, disclosure && "ui-tool-call--disclosure", className);
  const label = t("ai.toolCall.label", { name });
  const line = (
    <>
      {icon ? (
        <span className="ui-tool-call__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <code className="ui-tool-call__name">{name}</code>
      {statusText ? (
        <span className={cx("ui-tool-call__status", `ui-tool-call__status--${TOOL_CALL_TONE[status]}`)}>{statusText}</span>
      ) : (
        <Badge tone={TOOL_CALL_TONE[status]}>{t(`ai.toolCall.status.${status}`)}</Badge>
      )}
      {duration ? <span className="ui-tool-call__meta">{t("ai.toolCall.duration", { duration })}</span> : null}
      {summary ? <span className="ui-tool-call__summary">{summary}</span> : null}
    </>
  );
  const body = (
    <>
      {args !== undefined ? (
        <>
          <p className="ui-tool-call__label">{t("ai.toolCall.arguments")}</p>
          <pre className="ui-tool-call__code" tabIndex={0}>
            {JSON.stringify(args, null, 2)}
          </pre>
        </>
      ) : null}
      {details}
      {result !== undefined ? (
        <>
          <p className="ui-tool-call__label">{t("ai.toolCall.result")}</p>
          <div className="ui-tool-call__result">{result}</div>
        </>
      ) : null}
    </>
  );
  if (disclosure) {
    return (
      <details {...rest} className={rootClass} aria-label={label} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="ui-tool-call__line">{line}</summary>
        <div className="ui-tool-call__body">
          {body}
          {note ? <div className="ui-tool-call__note">{note}</div> : null}
        </div>
      </details>
    );
  }
  return (
    <div {...rest} className={rootClass} role="group" aria-label={label}>
      <div className="ui-tool-call__line">{line}</div>
      {note ? <div className="ui-tool-call__note">{note}</div> : null}
      {hasDetails ? (
        <Collapsible title={t("ai.toolCall.details")} defaultOpen={defaultOpen} level={4} className="ui-tool-call__details">
          {body}
        </Collapsible>
      ) : null}
    </div>
  );
}
