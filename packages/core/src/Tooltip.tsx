// Tooltip: a short description of a control, shown on hover and on keyboard focus, dismissable with Escape and
// hoverable itself (WCAG 1.4.13). The text is always in the DOM and linked with aria-describedby, so assistive
// technology reads it even while it is not shown. Positioned with CSS only (no inline styles: strict CSP).
import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react";
import { cx } from "./util.js";

export interface TooltipProps {
  content: ReactNode;
  /** One element that takes focus (a button, a link). */
  children: ReactElement<{ "aria-describedby"?: string }>;
  placement?: "top" | "bottom";
  className?: string;
}

export function Tooltip({ content, children, placement = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!isValidElement(children)) throw new Error("Tooltip needs exactly one element child");
  const describedBy = [children.props["aria-describedby"], id].filter(Boolean).join(" ");
  return (
    <span
      className={cx("ui-tooltip", `ui-tooltip--${placement}`, open && "ui-tooltip--open", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      {cloneElement(children, { "aria-describedby": describedBy })}
      <span role="tooltip" id={id} className="ui-tooltip__bubble" hidden={!open}>
        {content}
      </span>
    </span>
  );
}
