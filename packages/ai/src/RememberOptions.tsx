// How long and for whom a decision on an approval card holds: this call only (the default), until revoked, or until
// a date; for the asking agent or for every agent. The component only shows the choice; the product decides what it
// stores (a permission when approving, a block when rejecting) and whether approving can be remembered at all.
import { Field, Select, TextInput, cx } from "@nodestro/ui-core";
import type { FieldsetHTMLAttributes, ReactNode } from "react";
import { useAiText } from "./messages.js";

export type RememberDuration = "call" | "until_revoked" | "until";
export type RememberScope = "agent" | "all";

export interface RememberChoice {
  duration: RememberDuration;
  scope: RememberScope;
  /** For "until": the end as a datetime-local value (yyyy-mm-ddThh:mm), empty until chosen. */
  until: string;
}

export const REMEMBER_DURATIONS: readonly RememberDuration[] = ["call", "until_revoked", "until"];
export const DEFAULT_REMEMBER: RememberChoice = { duration: "call", scope: "agent", until: "" };

/** Why approving cannot be remembered (rejecting always can): a tool that deletes for good, or one with its own rules. */
export type RejectOnlyReason = "destructive" | "mcp";

/** A chosen rule is complete: "until" needs a date. */
export function rememberComplete(choice: RememberChoice): boolean {
  return choice.duration !== "until" || Boolean(choice.until);
}

export interface RememberOptionsProps extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, "onChange"> {
  value: RememberChoice;
  onChange: (value: RememberChoice) => void;
  /** The name of the asking agent, shown in the "this agent" option. */
  agent: string;
  /** Shown when a rule is chosen: approving will not be remembered, rejecting will. */
  rejectOnly?: RejectOnlyReason | null;
  /** Extra notes after the hint (for example the product's own wording of rejectOnly). */
  children?: ReactNode;
}

export function RememberOptions({ value, onChange, agent, rejectOnly = null, disabled, className, children, ...rest }: RememberOptionsProps) {
  const t = useAiText();
  return (
    <fieldset className={cx("ui-remember", className)} disabled={disabled} {...rest}>
      <legend className="ui-remember__legend">{t("ai.remember.title")}</legend>
      <div className="ui-remember__fields">
        <Field label={t("ai.remember.duration")}>
          <Select
            value={value.duration}
            onChange={(duration) => onChange({ ...value, duration: duration as RememberDuration })}
            options={REMEMBER_DURATIONS.map((duration) => ({ value: duration, label: t(`ai.remember.durations.${duration}`) }))}
          />
        </Field>
        {value.duration !== "call" ? (
          <Field label={t("ai.remember.scope")}>
            <Select
              value={value.scope}
              onChange={(scope) => onChange({ ...value, scope: scope as RememberScope })}
              options={[
                { value: "agent", label: t("ai.remember.scopes.agent", { agent }) },
                { value: "all", label: t("ai.remember.scopes.all") },
              ]}
            />
          </Field>
        ) : null}
        {value.duration === "until" ? (
          <Field label={t("ai.remember.until")}>
            <TextInput type="datetime-local" value={value.until} onChange={(event) => onChange({ ...value, until: event.target.value })} />
          </Field>
        ) : null}
      </div>
      <p className="ui-remember__hint">{t("ai.remember.hint")}</p>
      {value.duration !== "call" && rejectOnly ? <p className="ui-remember__note">{t(`ai.remember.rejectOnly.${rejectOnly}`)}</p> : null}
      {children}
    </fieldset>
  );
}
