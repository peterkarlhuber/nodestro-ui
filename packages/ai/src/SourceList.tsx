// The sources an answer is based on, numbered by their id. Titles come from web pages: they are plain text, never
// markup. A link opens only an http(s) address, in a new tab without a referrer.
import { cx, isInAppPath } from "@nodestro/ui-core";
import { useId, type HTMLAttributes, type LiHTMLAttributes, type ReactNode } from "react";
import { useAiText } from "./messages.js";

export interface Source {
  /** A short id the answer cites, for example "S1". */
  id: string;
  title: string;
  url?: string;
  /** Extra information (time, read or only found), as the product renders it. */
  meta?: ReactNode;
  /** A status badge. */
  badge?: ReactNode;
}

/**
 * An http(s) address (and with `allowPaths` an in-app path), or null for anything else. Backslashes and control
 * characters are refused everywhere, and a value starting with "/" is only ever a path, never "//host" or "/<backslash>host".
 */
export function safeHref(value: string | undefined, allowPaths = false): string | null {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.startsWith("/")) return allowPaths && isInAppPath(value) ? value : null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** The host name without "www.", or "". */
export function domainOf(value: string | undefined): string {
  const href = safeHref(value);
  return href ? new URL(href).hostname.replace(/^www\./, "") : "";
}

/** The list; other attributes (data-*, id) go to its section. */
export interface SourceListProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "children"> {
  sources: readonly Source[];
  /** The heading; defaults to "Sources". */
  title?: ReactNode;
  /** A line under the heading. */
  hint?: ReactNode;
  /** The heading level (2 to 6). */
  level?: 2 | 3 | 4 | 5 | 6;
  className?: string;
  /** Attributes of one source's list item (for example a data-testid by its id). */
  itemProps?: (source: Source) => LiHTMLAttributes<HTMLLIElement>;
  /** Nothing at all, instead of "No sources.", when the list is empty. */
  hideEmpty?: boolean;
}

export function SourceList({ sources, title, hint, level = 3, className, itemProps, hideEmpty = false, ...rest }: SourceListProps) {
  const t = useAiText();
  const Heading = `h${level}` as const;
  const headingId = useId();
  if (hideEmpty && !sources.length) return null;
  return (
    <section {...rest} className={cx("ui-sources", className)} aria-labelledby={headingId}>
      <Heading className="ui-sources__title" id={headingId}>{title ?? t("ai.sources.title")}</Heading>
      {hint ? <p className="ui-sources__hint">{hint}</p> : null}
      {sources.length ? (
        <ol className="ui-sources__list">
          {sources.map((source) => {
            const href = safeHref(source.url);
            const domain = domainOf(source.url);
            const label = source.title.trim() || source.url || source.id;
            return (
              <li {...itemProps?.(source)} key={source.id} className={cx("ui-sources__item", itemProps?.(source).className)}>
                <code className="ui-sources__id">{source.id}</code>
                <span className="ui-sources__text">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {label}{" "}
                      {/* The space outside the hidden text, so the link's name keeps it in every engine. */}
                      <span className="ui-visually-hidden">{t("ai.sources.newTab")}</span>
                    </a>
                  ) : (
                    <span>{label}</span>
                  )}
                  {domain || source.meta ? (
                    <span className="ui-sources__meta">
                      {domain}
                      {domain && source.meta ? " · " : null}
                      {source.meta}
                    </span>
                  ) : null}
                </span>
                {source.badge ? <span className="ui-sources__badge">{source.badge}</span> : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="ui-sources__hint">{t("ai.sources.empty")}</p>
      )}
    </section>
  );
}
