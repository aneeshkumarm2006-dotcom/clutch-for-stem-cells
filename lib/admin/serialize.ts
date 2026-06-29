/**
 * Admin read-layer shared helpers (Stage 6).
 *
 * Admin pages (like the public ones — see `lib/public-data.ts`) never touch
 * Mongoose directly; the `lib/admin/*` read modules return plain, serializable
 * view models. Unlike the public layer, admin reads see **all** statuses and
 * soft-deleted rows. These helpers cover id/image/date serialization and shared
 * pagination parsing.
 */
import "server-only";
import type { IImage } from "@/models";

export const id = (v: unknown): string => String(v);

/** ISO string (or undefined) — Dates can't cross the server/client boundary. */
export const iso = (d: Date | null | undefined): string | undefined =>
  d ? new Date(d).toISOString() : undefined;

export interface ImageView {
  url: string;
  alt?: string;
  publicId?: string;
  width?: number;
  height?: number;
}

export function serializeImage(
  img: IImage | null | undefined,
): ImageView | undefined {
  if (!img?.url) return undefined;
  return {
    url: img.url,
    alt: img.alt,
    publicId: img.publicId,
    width: img.width,
    height: img.height,
  };
}

/** Up-to-2-letter initials for the logo placeholder square (Design §11). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export const DEFAULT_PAGE_SIZE = 20;

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Coerce a 1-based page query value into a safe integer ≥ 1. */
export function parsePage(value: string | undefined): number {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Read the first value of a possibly-array search param. */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length > 0 ? v : undefined;
}

/**
 * Build a `?…&page=N` href that preserves the current filter params — for the
 * crawlable `Pagination` `hrefFor` callback in server list pages.
 */
export function pageHref(
  pathname: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Wrap a page slice + count into the standard {@link Paginated} envelope. */
export function paginate<T>(
  rows: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
