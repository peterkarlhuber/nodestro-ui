// Buttons. A busy button keeps its place in the tab order and says so to assistive technology (aria-busy); a
// disabled one is really disabled. A button blocked for a reason the person can fix (aria-disabled, described by
// that reason) stays focusable, looks disabled and does nothing when pressed. An icon-only button always has an
// accessible name, and shows it as the shared Tooltip on hover and keyboard focus. A two-step button
// (ConfirmIconButton) guards an action that cannot be undone: the first press turns it into a labelled confirmation
// that takes the focus.
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "./Spinner.js";
import { Tooltip } from "./Tooltip.js";
import { cx, useCoreText } from "./util.js";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A working state: shows a spinner, blocks clicks and sets aria-busy. */
  busy?: boolean;
  /** A decorative icon before the text (hidden from assistive technology). */
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", busy = false, icon, className, children, type = "button", onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-button", `ui-button--${variant}`, size === "sm" && "ui-button--sm", className)}
      aria-busy={busy || undefined}
      onClick={busy || rest["aria-disabled"] === true || rest["aria-disabled"] === "true" ? (event) => event.preventDefault() : onClick}
      {...rest}
    >
      {busy ? <Spinner /> : icon ? <span className="ui-button__icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "children" | "icon"> {
  /** The accessible name (required: the button shows no text), also shown as its tooltip. */
  label: string;
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", className, busy, ...rest },
  ref,
) {
  const t = useCoreText();
  return (
    <Tooltip content={label}>
      <Button ref={ref} variant={variant} className={cx("ui-icon-button", className)} aria-label={busy ? `${label} (${t("core.busy")})` : label} busy={busy} {...rest}>
        {busy ? null : (
          <span className="ui-button__icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </Button>
    </Tooltip>
  );
});

/** How long an armed confirmation waits for its second press. */
export const CONFIRM_MS = 5000;

export interface ConfirmIconButtonProps extends Omit<IconButtonProps, "onClick"> {
  /** The text of the second step; "Delete?" by default. */
  confirmLabel?: string;
  /** Runs on the second press. */
  onConfirm: () => void;
}

/**
 * An icon button for an action that cannot be undone (deleting a run, a file, a key): the first press turns it into a
 * labelled danger button ("Delete?") that takes the focus, the second press acts. Escape, leaving the button or
 * CONFIRM_MS without a press turn it back; Escape and the second press give the focus back to the icon button.
 */
export function ConfirmIconButton({ icon, label, confirmLabel, onConfirm, busy, className, ...rest }: ConfirmIconButtonProps) {
  const t = useCoreText();
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  // Escape and the second press hand the focus back to the icon button instead of dropping it to the page.
  const refocus = useRef(false);
  useEffect(() => {
    if (!armed) {
      if (refocus.current) iconRef.current?.focus();
      refocus.current = false;
      return;
    }
    confirmRef.current?.focus();
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);
  const text = confirmLabel ?? t("core.confirm.delete");
  if (!armed) return <IconButton ref={iconRef} icon={icon} label={label} className={className} onClick={() => setArmed(true)} disabled={busy} {...rest} />;
  return (
    <Button
      ref={confirmRef}
      size="sm"
      variant="danger"
      icon={icon}
      busy={busy}
      className={cx("ui-confirm-button", className)}
      aria-label={`${label}: ${text}`}
      onClick={() => {
        refocus.current = true;
        setArmed(false);
        onConfirm();
      }}
      onBlur={() => {
        if (!refocus.current) setArmed(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // Undoes only the first press, not a dialog around the button.
        event.stopPropagation();
        refocus.current = true;
        setArmed(false);
      }}
      {...rest}
    >
      {text}
    </Button>
  );
}
