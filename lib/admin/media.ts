/**
 * Media library read-layer (PRD §8.11 / Stage 6.13).
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import {
  iso,
  id,
  paginate,
  type Paginated,
} from "@/lib/admin/serialize";
import { Media } from "@/models";

export interface AdminMediaRow {
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
}

export interface MediaQuery {
  q?: string;
  folder?: string;
  page?: number;
  pageSize?: number;
}

export async function getAdminMedia(
  query: MediaQuery = {},
): Promise<Paginated<AdminMediaRow>> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 24;

  const filter: Record<string, unknown> = {};
  if (query.folder) filter.folder = query.folder;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ filename: rx }, { alt: rx }];
  }

  const [docs, total, folders] = await Promise.all([
    Media.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Media.countDocuments(filter),
    Media.distinct("folder"),
  ]);

  const rows: AdminMediaRow[] = docs.map((d) => ({
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
  }));

  return {
    ...paginate(rows, total, page, pageSize),
    // `folders` rides along for the library filter UI.
    folders: (folders as (string | null)[]).filter(Boolean) as string[],
  } as Paginated<AdminMediaRow> & { folders: string[] };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
