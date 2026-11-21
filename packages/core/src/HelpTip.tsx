// HelpTip: a small help button next to a label. It opens a non-modal popover with the entry's summary and a link to
// the full article; Escape or a second press closes it and focus returns to the button. ErrorHelp shows an error
// with its stable code and, when the product registered one, the help that explains it.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { helpIdForError, safeHelpHref, useHelpRegistry, type HelpEntry } from "./help.js";
import { cx, useCoreText } from "./util.js";

export interface HelpTipProps {
  /** A registered help entry. */
  id?: string;
  /** Or the entry itself (for help that is not registered). */
  entry?: HelpEntry;
  /** What the help is about, for the button's accessible name ("Help: <topic>"); defaults to the entry title. */
  topic?: string;
  className?: string;
}

export function HelpTip({ id, entry: given, topic, className }: HelpTipProps) {
  const t = useCoreText();
  const registry = useHelpRegistry();
  const entry = given ?? (id ? registry.entries[id] : undefined);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (!entry) return null;
  const href = safeHelpHref(entry.href);
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  return (
    <span
      ref={rootRef}
      className={cx("ui-helptip", open && "ui-helptip--open", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="ui-helptip__button"
        aria-label={t("core.help.button", { topic: topic ?? entry.title })}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">?</span>
      </button>
      <span className="ui-helptip__panel" id={panelId} role="group" aria-label={entry.title} hidden={!open}>
        <strong className="ui-helptip__title">{entry.title}</strong>
        <span className="ui-helptip__summary">{entry.summary}</span>
        {href ? (
          <a
            className="ui-helptip__more"
            href={href}
            onClick={(event) => {
              if (registry.onOpen && id) {
                event.preventDefault();
                registry.onOpen(id, entry);
                setOpen(false);
              }
            }}
          >
            {t("core.help.more")}
          </a>
        ) : null}
      </span>
    </span>
  );
}

export interface ErrorHelpProps {
  /** The stable error code from the API. */
  code: string;
  /** The message to show (already translated by the product). */
  children: ReactNode;
  className?: string;
}

/** An error with its code and, when registered, its help. Announced as an alert. */
export function ErrorHelp({ code, children, className }: ErrorHelpProps) {
  const t = useCoreText();
  const registry = useHelpRegistry();
  const id = helpIdForError(registry, code);
  return (
    <div className={cx("ui-error-help", className)} role="alert">
      <p className="ui-error-help__message">{children}</p>
      <p className="ui-error-help__meta">
        <span className="ui-error-help__code">{t("core.error.code", { code })}</span>
        {id ? (
          <>
            <span className="ui-error-help__label">{t("core.error.help")}</span>
            <HelpTip id={id} />
          </>
        ) : null}
      </p>
    </div>
  );
}
