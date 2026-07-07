/**
 * SEO-team blog media data layer.
 *
 * Reads/writes the shared `Media` library (same collection as `/admin/media`)
 * for the `/seoteam` gallery. `getSeoMedia` annotates each row with usage
 * (which posts embed it) so the gallery can show "used in N posts" and surface
 * orphans. Write helpers persist uploads (dedupe-aware), import pasted URLs, and
 * backfill images that predate library tracking.
 *
 * Unlike `lib/admin/media.ts`, the usage annotation + orphan filter + usage sort
 * need the full result set, so this layer loads the matching set, annotates it,
 * then sorts/paginates in memory (cheap at blog scale).
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { id, iso, paginate, type Paginated } from "@/lib/admin/serialize";
import type { UploadedMedia } from "@/lib/media";
import { Media } from "@/models";
import {
  collectUsedImageUrls,
  extractCloudinaryPublicId,
  getMediaUsageIndex,
  lookupUsage,
  type UsageRef,
} from "@/lib/seoteam/media-usage";

export type MediaSort = "newest" | "name" | "size" | "usage";

export interface SeoMediaRow {
  id: string;
  url: string;
  publicId?: string;
  alt?: string;
  filename?: string;
  folder?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  createdAt?: string;
  usageCount: number;
  usedIn: UsageRef[];
}

export interface SeoMediaStats {
  total: number;
  used: number;
  unused: number;
  totalBytes: number;
}

export interface SeoMediaResult extends Paginated<SeoMediaRow> {
  folders: string[];
  stats: SeoMediaStats;
}

export interface SeoMediaQuery {
  q?: string;
  /** A folder name, or the `__all__` sentinel for every folder. Default: blog. */
  folder?: string;
  sort?: MediaSort;
  filter?: "unused";
  page?: number;
  pageSize?: number;
}

/** Sentinel: show media across every folder rather than the blog default. */
export const ALL_FOLDERS = "__all__";

export async function getSeoMedia(
  query: SeoMediaQuery = {},
): Promise<SeoMediaResult> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 24;
  const sort = query.sort ?? "newest";

  const filter: Record<string, unknown> = {};
  if (!query.folder) filter.folder = "blog";
  else if (query.folder !== ALL_FOLDERS) filter.folder = query.folder;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ filename: rx }, { alt: rx }, { url: rx }];
  }

  const [docs, folders, index] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).lean(),
    Media.distinct("folder"),
    getMediaUsageIndex(),
  ]);

  let rows: SeoMediaRow[] = docs.map((d) => {
    const usedIn = lookupUsage(index, { url: d.url, publicId: d.publicId });
    return {
      id: id(d._id),
      url: d.url,
      publicId: d.publicId,
      alt: d.alt,
      filename: d.filename,
      folder: d.folder,
      format: d.format,
      width: d.width,
      height: d.height,
      bytes: d.bytes,
      createdAt: iso(d.createdAt),
      usageCount: usedIn.length,
      usedIn,
    };
  });

  // Stats describe the whole (q + folder) scope, before the orphan narrowing.
  const stats: SeoMediaStats = {
    total: rows.length,
    used: rows.filter((r) => r.usageCount > 0).length,
    unused: rows.filter((r) => r.usageCount === 0).length,
    totalBytes: rows.reduce((s, r) => s + (r.bytes ?? 0), 0),
  };

  if (query.filter === "unused") rows = rows.filter((r) => r.usageCount === 0);

  rows.sort((a, b) => {
    switch (sort) {
      case "name":
        return (a.filename ?? a.alt ?? "").localeCompare(
          b.filename ?? b.alt ?? "",
        );
      case "size":
        return (b.bytes ?? 0) - (a.bytes ?? 0);
      case "usage":
        return b.usageCount - a.usageCount;
      case "newest":
      default:
        return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    }
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    ...paginate(pageRows, total, page, pageSize),
    folders: ((folders as (string | null)[]).filter(Boolean) as string[]).sort(),
    stats,
  };
}

// ── Write helpers ────────────────────────────────────────────────────────────

/**
 * Persist a completed provider upload as a library record. Deduped by
 * `publicId` so re-uploading the same asset doesn't create duplicate rows.
 */
export async function persistUploadedMedia(
  uploaded: UploadedMedia,
  opts: { filename?: string; folder?: string; alt?: string } = {},
): Promise<void> {
  await dbConnect();
  if (uploaded.publicId) {
    const existing = await Media.findOne({ publicId: uploaded.publicId })
      .select("_id")
      .lean();
    if (existing) return;
  }
  await Media.create({
    url: uploaded.url,
    publicId: uploaded.publicId,
    alt: opts.alt ?? "",
    filename: opts.filename,
    folder: opts.folder ?? "blog",
    format: uploaded.format,
    width: uploaded.width,
    height: uploaded.height,
    bytes: uploaded.bytes,
  });
}

/** Bulk-import pasted image URLs into the blog folder (deduped by url). */
export async function importMediaUrls(
  urls: string[],
): Promise<{ imported: number; skipped: number }> {
  await dbConnect();
  let imported = 0;
  let skipped = 0;
  for (const raw of urls) {
    const url = raw.trim();
    if (!url) {
      skipped++;
      continue;
    }
    const existing = await Media.findOne({ url }).select("_id").lean();
    if (existing) {
      skipped++;
      continue;
    }
    await Media.create({
      url,
      publicId: extractCloudinaryPublicId(url),
      folder: "blog",
      alt: "",
    });
    imported++;
  }
  return { imported, skipped };
}

/**
 * Backfill: create library records for every image already used across posts
 * (cover + inline) that isn't tracked yet. Lets usage work for images uploaded
 * before the gallery shipped.
 */
export async function backfillBlogMedia(): Promise<{ imported: number }> {
  await dbConnect();
  const used = await collectUsedImageUrls();
  let imported = 0;
  for (const url of used) {
    const existing = await Media.findOne({ url }).select("_id").lean();
    if (existing) continue;
    await Media.create({
      url,
      publicId: extractCloudinaryPublicId(url),
      folder: "blog",
      alt: "",
    });
    imported++;
  }
  return { imported };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
