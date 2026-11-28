// HelpTip: a small help button next to a label. Its panel shows the entry's title, summary and a link to the full
// article, in a non-modal popover above everything else (layer.ts: the top layer, so also above a modal dialog).
//
// - Pointer hover opens it after a short delay and keyboard focus at once; leaving the button and the panel closes it
//   (the panel itself can be hovered, WCAG 1.4.13). A press (click, tap, Enter, Space) pins it open until a second
//   press, Escape or a press outside. Touch has no hover: a tap pins it.
// - Escape closes only the panel (never the dialog around it) and returns focus to the button when it was inside.
// - One panel is open at a time. Showing cancels a pending close, so a close queued by an earlier pointer leave
//   never hides a panel that keyboard focus has just opened.
// - The panel follows the button in the DOM. Once pinned, Tab from the button leads into its link and on to the next
//   control (never a focus trap); a panel shown only by passing focus keeps the normal Tab order (its link is not a
//   Tab stop then).
// - In the browser the panel is in the DOM only while it is open, so its texts never double the labels next to it
//   for find-in-page, text search or a page's own reading of its headings. Server-rendered markup lists it hidden.
// - The button carries data-help="<id>", so a product can find help by what is on the page (e.g. a settings search
//   that reads the help of each setting from the registry).
// ErrorHelp shows an error with its stable code and, when the product registered one, the help that explains it.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { helpIdForError, safeHelpHref, useHelpRegistry, type HelpEntry } from "./help.js";
import { HAS_POPOVER, focusVisible, lowerLayer, positionLayer, raiseLayer } from "./layer.js";
import { cx, useCoreText } from "./util.js";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 140;

let closeActive: (() => void) | null = null;

const noSubscription = () => () => undefined;

export interface HelpTipProps {
  /** A registered help entry. */
  id?: string;
  /** Or the entry itself (for help that is not registered). */
  entry?: HelpEntry;
  /** What the help is about, for the button's accessible name ("Help: <topic>"); defaults to the entry title. */
  topic?: string;
  className?: string;
}

type OpenState = "closed" | "shown" | "pinned";

export function HelpTip({ id, entry: given, topic, className }: HelpTipProps) {
  const t = useCoreText();
  const registry = useHelpRegistry();
  const entry = given ?? (id ? registry.entries[id] : undefined);
  const [state, setState] = useState<OpenState>("closed");
  const panelId = useId();
  const summaryId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const open = state !== "closed";
  // false while rendering on the server (and while hydrating that markup), true in the browser.
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  const rendered = open || !inBrowser;

  const clear = () => window.clearTimeout(timer.current);
  const inside = (target: EventTarget | null) =>
    target instanceof Node && Boolean(buttonRef.current?.contains(target) || panelRef.current?.contains(target));
  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setState("closed");
  }, []);
  const show = useCallback(
    (next: Exclude<OpenState, "closed">) => {
      window.clearTimeout(timer.current);
      if (closeActive && closeActive !== close) closeActive();
      closeActive = close;
      setState(next);
    },
    [close],
  );
  const later = (action: () => void, delay: number) => {
    clear();
    timer.current = window.setTimeout(action, delay);
  };

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (closeActive === close) closeActive = null;
  }, [close]);

  // Into the top layer and next to the button while open; out of it when closed.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (!open || !panel || !button) return;
    raiseLayer(panel);
    positionLayer(panel, button);
    return () => lowerLayer(panel);
  }, [open, entry]);

  useEffect(() => {
    if (!open) {
      if (closeActive === close) closeActive = null;
      return;
    }
    // Captured before a dialog's own handler: Escape closes the panel and goes no further.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      const focused = panelRef.current?.contains(document.activeElement);
      close();
      if (focused) buttonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target)) close();
    };
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node && panelRef.current?.contains(event.target))) close();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  if (!entry) return null;
  const href = safeHelpHref(entry.href);
  const pinned = state === "pinned";
  const leave = () => {
    if (state !== "pinned") later(close, CLOSE_DELAY);
  };

  const panel = (
    <span
      ref={panelRef}
      className="ui-helptip__panel"
      id={panelId}
      role="group"
      aria-label={entry.title}
      hidden={!open}
      popover={HAS_POPOVER ? "manual" : undefined}
      onPointerEnter={clear}
      onPointerLeave={leave}
      onBlur={(event) => {
        // Focus moved on from the panel's link: done with it, pinned or not.
        if (!inside(event.relatedTarget)) later(close, CLOSE_DELAY);
      }}
      onClick={(event) => {
        // Inside a <label> or <summary> a press on the text would also act on the control or the section.
        event.stopPropagation();
        if (!(event.target instanceof Element && event.target.closest("a"))) event.preventDefault();
      }}
    >
      <strong className="ui-helptip__title">{entry.title}</strong>
      <span className="ui-helptip__summary" id={summaryId}>
        {entry.summary}
      </span>
      {href ? (
        <a
          className="ui-helptip__more"
          href={href}
          // A Tab stop only once the panel was opened on purpose; passing focus keeps the normal order.
          tabIndex={pinned ? undefined : -1}
          onClick={(event) => {
            if (registry.onOpen && id) {
              event.preventDefault();
              registry.onOpen(id, entry);
            }
            close();
          }}
        >
          {t("core.help.more")}
        </a>
      ) : null}
    </span>
  );

  return (
    <span className={cx("ui-helptip", open && "ui-helptip--open", className)}>
      <button
        ref={buttonRef}
        type="button"
        className="ui-helptip__button"
        data-help={id}
        aria-label={t("core.help.button", { topic: topic ?? entry.title })}
        aria-expanded={open}
        aria-controls={rendered ? panelId : undefined}
        aria-describedby={open ? summaryId : undefined}
        onClick={(event) => {
          // Inside a <summary> the press would also open or close the section.
          event.preventDefault();
          event.stopPropagation();
          if (pinned) close();
          else show("pinned");
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          if (open) clear();
          else later(() => show("shown"), OPEN_DELAY);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") leave();
        }}
        onFocus={(event) => {
          if (open) clear();
          else if (focusVisible(event.currentTarget)) show("shown");
        }}
        onBlur={(event) => {
          if (inside(event.relatedTarget)) return;
          if (state !== "pinned") later(close, CLOSE_DELAY);
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {rendered ? panel : null}
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
