/**
 * Price band shapes and statistics, with no server imports.
 *
 * Split out of `lib/tools/price-data.ts` because the calculators are client
 * components: they need the `ToolPriceData` type the server hands them and the
 * `countryFactor` maths, but the Mongo reader that produces the data is
 * `server-only` and importing it from the browser bundle is a build error.
 *
 * The split is along the right line anyway. This file is arithmetic over
 * numbers and can be tested directly; that one is a database query.
 */
import type { PriceBand } from "@/lib/tools/cost";

/** Clinics needed before a slice gets its own band rather than the global one. */
export const MIN_SAMPLE = 3;

/** A price band with the label and slug the calculator needs to show it. */
export interface PriceSlice {
  slug: string;
  name: string;
  band: PriceBand;
  /** False when `band` is the global fallback rather than this slice's own. */
  ownData: boolean;
}

export interface ToolPriceData {
  /** All published, priced clinics as one band. The fallback and the baseline. */
  overall: PriceBand;
  /** One entry per treatment that at least one priced clinic offers. */
  treatments: PriceSlice[];
  /** One entry per country with at least one priced clinic. */
  countries: PriceSlice[];
  currency: string;
  /** Clinics contributing any price at all. */
  clinicCount: number;
}

/** One clinic's contribution: the ends of its published range and the midpoint. */
export interface PricePoint {
  low: number;
  high: number;
  mid: number;
}

/** Linear-interpolated percentile over a sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/**
 * Build a band from clinic price points.
 *
 * Low is the 25th percentile of the clinics' lower bounds and high the 75th of
 * their upper bounds, so the band describes where most of the market sits rather
 * than being dragged to the extremes by one outlier at either end. Typical is
 * the median midpoint.
 */
export function bandFromPoints(points: PricePoint[]): PriceBand {
  if (!points.length) {
    return { low: 0, typical: 0, high: 0, sampleSize: 0 };
  }
  const lows = points.map((p) => p.low).sort((a, b) => a - b);
  const highs = points.map((p) => p.high).sort((a, b) => a - b);
  const mids = points.map((p) => p.mid).sort((a, b) => a - b);

  const low = Math.round(percentile(lows, 0.25));
  const typical = Math.round(percentile(mids, 0.5));
  const high = Math.round(percentile(highs, 0.75));

  return {
    // Percentiles are computed on three different arrays, so on a small or
    // lopsided sample they can cross. Sorting the three results keeps the band
    // monotonic, which every consumer assumes.
    low: Math.min(low, typical, high),
    typical: Math.min(
      Math.max(typical, Math.min(low, high)),
      Math.max(low, high),
    ),
    high: Math.max(low, typical, high),
    sampleSize: points.length,
  };
}

/** The destination multiplier: a country's median against the global median. */
export function countryFactor(
  country: PriceBand | undefined,
  overall: PriceBand,
): number {
  if (!country || !country.typical || !overall.typical) return 1;
  return country.typical / overall.typical;
}

/**
 * What the tools should show when the database is unreachable at build time.
 *
 * Zeroed rather than invented: a band of zeros makes the calculator render its
 * "no published pricing yet" state, which is true, where a plausible-looking
 * hardcoded range would be a made-up number wearing the same styling as a
 * sourced one.
 */
export function emptyPriceData(currency: string): ToolPriceData {
  return {
    overall: { low: 0, typical: 0, high: 0, sampleSize: 0 },
    treatments: [],
    countries: [],
    currency,
    clinicCount: 0,
  };
}
