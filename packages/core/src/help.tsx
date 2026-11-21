// Context help (N-17 infrastructure): the product registers its help entries and which entry explains which stable
// error code; components ask for help by id (HelpTip) or by error code (ErrorHelp). The package ships no help
// content: the texts belong to the product. helpCoverage() is the building block of a coverage test ("every error
// code has a help entry or a deliberate exception").
import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface HelpEntry {
  title: string;
  /** One or two sentences shown in place. */
  summary: ReactNode;
  /** The full article (http(s) or an in-app path starting with "/" or "#"). */
  href?: string;
}

export interface HelpRegistry {
  entries: Readonly<Record<string, HelpEntry>>;
  /** Stable error code -> help entry id. */
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

/** The help entry id for an error code, or null. */
export function helpIdForError(registry: HelpRegistry, code: string): string | null {
  const id = registry.errors?.[code];
  return id && registry.entries[id] ? id : null;
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
  /** Exceptions for codes that are not in the list (stale) or that have help anyway (contradictory). */
  staleExceptions: string[];
}

/**
 * Checks that every code has help or a deliberate exception (code -> reason). Use it in the product's tests with the
 * list of its stable error codes.
 */
export function helpCoverage(codes: readonly string[], registry: HelpRegistry, exceptions: Readonly<Record<string, string>> = {}): HelpCoverage {
  const known = new Set(codes);
  const missing: string[] = [];
  const dangling: string[] = [];
  for (const code of [...known].sort()) {
    const id = registry.errors?.[code];
    if (id && !registry.entries[id]) dangling.push(code);
    else if (!id && !(code in exceptions)) missing.push(code);
  }
  const staleExceptions = Object.keys(exceptions)
    .filter((code) => !known.has(code) || Boolean(registry.errors?.[code]) || !exceptions[code].trim())
    .sort();
  return { missing, dangling, staleExceptions };
}
