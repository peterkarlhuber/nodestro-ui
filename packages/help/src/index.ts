// @nodestro/ui-help: brand-neutral help content for the stable error codes of the platform API, in the six languages
// of the products, for the context help of @nodestro/ui-core (HelpProvider, HelpTip, ErrorHelp, HelpSearch). No
// styles, no network: texts and the error map only. A product adds its own entries and may override any text.
import { helpEntriesFromCatalog, resolveLocale, type HelpCatalogOptions, type HelpEntry, type HelpRegistry } from "@nodestro/ui-core";
import { HELP_ERRORS } from "./errors.js";
import { helpMessages } from "./messages.js";

export { HELP_ERRORS } from "./errors.js";
export { helpMessages, type HelpKey, type HelpMessages } from "./messages.js";

/** The error code families each entry explains, as search keywords ("access auth pairing"). */
function familyWords(id: string): string {
  return Object.entries(HELP_ERRORS)
    .filter(([, target]) => target === id)
    .map(([key]) => key.replace(/\.\*$/, ""))
    .join(" ");
}

/**
 * The platform help in one language (any tag; English for missing texts), ready for HelpProvider. The error code
 * families of an entry are added to its keywords, so a search for "pairing" finds the entry in every language.
 */
export function platformHelp(locale: string, options: HelpCatalogOptions = {}): Required<HelpRegistry> {
  const entries: Record<string, HelpEntry> = {};
  for (const [id, entry] of Object.entries(helpEntriesFromCatalog(helpMessages, resolveLocale(locale), options))) {
    entries[id] = { ...entry, keywords: [entry.keywords, familyWords(id)].filter(Boolean).join(" ") };
  }
  return { entries, errors: HELP_ERRORS };
}
