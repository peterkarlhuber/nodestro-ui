// An approval card: something waits for a person (a step's result, a tool call, a budget decision). It shows what
// to review, an optional comment, optional "remember this decision" options, the time left, and approve or reject.
// Nothing is decided automatically and nothing is fetched here: the product passes the data and handles the two
// callbacks (with the comment and the remembered choice). The product's own texts can replace any key.
import { Button, Field, TextArea, cx } from "@nodestro/ui-core";
import { useId, useState, type ReactNode } from "react";
import { CheckIcon, CoinIcon, CrossIcon, HandIcon, ShieldIcon } from "./icons.js";
import { useAiText } from "./messages.js";
import { DEFAULT_REMEMBER, RememberOptions, rememberComplete, type RejectOnlyReason, type RememberChoice } from "./RememberOptions.js";

export type ApprovalKind = "step" | "tool" | "budget";

/** m:ss for a number of seconds (negative counts as 0). */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export interface ApprovalDecision {
  comment: string;
  /** The chosen rule, or null for "this call only" (or when remembering is not offered or not allowed). */
  remember: RememberChoice | null;
}

export interface ApprovalCardProps {
  kind?: ApprovalKind;
  /** What waits, for example the step's or the tool's name. Also names the card for assistive technology. */
  title: string;
  /** Where it waits (workflow, run, time), under the title. */
  context?: ReactNode;
  /** A help button or link next to the title (for example a HelpTip). */
  help?: ReactNode;
  /** Instructions written by whoever asked for the approval. */
  instructions?: ReactNode;
  /** Badges such as what a tool may do. */
  badges?: ReactNode;
  /** The exact arguments of a tool call, shown as JSON. */
  arguments?: unknown;
  /** What to review (results, the budget request). */
  children?: ReactNode;
  /** Seconds left to decide; at 0 or below the card shows that time is up and blocks both decisions. */
  secondsLeft?: number | null;
  /** Offer a comment (only people read it). */
  allowComment?: boolean;
  /** Rejecting needs a comment. */
  requireCommentOnReject?: boolean;
  /** Offer "remember this decision" for the agent with this name. */
  rememberAgent?: string | null;
  /** Approving cannot be remembered (rejecting still can). */
  rejectOnly?: RejectOnlyReason | null;
  /** What rejecting does (stops the run, takes another branch). */
  rejectHint?: ReactNode;
  /** A problem with the last decision, from the product. */
  error?: ReactNode;
  /** The decision that is being sent: its button shows busy, both are blocked. */
  pending?: "approve" | "reject" | null;
  onApprove: (decision: ApprovalDecision) => void;
  onReject: (decision: ApprovalDecision) => void;
  className?: string;
}

const KIND_ICON = { step: HandIcon, tool: ShieldIcon, budget: CoinIcon } as const;

export function ApprovalCard({
  kind = "step",
  title,
  context,
  help,
  instructions,
  badges,
  arguments: args,
  children,
  secondsLeft = null,
  allowComment = false,
  requireCommentOnReject = false,
  rememberAgent = null,
  rejectOnly = null,
  rejectHint,
  error,
  pending = null,
  onApprove,
  onReject,
  className,
}: ApprovalCardProps) {
  const t = useAiText();
  const base = useId();
  const [comment, setComment] = useState("");
  const [remember, setRemember] = useState<RememberChoice>(DEFAULT_REMEMBER);
  const Icon = KIND_ICON[kind];
  const expired = secondsLeft !== null && secondsLeft <= 0;
  const commentMissing = allowComment && requireCommentOnReject && !comment.trim();
  const ruleChosen = rememberAgent !== null && remember.duration !== "call";
  const incomplete = ruleChosen && !rememberComplete(remember);
  const busy = pending !== null;
  const reasonId = `${base}-reason`;
  const reason = incomplete ? t("ai.approval.incomplete") : commentMissing ? t("ai.approval.commentFirst") : null;
  const decision = (approving: boolean): ApprovalDecision => ({
    comment: comment.trim(),
    remember: ruleChosen && !(approving && rejectOnly) ? remember : null,
  });
  const hasReview = Boolean(children) || args !== undefined;
  return (
    <article className={cx("ui-approval", `ui-approval--${kind}`, className)} aria-label={t("ai.approval.label", { name: title })}>
      <header className="ui-approval__head">
        <span className="ui-approval__icon">
          <Icon />
        </span>
        <div className="ui-approval__heading">
          <span className="ui-approval__kind">{t(`ai.approval.kind.${kind}`)}</span>
          <strong className="ui-approval__title">{title}</strong>
          {context ? <span className="ui-approval__context">{context}</span> : null}
        </div>
        {help ? <span className="ui-approval__help">{help}</span> : null}
      </header>
      {instructions ? <p className="ui-approval__instructions">{instructions}</p> : null}
      {badges ? <div className="ui-approval__badges">{badges}</div> : null}
      {args !== undefined ? (
        <div className="ui-approval__arguments">
          <span className="ui-approval__label" id={`${base}-args`}>
            {t("ai.approval.arguments")}
          </span>
          {/* Scrollable when long, so it must be reachable by keyboard (WCAG 2.1.1). */}
          <pre className="ui-approval__code" tabIndex={0} aria-labelledby={`${base}-args`}>
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      ) : null}
      {children ? <div className="ui-approval__review">{children}</div> : null}
      {!hasReview ? <p className="ui-approval__muted">{t("ai.approval.nothingToReview")}</p> : null}
      {secondsLeft !== null ? (
        <p className={cx("ui-approval__deadline", expired && "ui-approval__deadline--expired")} aria-live="polite">
          {expired ? t("ai.approval.expired") : t("ai.approval.timeLeft", { time: formatCountdown(secondsLeft) })}
        </p>
      ) : null}
      {allowComment ? (
        <Field
          label={requireCommentOnReject ? t("ai.approval.commentRequired") : t("ai.approval.comment")}
          hint={t("ai.approval.commentHint")}
        >
          <TextArea rows={3} maxLength={4000} value={comment} onChange={(event) => setComment(event.target.value)} />
        </Field>
      ) : null}
      {rememberAgent !== null ? <RememberOptions value={remember} onChange={setRemember} agent={rememberAgent} rejectOnly={rejectOnly} /> : null}
      {rejectHint ? <p className="ui-approval__muted">{rejectHint}</p> : null}
      {error ? (
        <div className="ui-approval__error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="ui-approval__actions">
        <Button
          variant="primary"
          icon={<CheckIcon />}
          busy={pending === "approve"}
          disabled={busy || expired || (incomplete && !rejectOnly)}
          aria-describedby={incomplete && !rejectOnly ? reasonId : undefined}
          onClick={() => onApprove(decision(true))}
        >
          {t("ai.approval.approve")}
        </Button>
        <Button
          variant="danger"
          icon={<CrossIcon />}
          busy={pending === "reject"}
          disabled={busy || expired || commentMissing || incomplete}
          aria-describedby={reason ? reasonId : undefined}
          onClick={() => onReject(decision(false))}
        >
          {t("ai.approval.reject")}
        </Button>
        {/* The reason sits next to the buttons, not in a tooltip that touch and keyboard users never see. */}
        {reason ? (
          <span className="ui-approval__reason" id={reasonId}>
            {reason}
          </span>
        ) : null}
      </div>
    </article>
  );
}
