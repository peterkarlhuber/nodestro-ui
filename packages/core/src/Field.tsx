// A labelled form field. The label, the hint and the error belong to the control: Field gives TextInput, TextArea and
// Select an id and aria-describedby through context, so a field is accessible without wiring ids by hand.
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx, useCoreText } from "./util.js";

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** A problem with the value; marks the control invalid and is announced with it. */
  error?: ReactNode;
  required?: boolean;
  /** The control's id when it is not one of the controls of this package (they take the id from the field). */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required = false, htmlFor, className, children }: FieldProps) {
  const t = useCoreText();
  const base = useId();
  const id = htmlFor ?? `${base}-control`;
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("ui-field", error ? "ui-field--invalid" : null, className)}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
        {required ? <span className="ui-field__required"> ({t("core.field.required")})</span> : null}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>{children}</FieldContext.Provider>
      {hint ? (
        <p className="ui-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ui-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The id, description and state a control inside a Field takes; its own props win. */
function useFieldProps(props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: unknown; required?: boolean }) {
  const field = useContext(FieldContext);
  const describedBy = [field?.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": (props["aria-invalid"] as boolean | undefined) ?? (field?.invalid || undefined),
    required: props.required ?? (field?.required || undefined),
  };
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput({ className, type = "text", ...rest }, ref) {
  return <input ref={ref} type={type} className={cx("ui-input", className)} {...rest} {...useFieldProps(rest)} />;
});

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx("ui-input", "ui-textarea", className)} {...rest} {...useFieldProps(rest)} />;
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "children"> {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

/** A native select: keyboard, screen reader and touch behaviour come from the platform. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ options, value, onChange, className, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx("ui-input", "ui-select", className)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
      {...useFieldProps(rest)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
