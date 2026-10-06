import { lang } from "../lang";

const DAY = 24 * 60 * 60_000;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * "Today 8:13 PM", "Yesterday 6:45 PM", "Friday 12:33 PM" (within the last week), "Sat, Sep 19 at 1:21 AM" (older),
 * in the browser's language and clock style, from the platform's own date formatting (no strings to maintain).
 */
export function messageTime(at: number, now: number, locale: string = lang): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  const when = new Date(at);
  const time = when.toLocaleTimeString(locale, {
    hour: locale === "de" ? "2-digit" : "numeric",
    minute: "2-digit",
  });
  if (days < 2) {
    const word = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -Math.max(0, days),
      "day",
    );
    return `${word.charAt(0).toLocaleUpperCase(locale)}${word.slice(1)} ${time}`;
  }
  if (days < 7) return `${when.toLocaleDateString(locale, { weekday: "long" })} ${time}`;
  const sameYear = when.getFullYear() === new Date(now).getFullYear();
  const date = when.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${date} ${locale === "de" ? "um" : "at"} ${time}`;
}
