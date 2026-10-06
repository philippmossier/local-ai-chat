# 6. No i18n library: text next to the code

Date: 2026-10-05

## Status

Accepted

## Context

The app should speak German and English, chosen from the browser's language, for a European audience. The
first version had the usual setup: two typed dictionary files with about 100 keys, a context provider, a hook,
a language switch, a `localStorage` preference and tests that the two dictionaries had the same keys and
placeholders. For two languages and a small interface that was more machinery than text, and it put every
string away from the code that shows it.

## Decision

Remove it. The language is detected once at start-up from `navigator.languages` (`src/lib/lang.ts`). Text is
written where it is shown, as `tr("English", "Deutsch")`, with template literals for values. Text that depends
on a run-time value (model tier, fit, reason for the hardware result, kind of network host) is a lookup in
`src/lib/labels.ts` whose type is a closed union, so a missing case does not compile. Numbers use
`toLocaleString` through one helper (`decimal`). There is no language switch and nothing is stored.

## Consequences

- Less code and no indirection: a reader sees the English and German text where the UI is built, and `tr`
  needs both arguments, so a missing German string cannot happen.
- Gone: pluralisation, a translator workflow, a third language without editing every call site, and a manual
  override. Auto-detection means a German speaker on an English browser sees English.
- Checking that both languages are complete is now the compiler's job rather than a test's.
- The detection is tested (`lang.test.ts`) and both languages were checked in a real browser by overriding
  `navigator.languages`.
- Reconsider when a third language, plural-heavy text or a translator appears.
