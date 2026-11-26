// Context help (N-17 infrastructure): the product registers its help entries and which entry explains which stable
// error code; components ask for help by id (HelpTip), by error code (ErrorHelp) or by words (HelpSearch, offline).
// This package ships no help content: the texts belong to the product (or to a content package such as
// @nodestro/ui-help), as a plain registry or as a six-language catalog (helpEntriesFromCatalog). helpCoverage() is the
// building block of a coverage test ("every error code has a help entry or a deliberate exception").
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { lookup, type Catalog, type Locale, type Translate } from "./i18n.js";

export interface HelpEntry {
  title: string;
  /** One or two sentences shown in place. */
  summary: ReactNode;
  /** The full article (http(s) or an in-app path starting with "/" or "#"). */
  href?: string;
  /** Extra words the offline search finds the entry by (synonyms, error codes), separated by spaces or commas. */
  keywords?: string;
}

export interface HelpRegistry {
  entries: Readonly<Record<string, HelpEntry>>;
  /**
   * Stable error code -> help entry id. A key is an exact code ("approval.expired") or a family ending in ".*"
   * ("approval.*": every code that starts with "approval."). The exact code wins, then the longest family.
   */
  errors?: Readonly<Record<string, string>>;
}

export interface HelpContextValue extends HelpRegistry {
  /** Opens the full article in the product (for example a side panel); without it a link is followed. */
  onOpen?: (id: string, entry: HelpEntry) => void;
}

const HelpContext = createContext<HelpContextValue>({ entries: {} });

export function HelpProvider({ children, ...value }: HelpContextValue & { children?: ReactNode }) {
  const { entries, errors, onOpen } = value;
  const memo = useMemo(() => ({ entries, errors, onOpen }), [entries, errors, onOpen]);
  return <HelpContext.Provider value={memo}>{children}</HelpContext.Provider>;
}

export function useHelpRegistry(): HelpContextValue {
  return useContext(HelpContext);
}

/** Whether a key of an error map ("a.b" exact, "a.*" family) applies to a code. */
export function errorKeyMatches(key: string, code: string): boolean {
  return key.endsWith(".*") ? code.startsWith(key.slice(0, -1)) && code.length > key.length - 1 : key === code;
}

/** The key of an error map that applies to a code: the exact code, else the longest matching family, else null. */
export function errorKeyFor(map: Readonly<Record<string, unknown>> | undefined, code: string): string | null {
  if (!map) return null;
  if (Object.prototype.hasOwnProperty.call(map, code) && !code.endsWith(".*")) return code;
  let best: string | null = null;
  for (const key of Object.keys(map)) {
    if (key.endsWith(".*") && errorKeyMatches(key, code) && (!best || key.length > best.length)) best = key;
  }
  return best;
}

/** The help entry id an error code maps to (exact code or family), whether or not that entry exists. */
function mappedId(registry: HelpRegistry, code: string): string | null {
  const key = errorKeyFor(registry.errors, code);
  return key ? (registry.errors as Record<string, string>)[key] : null;
}

/** The help entry id for an error code (exact code first, then the longest family), or null. */
export function helpIdForError(registry: HelpRegistry, code: string): string | null {
  const id = mappedId(registry, code);
  return id && registry.entries[id] ? id : null;
}

export interface HelpCatalogOptions {
  /** The full article per entry id. */
  hrefs?: Readonly<Record<string, string>>;
  /** The product's own answer for a key (as for UiTextProvider); undefined uses the catalog. */
  translate?: Translate;
}

/**
 * Help entries from a catalog in one language, English as the fallback. Every entry has the keys "<id>.title" and
 * "<id>.summary" and may have "<id>.keywords"; the entry ids are the English "<id>.title" keys.
 */
export function helpEntriesFromCatalog(catalog: Catalog, locale: Locale, options: HelpCatalogOptions = {}): Record<string, HelpEntry> {
  const entries: Record<string, HelpEntry> = {};
  const text = (key: string) => lookup(catalog, locale, key, undefined, options.translate);
  for (const key of Object.keys(catalog.en).sort()) {
    if (!key.endsWith(".title")) continue;
    const id = key.slice(0, -".title".length);
    const entry: HelpEntry = { title: text(key), summary: text(`${id}.summary`) };
    if (`${id}.keywords` in catalog.en) entry.keywords = text(`${id}.keywords`);
    const href = options.hrefs?.[id];
    if (href) entry.href = href;
    entries[id] = entry;
  }
  return entries;
}

// Backslashes and control characters (tab, newline, NUL, DEL ...): browsers treat a backslash like "/" and drop tabs
// and newlines, so "/<backslash>evil.example" or "/<tab>/evil.example" would leave the site like "//evil.example".
const UNSAFE_CHARS = /[\\\u0000-\u001f\u007f]/;

/**
 * An in-app path: starts with one "/" (never "//", which is another host), no backslash and no control character
 * anywhere. Anything else could leave the site (an open redirect).
 */
export function isInAppPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !UNSAFE_CHARS.test(value);
}

/** Only http(s) links, in-app paths and anchors are followed; anything else (javascript:, data:, //host) is dropped. */
export function safeHelpHref(href: string | undefined): string | undefined {
  if (!href || UNSAFE_CHARS.test(href)) return undefined;
  if (href.startsWith("/")) return isInAppPath(href) ? href : undefined;
  if (href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export interface HelpCoverage {
  /** Codes with neither a help entry nor an exception. */
  missing: string[];
  /** Codes mapped to an entry id that does not exist. */
  dangling: string[];
  /**
   * Exceptions (exact codes or families) that match no code in the list (stale), whose codes all have help anyway
   * (contradictory), or that give no reason.
   */
  staleExceptions: string[];
  /** Keys of the error map (exact codes or families) that match no code in the list. */
  unusedMappings: string[];
}

/**
 * Checks that every code has help or a deliberate exception (code or "family.*" -> reason). Use it in the product's
 * tests with the list of its stable error codes.
 */
export function helpCoverage(codes: readonly string[], registry: HelpRegistry, exceptions: Readonly<Record<string, string>> = {}): HelpCoverage {
  const known = [...new Set(codes)].sort();
  const missing: string[] = [];
  const dangling: string[] = [];
  for (const code of known) {
    const id = mappedId(registry, code);
    if (id && !registry.entries[id]) dangling.push(code);
    else if (!id && !errorKeyFor(exceptions, code)) missing.push(code);
  }
  const staleExceptions = Object.keys(exceptions)
    .filter((key) => {
      const matched = known.filter((code) => errorKeyFor(exceptions, code) === key);
      return !matched.length || matched.every((code) => mappedId(registry, code)) || !exceptions[key].trim();
    })
    .sort();
  const unusedMappings = Object.keys(registry.errors ?? {})
    .filter((key) => !known.some((code) => errorKeyFor(registry.errors, code) === key))
    .sort();
  return { missing, dangling, staleExceptions, unusedMappings };
}
