// Small helpers shared by the components.
import { useCallback, useRef } from "react";
import { coreMessages, type CoreKey } from "./messages.js";
import { useCatalog, type TextFn } from "./i18n.js";

/** Joins class names, skipping empty ones. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

/** The text function of this package. */
export function useCoreText(): TextFn<CoreKey> {
  return useCatalog(coreMessages);
}

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** The elements inside `root` that take focus with Tab, in document order (hidden ones left out). */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest("[hidden]") && !el.closest("[inert]"));
}

/** A callback whose identity never changes but always calls the latest function. */
export function useEvent<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}
