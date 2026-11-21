// A status label: text first (never colour alone), the tone only adds colour.
import type { ReactNode } from "react";
import { cx } from "./util.js";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "running" | "idle";

export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)}>
      {icon ? <span className="ui-badge__icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
