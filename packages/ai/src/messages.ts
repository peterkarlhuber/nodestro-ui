// The catalog of this package: English is the reference, every language has exactly its keys (type-checked here,
// and tested with the placeholders in test/components/i18n.test.ts).
import { useCatalog, type Catalog, type TextFn } from "@nodestro/ui-core";
import de from "./locales/de.js";
import en from "./locales/en.js";
import es from "./locales/es.js";
import fr from "./locales/fr.js";
import it from "./locales/it.js";
import ptBR from "./locales/pt-BR.js";

export type AiKey = keyof typeof en;
export type AiMessages = Readonly<Record<AiKey, string>>;

export const aiMessages: Catalog<AiKey> = { en, de, fr, es, it, "pt-BR": ptBR };

/** The text function of this package. */
export function useAiText(): TextFn<AiKey> {
  return useCatalog(aiMessages);
}
