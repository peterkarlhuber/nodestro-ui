// Texts of the packages: each package ships a catalog (one flat message map per language) and looks its keys up
// through the nearest UiTextProvider. The product chooses the language and may answer any key itself (for example
// from its own i18n library); a key it does not answer comes from the package catalog, then from English.
// No i18n library is required: placeholders use the {{name}} syntax that i18next uses as well.

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

/** The six languages every package covers (the same as the products). */
export const LOCALES = ["en", "de", "fr", "es", "it", "pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];

export type MessageValues = Record<string, string | number>;
/** A flat message map: key -> text with optional {{placeholders}}. */
export type Messages = Readonly<Record<string, string>>;
/** One message map per language; English is the reference and the fallback. */
export type Catalog<K extends string = string> = { readonly [L in Locale]: Readonly<Record<K, string>> };

/** The product's own answer for a key, or undefined to use the package text. */
export type Translate = (key: string, values?: MessageValues) => string | undefined;
/** A lookup bound to one catalog and the current language. */
export type TextFn<K extends string = string> = (key: K, values?: MessageValues) => string;

interface UiTextValue {
  locale: Locale;
  translate?: Translate;
}

const UiTextContext = createContext<UiTextValue>({ locale: "en" });

/** The best supported language for a tag such as "de-AT", "pt" or "pt-PT"; English when none fits. */
export function resolveLocale(tag: string | null | undefined): Locale {
  if (!tag) return "en";
  const exact = LOCALES.find((locale) => locale.toLowerCase() === tag.toLowerCase());
  if (exact) return exact;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  if (base === "pt") return "pt-BR";
  return LOCALES.find((locale) => locale === base) ?? "en";
}

/** Replaces {{name}} with values.name; unknown placeholders stay as they are. */
export function interpolate(text: string, values?: MessageValues): string {
  if (!values) return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

export interface UiTextProviderProps {
  /** A language tag; resolved with resolveLocale. */
  locale: string;
  /** Answers keys from the product's own texts; return undefined for the package text. */
  translate?: Translate;
  children?: ReactNode;
}

export function UiTextProvider({ locale, translate, children }: UiTextProviderProps) {
  const resolved = resolveLocale(locale);
  const value = useMemo(() => ({ locale: resolved, translate }), [resolved, translate]);
  return <UiTextContext.Provider value={value}>{children}</UiTextContext.Provider>;
}

/** The current language. */
export function useLocale(): Locale {
  return useContext(UiTextContext).locale;
}

/** Looks a key up in the product's answer, then the catalog in the current language, then English, then the key. */
export function lookup<K extends string>(catalog: Catalog<K>, locale: Locale, key: K, values?: MessageValues, translate?: Translate): string {
  const own = translate?.(key, values);
  if (typeof own === "string") return own;
  const text = catalog[locale]?.[key] ?? catalog.en[key];
  return text === undefined ? key : interpolate(text, values);
}

/** A text function for one package catalog. */
export function useCatalog<K extends string>(catalog: Catalog<K>): TextFn<K> {
  const { locale, translate } = useContext(UiTextContext);
  return useCallback((key: K, values?: MessageValues) => lookup(catalog, locale, key, values, translate), [catalog, locale, translate]);
}
