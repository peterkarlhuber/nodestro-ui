// Offline full-text search over help entries (N-17): a small in-memory index, built from the registered entries, with
// no network and no dependency. Words are compared without case and accents ("Ubersetzung" finds "Übersetzung"),
// every query word must match the start of a word of the entry ("appro" finds "approval"), and a match in the title
// counts more than one in the keywords, which counts more than one in the summary. A query that is a stable error
// code ("approval.expired") finds the entry the error map gives for it first.
import { isValidElement, type ReactNode } from "react";
import { helpIdForError, type HelpEntry } from "./help.js";

export interface HelpSearchHit {
  id: string;
  entry: HelpEntry;
  score: number;
}

export interface HelpIndex {
  /** The entries that contain every word of the query, best first; none for an empty query. */
  search(query: string, options?: { limit?: number }): HelpSearchHit[];
}

const WEIGHT = { title: 3, keywords: 2, summary: 1 } as const;

/** Lower case, accents removed, ß and similar ligatures spelled out (the same for the entries and the query). */
export function foldSearchText(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/œ/g, "oe");
}

/** The words of a text, folded. Letters and digits form words; anything else separates them. */
export function searchWords(text: string): string[] {
  return foldSearchText(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** The plain text of a React node: strings and numbers, also inside elements and arrays. */
export function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

interface IndexedEntry {
  id: string;
  entry: HelpEntry;
  fields: Array<{ weight: number; words: string[] }>;
}

const CODE = /^[A-Za-z_][\w-]*(?:\.[\w<>-]+)+$/;

/** Builds the index once; search it as often as needed. `errors` is the error map of the registry (optional). */
export function createHelpIndex(entries: Readonly<Record<string, HelpEntry>>, errors?: Readonly<Record<string, string>>): HelpIndex {
  const indexed: IndexedEntry[] = Object.entries(entries).map(([id, entry]) => ({
    id,
    entry,
    fields: [
      { weight: WEIGHT.title, words: searchWords(entry.title) },
      { weight: WEIGHT.keywords, words: searchWords(`${entry.keywords ?? ""} ${id}`) },
      { weight: WEIGHT.summary, words: searchWords(nodeText(entry.summary)) },
    ],
  }));
  return {
    search(query, { limit = 10 } = {}) {
      const terms = [...new Set(searchWords(query))];
      if (!terms.length) return [];
      const hits: HelpSearchHit[] = [];
      const code = query.trim();
      const byCode = errors && CODE.test(code) ? helpIdForError({ entries, errors }, code) : null;
      if (byCode) hits.push({ id: byCode, entry: entries[byCode], score: Number.MAX_SAFE_INTEGER });
      for (const item of indexed) {
        let score = 0;
        for (const term of terms) {
          let best = 0;
          for (const field of item.fields) {
            for (const word of field.words) {
              // A whole word counts double a word that only starts with the term.
              const value = word === term ? field.weight * 2 : word.startsWith(term) ? field.weight : 0;
              if (value > best) best = value;
            }
          }
          if (!best) {
            score = 0;
            break;
          }
          score += best;
        }
        if (score && item.id !== byCode) hits.push({ id: item.id, entry: item.entry, score });
      }
      hits.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title) || (a.id < b.id ? -1 : 1));
      return hits.slice(0, Math.max(0, limit));
    },
  };
}
