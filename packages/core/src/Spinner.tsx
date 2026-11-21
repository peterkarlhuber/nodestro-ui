// A small spinner. Decorative by default; with a label it is a status that assistive technology announces.
import { cx } from "./util.js";

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return label ? (
    <span className={cx("ui-spinner-wrap", className)} role="status">
      <span className="ui-spinner" aria-hidden="true" />
      <span className="ui-visually-hidden">{label}</span>
    </span>
  ) : (
    <span className={cx("ui-spinner", className)} aria-hidden="true" />
  );
}
