// The catalog of this package: English is the reference, every language has exactly its keys (type-checked here,
// and tested with the placeholders in test/components/i18n.test.ts).
import type { Catalog } from "@nodestro/ui-core";
import de from "./locales/de.js";
import en from "./locales/en.js";
import es from "./locales/es.js";
import fr from "./locales/fr.js";
import it from "./locales/it.js";
import ptBR from "./locales/pt-BR.js";

export type HelpKey = keyof typeof en;
export type HelpMessages = Readonly<Record<HelpKey, string>>;

export const helpMessages: Catalog<HelpKey> = { en, de, fr, es, it, "pt-BR": ptBR };
