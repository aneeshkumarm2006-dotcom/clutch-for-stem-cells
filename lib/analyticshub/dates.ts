/**
 * Date helpers over `YYYY-MM-DD` strings, UTC-based so day bucketing matches
 * Mongo `$dateToString` (timezone UTC) and the provider APIs, which all take
 * calendar-day ranges.
 */
import type { DateRange } from "@/lib/analyticshub/types";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDay(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function isValidDay(s: string | null | undefined): s is string {
  return Boolean(s && DAY_RE.test(s) && !Number.isNaN(parseDay(s).getTime()));
}

/** Inclusive list of `YYYY-MM-DD` days from `from` to `to`. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = parseDay(to);
  for (
    const d = parseDay(from);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(isoDay(d));
  }
  return out;
}

export function rangeLength(from: string, to: string): number {
  return daysBetween(from, to).length;
}

/** The equal-length period immediately preceding `[from, to]`. */
export function previousRange(from: string, to: string): DateRange {
  const len = rangeLength(from, to);
  const prevTo = parseDay(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (len - 1));
  return { from: isoDay(prevFrom), to: isoDay(prevTo) };
}

/** Read `from`/`to` from a query, clamping to a sane default (last 7 days). */
export function parseRange(query: URLSearchParams, nowMs: number): DateRange {
  const from = query.get("from");
  const to = query.get("to");
  if (isValidDay(from) && isValidDay(to) && from <= to) {
    return { from, to };
  }
  const end = new Date(nowMs);
  const start = new Date(nowMs);
  start.setUTCDate(start.getUTCDate() - 6);
  return { from: isoDay(start), to: isoDay(end) };
}

/** Compact `YYYYMMDD` (GA4) → `YYYY-MM-DD`. */
export function fromCompactDay(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}
