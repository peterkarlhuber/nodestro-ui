// The catalog of this package: English is the reference, every language has exactly its keys (type-checked here,
// and tested with the placeholders in test/i18n.test.ts).
import type { Catalog } from "./i18n.js";
import de from "./locales/de.js";
import en from "./locales/en.js";
import es from "./locales/es.js";
import fr from "./locales/fr.js";
import it from "./locales/it.js";
import ptBR from "./locales/pt-BR.js";

export type CoreKey = keyof typeof en;
export type CoreMessages = Readonly<Record<CoreKey, string>>;

export const coreMessages: Catalog<CoreKey> = { en, de, fr, es, it, "pt-BR": ptBR };
