// One message of a conversation. The content is whatever the product renders (plain text keeps its line breaks;
// Markdown is the product's choice). A message that is still being written says so (aria-busy).
import { cx } from "@nodestro/ui-core";
import type { ReactNode } from "react";
import { useAiText } from "./messages.js";
import { safeHref } from "./SourceList.js";

export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatAttachment {
  name: string;
  /** Only http(s) and in-app paths become links. */
  href?: string;
  /** Already formatted, for example "12 KB". */
  size?: string;
}

export interface ChatMessageProps {
  role: ChatRole;
  /** The author's name; defaults to the role's name. */
  author?: string;
  /** When it was written: machine-readable and as shown. */
  time?: { iso: string; text: string };
  status?: "complete" | "streaming" | "error";
  attachments?: readonly ChatAttachment[];
  /** Buttons after the message (copy, retry). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function ChatMessage({ role, author, time, status = "complete", attachments = [], actions, children, className }: ChatMessageProps) {
  const t = useAiText();
  const name = author ?? t(`ai.chat.role.${role}`);
  return (
    <article
      className={cx("ui-chat-message", `ui-chat-message--${role}`, status !== "complete" && `ui-chat-message--${status}`, className)}
      aria-label={t("ai.chat.label", { author: name })}
      aria-busy={status === "streaming" || undefined}
    >
      <header className="ui-chat-message__head">
        <span className="ui-chat-message__author">{name}</span>
        {time ? (
          <time className="ui-chat-message__time" dateTime={time.iso}>
            {time.text}
          </time>
        ) : null}
      </header>
      <div className="ui-chat-message__body">{typeof children === "string" ? <p className="ui-chat-message__text">{children}</p> : children}</div>
      {status === "streaming" ? <p className="ui-chat-message__status">{t("ai.chat.streaming")}</p> : null}
      {status === "error" ? (
        <p className="ui-chat-message__status ui-chat-message__status--error" role="alert">
          {t("ai.chat.error")}
        </p>
      ) : null}
      {attachments.length ? (
        <ul className="ui-chat-message__attachments" aria-label={t("ai.chat.attachments")}>
          {attachments.map((file, index) => {
            const href = safeHref(file.href, true);
            return (
              <li key={`${index}-${file.name}`} className="ui-chat-message__attachment">
                {href ? <a href={href}>{file.name}</a> : <span>{file.name}</span>}
                {file.size ? <span className="ui-chat-message__size">{file.size}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {actions ? <div className="ui-chat-message__actions">{actions}</div> : null}
    </article>
  );
}
