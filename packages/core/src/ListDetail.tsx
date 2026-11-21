// A list of entries and the details of the selected one. The list is a listbox with one tab stop: arrow keys, Home
// and End move the selection, the details follow it and are labelled by the selected entry.
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx, useCoreText } from "./util.js";

export interface ListItem {
  id: string;
  label: ReactNode;
  /** A second line (status, date). */
  description?: ReactNode;
}

export interface ListDetailProps<T extends ListItem> {
  /** The accessible name of the list. */
  label: string;
  items: readonly T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderDetail: (item: T) => ReactNode;
  /** Shown instead of the list when it is empty. */
  empty?: ReactNode;
  className?: string;
}

export function ListDetail<T extends ListItem>({ label, items, selectedId, onSelect, renderDetail, empty, className }: ListDetailProps<T>) {
  const t = useCoreText();
  const base = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const optionId = (id: string) => `${base}-option-${items.findIndex((item) => item.id === id)}`;

  const move = (index: number) => {
    const item = items[Math.max(0, Math.min(items.length - 1, index))];
    if (!item) return;
    onSelect(item.id);
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(item.id))}`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const current = items.findIndex((item) => item.id === selectedId);
    const keys: Record<string, number> = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: items.length - 1 };
    if (event.key in keys) {
      event.preventDefault();
      move(current < 0 && event.key === "ArrowUp" ? 0 : keys[event.key]);
    }
  };

  if (!items.length) return <p className={cx("ui-list-detail__empty", className)}>{empty ?? t("core.list.empty")}</p>;
  // The single tab stop: the selected entry, else the first one.
  const tabStop = selected?.id ?? items[0].id;
  return (
    <div className={cx("ui-list-detail", className)}>
      <ul ref={listRef} className="ui-list-detail__list" role="listbox" aria-label={label} onKeyDown={onKeyDown}>
        {items.map((item) => (
          <li
            key={item.id}
            id={optionId(item.id)}
            role="option"
            aria-selected={item.id === selectedId}
            tabIndex={item.id === tabStop ? 0 : -1}
            className={cx("ui-list-detail__item", item.id === selectedId && "ui-list-detail__item--selected")}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(item.id);
              }
            }}
          >
            <span className="ui-list-detail__label">{item.label}</span>
            {item.description ? <span className="ui-list-detail__description">{item.description}</span> : null}
          </li>
        ))}
      </ul>
      <section className="ui-list-detail__detail" aria-labelledby={selected ? optionId(selected.id) : undefined} aria-live="polite">
        {selected ? renderDetail(selected) : <p className="ui-list-detail__hint">{t("core.list.noSelection")}</p>}
      </section>
    </div>
  );
}
