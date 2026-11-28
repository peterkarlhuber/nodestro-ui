// Tooltip: a short explanation of one element (a button, a badge, a value), shown on hover and on keyboard focus,
// optionally with a link to the article that covers it. It is not a help button of its own (that is HelpTip): the
// element keeps its own role and action.
//
// - Pointer hover shows it after a short delay, keyboard focus (:focus-visible) at once; touch has no hover. Leaving
//   the element and the tooltip hides it after a short delay, so the tooltip itself can be hovered (WCAG 1.4.13).
//   Showing cancels a pending close, so a close queued by an earlier pointer leave never hides a tooltip that keyboard
//   focus has just opened. A press on the element hides it, so it never stands in the way of the action.
// - Escape hides it and is not consumed: a tooltip only names a control (often the one a dialog focuses first), so
//   the same Escape still does what it does without one, such as closing the dialog. Escape never moves focus or the
//   pointer.
// - One tooltip or help panel is open at a time (layer.ts).
// - The tooltip follows its element in the DOM, so inside a modal dialog it is part of the dialog (the rest of the
//   page is inert there), and it is shown in the top layer as a manual popover, above modal dialogs and outside every
//   overflow and transform of its ancestors (layer.ts; without the Popover API a fixed element with
//   --ui-z-tooltip). It is placed on the preferred side, flipped when there is no room, shifted at the window's edges
//   and scrolls when it is taller than the window; through the CSSOM, no style attribute (strict CSP).
// - In the browser it is in the DOM only while shown (and the element is aria-describedby its text then), so its text
//   never doubles a label for find-in-page, text search or test locators. Server-rendered markup lists it hidden.
// - `help` takes the text and the link from a registered help entry (HelpProvider); `content` then overrides the
//   text. The link opens through the registry's onOpen (in the product) and is not a Tab stop: the tooltip of a
//   focused element is gone once focus moves on.
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { safeHelpHref, useHelpRegistry } from "./help.js";
import { HAS_POPOVER, claimLayer, focusVisible, lowerLayer, positionLayerAt, raiseLayer, releaseLayer } from "./layer.js";
import { cx, useCoreText } from "./util.js";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 140;

const noSubscription = () => () => undefined;

export interface TooltipProps {
  content: ReactNode;
  /** One element that takes focus (a button, a link). */
  children: ReactElement<{ "aria-describedby"?: string }>;
  placement?: "top" | "bottom";
  className?: string;
}

/** A tooltip that explains its element with a registered help entry: its summary (or `content`) and its article. */
export interface HelpTooltipProps extends Omit<TooltipProps, "content"> {
  /** The id of a help entry (HelpProvider). */
  help: string;
  /** Replaces the entry's summary as the text; the link still leads to the entry's article. */
  content?: ReactNode;
}

type TriggerProps = {
  "aria-describedby"?: string;
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
};

export function Tooltip({ content, children, placement, className }: TooltipProps): import("react").JSX.Element;
export function Tooltip(props: HelpTooltipProps): import("react").JSX.Element;
export function Tooltip(props: TooltipProps | HelpTooltipProps): import("react").JSX.Element {
  const { children, placement = "top", className } = props;
  const help = "help" in props ? props.help : undefined;
  const t = useCoreText();
  const registry = useHelpRegistry();
  const entry = help ? registry.entries[help] : undefined;
  const text = props.content ?? entry?.summary;
  const href = safeHelpHref(entry?.href);

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [side, setSide] = useState<"top" | "bottom">(placement);
  const id = useId();
  const textId = useId();
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const open = anchor !== null;
  // false while rendering on the server (and while hydrating that markup), true in the browser.
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  const rendered = open || !inBrowser;

  const clear = () => window.clearTimeout(timer.current);
  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setAnchor(null);
  }, []);
  const show = useCallback(
    (element: HTMLElement) => {
      window.clearTimeout(timer.current);
      claimLayer(close);
      setAnchor(element);
    },
    [close],
  );
  const later = (action: () => void, delay: number) => {
    clear();
    timer.current = window.setTimeout(action, delay);
  };
  const inside = (target: EventTarget | null) =>
    target instanceof Node && Boolean(anchor?.contains(target) || bubbleRef.current?.contains(target));

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    releaseLayer(close);
  }, [close]);

  // Into the top layer and next to its element while shown; out of it when hidden.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!anchor || !bubble) return;
    raiseLayer(bubble);
    setSide(positionLayerAt(bubble, anchor, placement).below ? "bottom" : "top");
    return () => lowerLayer(bubble);
  }, [anchor, placement, text]);

  useEffect(() => {
    if (!anchor) {
      releaseLayer(close);
      return;
    }
    // Not consumed: the same Escape still reaches the dialog or page around the element.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: globalThis.PointerEvent) => {
      if (!inside(event.target)) close();
    };
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node && bubbleRef.current?.contains(event.target))) close();
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
  }, [anchor, close]);

  if (!isValidElement(children)) throw new Error("Tooltip needs exactly one element child");
  if (text === null || text === undefined || text === false || text === "") return children;

  const own = children.props as TriggerProps;
  const describedBy = [own["aria-describedby"], rendered ? textId : undefined].filter(Boolean).join(" ") || undefined;
  const trigger = cloneElement(children as ReactElement<TriggerProps>, {
    "aria-describedby": describedBy,
    onPointerEnter: (event) => {
      own.onPointerEnter?.(event);
      if (event.pointerType === "touch") return;
      const element = event.currentTarget;
      if (anchor === element) clear();
      else later(() => show(element), OPEN_DELAY);
    },
    onPointerLeave: (event) => {
      own.onPointerLeave?.(event);
      if (event.pointerType !== "touch") later(close, CLOSE_DELAY);
    },
    onPointerDown: (event) => {
      own.onPointerDown?.(event);
      close();
    },
    onFocus: (event) => {
      own.onFocus?.(event);
      if (anchor === event.currentTarget) clear();
      else if (focusVisible(event.currentTarget)) show(event.currentTarget);
    },
    onBlur: (event) => {
      own.onBlur?.(event);
      if (!inside(event.relatedTarget)) later(close, CLOSE_DELAY);
    },
  });

  return (
    <>
      {trigger}
      {rendered ? (
        <span
          ref={bubbleRef}
          id={id}
          role="tooltip"
          className={cx("ui-tooltip", `ui-tooltip--${open ? side : placement}`, className)}
          hidden={!open}
          popover={HAS_POPOVER ? "manual" : undefined}
          onPointerEnter={clear}
          onPointerLeave={() => later(close, CLOSE_DELAY)}
          onClick={(event) => {
            // Inside a <label> or <summary> a press on the text would also act on the control or the section.
            event.stopPropagation();
            if (!(event.target instanceof Element && event.target.closest("a"))) event.preventDefault();
          }}
        >
          <span className="ui-tooltip__bubble">
            <span className="ui-tooltip__text" id={textId}>
              {text}
            </span>
            {href ? (
              <a
                className="ui-tooltip__link"
                href={href}
                tabIndex={-1}
                onClick={(event) => {
                  if (registry.onOpen && help && entry) {
                    event.preventDefault();
                    registry.onOpen(help, entry);
                  }
                  close();
                }}
              >
                {t("core.help.more")}
              </a>
            ) : null}
          </span>
        </span>
      ) : null}
    </>
  );
}
