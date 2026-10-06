/**
 * The interface is shown in German or English, chosen once from the browser's language settings.
 *
 * There is deliberately no i18n library, no dictionary files and no language switch: with two languages
 * and a small interface, text sits next to the code that shows it, as `tr("English", "Deutsch")`.
 * See "Why no i18n library" in the README.
 */
export type Lang = "en" | "de";

/** German if any of the browser's preferred languages is German (de, de-AT, de-CH...), else English. */
export function detectLang(languages: readonly string[]): Lang {
  return languages.some((l) => l.toLowerCase().startsWith("de")) ? "de" : "en";
}

export const lang: Lang = detectLang(
  typeof navigator === "undefined"
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language],
);

/** Picks the text for the detected language. Use a template literal for text with values. */
export const tr = (en: string, de: string): string => (lang === "de" ? de : en);
