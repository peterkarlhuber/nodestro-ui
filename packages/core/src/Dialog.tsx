// A modal dialog on the native <dialog> element (no style injection, so it works under a strict
// Content-Security-Policy without 'unsafe-inline'). Opening moves focus into the dialog (the initial focus element,
// else the first focusable element), Tab and Shift+Tab stay inside it (focus trap), Escape and the close button
// close it, and closing returns focus to the element that had it before.
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Button } from "./Button.js";
import { cx, focusableIn, useCoreText, useEvent } from "./util.js";

export interface DialogProps {
  open: boolean;
  /** Called on Escape, on the close button and on a click on the backdrop. */
  onClose: () => void;
  title: ReactNode;
  /** A short description, announced with the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Actions at the bottom (for example Cancel and Save). */
  footer?: ReactNode;
  /** The element to focus on opening; defaults to the first focusable element. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** alertdialog for a confirmation that interrupts the user. */
  role?: "dialog" | "alertdialog";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, footer, initialFocus, role = "dialog", size = "md", className }: DialogProps) {
  const t = useCoreText();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = useEvent(onClose);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    const target = initialFocus?.current ?? focusableIn(dialog)[0] ?? dialog;
    target.focus();
    return () => {
      if (dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      if (previous && previous.isConnected) previous.focus();
    };
  }, [open, initialFocus]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Escape fires "cancel"; the dialog closes only when the owner sets open to false.
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [close]);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const items = focusableIn(ref.current);
    if (!items.length) {
      event.preventDefault();
      ref.current.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === ref.current || !ref.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !ref.current.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;
  return (
    // The backdrop is the dialog element itself: a click on it (not on its content) closes.
    <dialog
      ref={ref}
      className={cx("ui-dialog", `ui-dialog--${size}`, className)}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <div className="ui-dialog__panel">
        <header className="ui-dialog__header">
          <h2 className="ui-dialog__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="ui-dialog__close" aria-label={t("core.dialog.close")} onClick={close}>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        {description ? (
          <p className="ui-dialog__description" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {children ? <div className="ui-dialog__body">{children}</div> : null}
        {footer ? <footer className="ui-dialog__footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger for an action that cannot be undone. */
  tone?: "primary" | "danger";
  busy?: boolean;
}

/** A confirmation. Focus starts on Cancel, so Enter never confirms by accident. */
export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel, cancelLabel, tone = "primary", busy = false }: ConfirmDialogProps) {
  const t = useCoreText();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      role="alertdialog"
      size="sm"
      initialFocus={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} onClick={onCancel}>
            {cancelLabel ?? t("core.confirm.cancel")}
          </Button>
          <Button variant={tone} busy={busy} onClick={onConfirm}>
            {confirmLabel ?? t("core.confirm.confirm")}
          </Button>
        </>
      }
    />
  );
}
