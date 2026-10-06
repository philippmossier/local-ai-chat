import { lang } from "./lang";

/** A number with a fixed number of decimals, written the way the reader expects (3.1 or 3,1). */
export const decimal = (n: number, digits = 1): string =>
  n.toLocaleString(lang === "de" ? "de-DE" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/**
 * Decimal units (1 GB = 1,000,000,000 bytes), as Hugging Face, macOS and browsers' download lists show them.
 * Binary units labelled "GB" made a 3.13 GB download read "3.0 GB" here and "3.1 GB" everywhere else.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
  const mb = bytes / 1e6;
  return mb < 1000 ? `${Math.round(mb)} MB` : `${decimal(mb / 1000)} GB`;
}

/** Catalog sizes are decimal megabytes, summed from the file sizes Hugging Face lists. */
export const formatMB = (mb: number) => formatBytes(mb * 1e6);
