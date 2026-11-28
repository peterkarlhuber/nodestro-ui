// An approval card: something waits for a person (a step's result, a tool call, a budget decision). It shows what
// to review, an optional comment, optional "remember this decision" options, the time left, and approve or reject.
// Nothing is decided automatically and nothing is fetched here: the product passes the data and handles the two
// callbacks (with the comment and the remembered choice). The product's own texts can replace any key.
//
// A decision that is blocked for a reason the person can fix (a missing comment) stays focusable and is described by
// the reason next to it (aria-disabled), so keyboard and screen reader users learn why; a decision that cannot be
// taken at all (sending, time up, an incomplete rule) is disabled. The product may name the card (`label`), add
// fields after the comment (`extra`), control the remembered choice and add to its completeness
// (`rememberIncomplete`, for example while the asking agent is not known yet); other attributes go to the card.
// A rejection that cannot be undone may ask for a second press (`confirmReject`), a card may show what was decided
// before under the decisions (`footer`), a help button next to them (`actionsHelp`), or no decisions at all
// (`readOnly`: someone else decides, or it was decided elsewhere). Approving may also carry the product's own input:
// the button stays enabled and the product checks that input in onApprove.
import { Button, Field, TextArea, cx } from "@nodestro/ui-core";
import { useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { CheckIcon, CoinIcon, CrossIcon, HandIcon, ShieldIcon } from "./icons.js";
import { useAiText } from "./messages.js";
import { DEFAULT_REMEMBER, RememberOptions, rememberComplete, type RejectOnlyReason, type RememberChoice } from "./RememberOptions.js";

export type ApprovalKind = "step" | "tool" | "budget";

/** How long an armed second press of a confirmed rejection waits. */
export const CONFIRM_REJECT_MS = 5000;

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

/** The card; other attributes (data-*, id) go to its root element. */
export interface ApprovalCardProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "children" | "onChange"> {
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
  /** The card's accessible name; defaults to "Approval: <title>" (a list of cards may need where each one waits). */
  label?: string;
  /** More fields after the comment, for example a note to the agent. */
  extra?: ReactNode;
  /** The remembered choice, controlled by the product (with onRememberChange); uncontrolled without it. */
  remember?: RememberChoice;
  onRememberChange?: (value: RememberChoice) => void;
  /** The product's own reason that a chosen rule is not complete yet (for example the asking agent is not known). */
  rememberIncomplete?: boolean;
  /** Rejecting needs a second press within CONFIRM_REJECT_MS (Escape, leaving the button or the time undo it). */
  confirmReject?: boolean;
  /** Show the card without the decisions (someone else decides, or it was decided elsewhere). */
  readOnly?: boolean;
  /** A help button next to the decisions. */
  actionsHelp?: ReactNode;
  /** Under the decisions, for example what was decided before. */
  footer?: ReactNode;
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
  label,
  extra,
  remember: rememberValue,
  onRememberChange,
  rememberIncomplete = false,
  confirmReject = false,
  readOnly = false,
  actionsHelp,
  footer,
  ...rest
}: ApprovalCardProps) {
  const t = useAiText();
  const base = useId();
  const [comment, setComment] = useState("");
  const [ownRemember, setOwnRemember] = useState<RememberChoice>(DEFAULT_REMEMBER);
  const remember = rememberValue ?? ownRemember;
  const setRemember = (value: RememberChoice) => {
    if (rememberValue === undefined) setOwnRemember(value);
    onRememberChange?.(value);
  };
  const Icon = KIND_ICON[kind];
  const expired = secondsLeft !== null && secondsLeft <= 0;
  const commentMissing = allowComment && requireCommentOnReject && !comment.trim();
  const ruleChosen = rememberAgent !== null && remember.duration !== "call";
  const incomplete = ruleChosen && (!rememberComplete(remember) || rememberIncomplete);
  const busy = pending !== null;
  const reasonId = `${base}-reason`;
  const reason = incomplete ? t("ai.approval.incomplete") : commentMissing ? t("ai.approval.commentFirst") : null;
  const decision = (approving: boolean): ApprovalDecision => ({
    comment: comment.trim(),
    remember: ruleChosen && !(approving && rejectOnly) ? remember : null,
  });
  const hasReview = Boolean(children) || args !== undefined;
  const [armed, setArmed] = useState(false);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!armed) return;
    confirmRef.current?.focus();
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_REJECT_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <article {...rest} className={cx("ui-approval", `ui-approval--${kind}`, className)} aria-label={label ?? t("ai.approval.label", { name: title })}>
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
      {allowComment && !readOnly ? (
        <Field
          label={requireCommentOnReject ? t("ai.approval.commentRequired") : t("ai.approval.comment")}
          hint={t("ai.approval.commentHint")}
        >
          <TextArea rows={3} maxLength={4000} value={comment} onChange={(event) => setComment(event.target.value)} />
        </Field>
      ) : null}
      {extra}
      {rememberAgent !== null && !readOnly ? (
        <RememberOptions value={remember} onChange={setRemember} agent={rememberAgent} rejectOnly={rejectOnly} />
      ) : null}
      {rejectHint ? <p className="ui-approval__muted">{rejectHint}</p> : null}
      {error ? (
        <div className="ui-approval__error" role="alert">
          {error}
        </div>
      ) : null}
      {readOnly ? null : (
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
          {armed ? (
            <Button
              ref={confirmRef}
              variant="danger"
              icon={<CrossIcon />}
              disabled={busy || expired || incomplete}
              onClick={() => {
                setArmed(false);
                onReject(decision(false));
              }}
              onBlur={() => setArmed(false)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                // Undoes only the second press, not a dialog around the card.
                event.stopPropagation();
                setArmed(false);
                rejectRef.current?.focus();
              }}
            >
              {t("ai.approval.rejectConfirm")}
            </Button>
          ) : (
            <Button
              ref={rejectRef}
              variant="danger"
              icon={<CrossIcon />}
              busy={pending === "reject"}
              disabled={busy || expired || incomplete}
              // Blocked until there is a comment, but focusable: the reason next to it says what is missing.
              aria-disabled={commentMissing && !(busy || expired || incomplete) ? true : undefined}
              aria-describedby={reason ? reasonId : undefined}
              onClick={() => {
                if (commentMissing) return;
                if (confirmReject) setArmed(true);
                else onReject(decision(false));
              }}
            >
              {t("ai.approval.reject")}
            </Button>
          )}
          {actionsHelp ? <span className="ui-approval__help">{actionsHelp}</span> : null}
          {/* The reason sits next to the buttons, not in a tooltip that touch and keyboard users never see. */}
          {reason ? (
            <span className="ui-approval__reason" id={reasonId}>
              {reason}
            </span>
          ) : null}
        </div>
      )}
      {footer}
    </article>
  );
}
