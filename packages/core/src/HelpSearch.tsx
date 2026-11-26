// HelpSearch: offline full-text search over the registered help entries (HelpProvider). Nothing leaves the page: the
// index is built in memory from the entries. A labelled search field, a polite status with the number of results,
// and the results as a list; each result opens through the product (onOpen), follows its link, or shows its summary.
// Keyboard: Arrow Down moves from the field into the results, Arrow Up and Down move between them (Arrow Up from the
// first result returns to the field), Escape empties the field. A pasted error code finds the help mapped to it.
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { safeHelpHref, useHelpRegistry } from "./help.js";
import { createHelpIndex } from "./search.js";
import { cx, focusableIn, useCoreText } from "./util.js";

export interface HelpSearchProps {
  /** The visible label of the field; defaults to the package text "Search help". */
  label?: string;
  /** The most results shown (default 8). */
  limit?: number;
  /** The query at the start (for example from the page the person came from). */
  defaultQuery?: string;
  className?: string;
}

export function HelpSearch({ label, limit = 8, defaultQuery = "", className }: HelpSearchProps) {
  const t = useCoreText();
  const registry = useHelpRegistry();
  const index = useMemo(() => createHelpIndex(registry.entries, registry.errors), [registry.entries, registry.errors]);
  const [query, setQuery] = useState(defaultQuery);
  const hits = useMemo(() => index.search(query, { limit }), [index, query, limit]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const labelId = useId();
  const inputId = useId();
  const statusId = useId();
  const searched = query.trim().length > 0;

  const results = () => (listRef.current ? focusableIn(listRef.current) : []);
  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const first = event.key === "ArrowDown" ? results()[0] : undefined;
    if (first) {
      event.preventDefault();
      first.focus();
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    }
  };
  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const all = results();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    event.preventDefault();
    if (event.key === "ArrowDown") all[Math.min(at + 1, all.length - 1)].focus();
    else if (at === 0) inputRef.current?.focus();
    else all[at - 1].focus();
  };

  return (
    <div className={cx("ui-help-search", className)} role="search" aria-labelledby={labelId}>
      <label className="ui-help-search__label" id={labelId} htmlFor={inputId}>
        {label ?? t("core.help.search.label")}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className="ui-input ui-help-search__input"
        type="search"
        autoComplete="off"
        value={query}
        aria-describedby={statusId}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onFieldKey}
      />
      <p className="ui-help-search__status" id={statusId} role="status">
        {searched ? (hits.length ? t("core.help.search.results", { count: hits.length }) : t("core.help.search.none")) : ""}
      </p>
      {hits.length ? (
        <ul className="ui-help-search__results" ref={listRef} onKeyDown={onListKey}>
          {hits.map(({ id, entry }) => {
            const href = safeHelpHref(entry.href);
            const open = registry.onOpen;
            return (
              <li key={id} className="ui-help-search__result">
                {href ? (
                  <a
                    className="ui-help-search__title"
                    href={href}
                    onClick={(event) => {
                      if (open) {
                        event.preventDefault();
                        open(id, entry);
                      }
                    }}
                  >
                    {entry.title}
                  </a>
                ) : open ? (
                  <button type="button" className="ui-help-search__title" onClick={() => open(id, entry)}>
                    {entry.title}
                  </button>
                ) : (
                  <strong className="ui-help-search__title">{entry.title}</strong>
                )}
                <span className="ui-help-search__summary">{entry.summary}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
