/**
 * Display formatting helpers — Stage 4 shared UI.
 *
 * Dependency-free (no `mongoose`/`next`) so both server and client components
 * can import them. Currency/locale defaults come from `config/site`.
 */
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/config/site";
import { FX_RATES_AS_OF, FX_UNITS_PER_USD } from "@/config/fx";

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

// ── USD estimates for non-USD clinic prices ──────────────────────────────────

/**
 * Round a converted amount to a precision that reads as an estimate.
 *
 * "≈ $186" invites a visitor to treat a reference-rate conversion as the price;
 * "≈ $190" reads as the approximation it is. The step scales with magnitude so
 * a ₩250,000 consult and a ₩10,000,000 protocol are both rounded to roughly the
 * same *relative* coarseness (~1-2%), rather than one losing all its precision.
 */
function roundEstimate(usd: number): number {
  if (usd < 100) return Math.round(usd / 5) * 5;
  if (usd < 1_000) return Math.round(usd / 10) * 10;
  if (usd < 10_000) return Math.round(usd / 100) * 100;
  return Math.round(usd / 500) * 500;
}

/**
 * Approximate USD value of `amount` in `currency`, or `null` when no estimate
 * should be shown — the price is already USD, the currency has no rate in
 * `config/fx.ts`, or the amount is not a usable positive number.
 *
 * `null` is the honest answer for an unknown currency: see the note in
 * `config/fx.ts` on why a guessed rate is worse than no estimate.
 */
export function usdEstimate(
  amount: number | null | undefined,
  currency?: string | null,
): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const code = (currency ?? DEFAULT_CURRENCY).toUpperCase();
  if (code === "USD") return null;
  const perUsd = FX_UNITS_PER_USD[code];
  if (!perUsd || perUsd <= 0) return null;
  return roundEstimate(amount / perUsd);
}

/**
 * The estimate as display text, e.g. `"≈ $190"`, or `null` when there is none.
 * Uses "≈" rather than a word so it stays legible inside a compact price token.
 */
export function formatUsdEstimate(
  amount: number | null | undefined,
  currency?: string | null,
): string | null {
  const usd = usdEstimate(amount, currency);
  if (usd == null) return null;
  return `≈ ${formatPrice(usd, { currency: "USD" })}`;
}

/**
 * Sentence explaining an on-page USD estimate, for the footnote or `title`
 * beside it. Names the rate and its date so a stale table is visible to the
 * reader rather than silently wrong.
 */
export function usdEstimateNote(currency?: string | null): string | null {
  const code = (currency ?? DEFAULT_CURRENCY).toUpperCase();
  const perUsd = FX_UNITS_PER_USD[code];
  if (code === "USD" || !perUsd) return null;
  return `USD figures are estimates converted at ${formatCount(perUsd)} ${code} to 1 USD, the reference rate on ${FX_RATES_AS_OF}. The clinic bills in ${code}.`;
}
