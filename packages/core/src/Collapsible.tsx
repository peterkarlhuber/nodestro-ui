// A collapsible section: a heading with a disclosure button (aria-expanded, aria-controls) and a region that is
// hidden while collapsed. Open state is the section's own unless the owner controls it (open + onOpenChange).
import { useId, useState, type ReactNode } from "react";
import { cx } from "./util.js";

export interface CollapsibleProps {
  title: ReactNode;
  /** A short line next to the title that stays visible while collapsed (for example a count). */
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The heading level of the title (2 to 6). */
  level?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export function Collapsible({ title, summary, children, defaultOpen = false, open, onOpenChange, level = 3, className }: CollapsibleProps) {
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;
  const id = useId();
  const Heading = `h${level}` as const;
  const toggle = () => {
    if (open === undefined) setOwn(!isOpen);
    onOpenChange?.(!isOpen);
  };
  return (
    <div className={cx("ui-collapsible", isOpen && "ui-collapsible--open", className)}>
      <Heading className="ui-collapsible__heading">
        <button type="button" className="ui-collapsible__toggle" id={`${id}-toggle`} aria-expanded={isOpen} aria-controls={`${id}-panel`} onClick={toggle}>
          <span className="ui-collapsible__chevron" aria-hidden="true" />
          <span className="ui-collapsible__title">{title}</span>
          {summary ? <span className="ui-collapsible__summary">{summary}</span> : null}
        </button>
      </Heading>
      <div className="ui-collapsible__panel" id={`${id}-panel`} role="region" aria-labelledby={`${id}-toggle`} hidden={!isOpen}>
        {isOpen ? children : null}
      </div>
    </div>
  );
}
