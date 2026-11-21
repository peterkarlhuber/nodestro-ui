// Buttons. A busy button keeps its place in the tab order and says so to assistive technology (aria-busy); a
// disabled one is really disabled. An icon-only button always has an accessible name.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "./Spinner.js";
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
      onClick={busy ? (event) => event.preventDefault() : onClick}
      {...rest}
    >
      {busy ? <Spinner /> : icon ? <span className="ui-button__icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "children" | "icon"> {
  /** The accessible name (required: the button shows no text). */
  label: string;
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", className, busy, ...rest },
  ref,
) {
  const t = useCoreText();
  return (
    <Button
      ref={ref}
      variant={variant}
      className={cx("ui-icon-button", className)}
      aria-label={busy ? `${label} (${t("core.busy")})` : label}
      title={label}
      busy={busy}
      {...rest}
    >
      {busy ? null : <span className="ui-button__icon" aria-hidden="true">{icon}</span>}
    </Button>
  );
});
