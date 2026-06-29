/**
 * Display formatting helpers — Stage 4 shared UI.
 *
 * Dependency-free (no `mongoose`/`next`) so both server and client components
 * can import them. Currency/locale defaults come from `config/site`.
 */
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/config/site";

/** Up-to-`max` uppercase initials for a logo fallback (Design §10.4 / §11). */
export function getInitials(name: string, max = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, max)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export interface FormatPriceOptions {
  currency?: string;
  locale?: string;
  /** Default 0 — clinic pricing shows whole units ("$8,500"). */
  maximumFractionDigits?: number;
}

/** Currency string for the price token, e.g. `formatPrice(8500)` → "$8,500". */
export function formatPrice(
  amount: number,
  {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    maximumFractionDigits = 0,
  }: FormatPriceOptions = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount);
}

/** Locale-grouped integer, e.g. `formatCount(4180)` → "4,180". */
export function formatCount(value: number, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** "City, Country" from optional parts, skipping blanks. */
export function formatLocation(parts: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  return [parts.city, parts.region, parts.country]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}
