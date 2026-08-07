/**
 * Page-content read layer — resolves a code-owned route's copy for rendering.
 *
 * `getPageContent("/about")` is the one call a public page makes. It returns a
 * fully-populated {@link ResolvedPageContent}: whatever an editor saved in
 * `PageContent`, layered field by field over the shipped copy in
 * `config/editable-pages.ts`. Blank stored strings and empty stored block lists
 * fall through to the default, which is what makes clearing a field in the admin
 * restore the shipped copy rather than blanking the page.
 *
 * Two consequences worth stating, because pages depend on both:
 *  - A route with no row in the collection renders exactly as it did before this
 *    layer existed. There is no migration and no seeding step.
 *  - The call never throws on a missing database. `getPageContent` catches and
 *    returns the defaults, so a legal page still renders its shipped text if
 *    Mongo is unreachable. A directory page that cannot reach Mongo has bigger
 *    problems; a privacy policy that silently 500s is a different kind of
 *    problem, and this is the cheap insurance against it.
 *
 * Cached per path via `unstable_cache` under the shared `page-content` tag, so
 * an admin save can revalidate every route at once.
 */
import "server-only";
import { unstable_cache } from "next/cache";

import { dbConnect } from "@/lib/db";
import { parseBlocks } from "@/lib/blocks/content";
import { normalizePagePath } from "@/config/static-pages";
import { pageDefaults, type EditablePageDefaults } from "@/config/editable-pages";
import { PageContent } from "@/models";
import type { BlockInput } from "@/lib/validation/block";

/** The cache tag every editable route shares. */
export const PAGE_CONTENT_TAG = "page-content";

export interface ResolvedPageContent {
  path: string;
  title: string;
  lead: string;
  updated: string;
  legalReview: boolean;
  blocks: BlockInput[];
  blocksAfter: BlockInput[];
  /** Registry-declared one-off strings, always populated from the defaults. */
  extras: Record<string, string>;
  /** Look up one extra, falling back to the shipped string. */
  extra: (key: string) => string;
}

/** The stored shape, as read from Mongo. */
export interface StoredPageContent {
  title?: string;
  lead?: string;
  updated?: string;
  legalReview?: boolean | null;
  blocks?: unknown;
  blocksAfter?: unknown;
  extras?: Record<string, string>;
}

/** A stored string counts only when it has content. */
function str(stored: unknown, fallback: string): string {
  return typeof stored === "string" && stored.trim() ? stored : fallback;
}

/**
 * A stored composition counts only when non-empty.
 *
 * That means an editor cannot empty a body slot by deleting every block: the
 * shipped blocks come back. It is the same trade `resolveHomepage` makes for
 * grids, and it is the right one here because the alternative failure (a legal
 * page rendering an H1 and nothing else) is worse than the inconvenience.
 * Removing a section is done by editing the block, not by emptying the slot.
 */
function blockList(stored: unknown, fallback: BlockInput[]): BlockInput[] {
  const parsed = parseBlocks(stored);
  return parsed.length ? parsed : fallback;
}

/** Merge a stored row over the shipped defaults for `path`. */
export function resolvePageContent(
  path: string,
  stored?: StoredPageContent | null,
): ResolvedPageContent {
  const normalized = normalizePagePath(path);
  const d: EditablePageDefaults = pageDefaults(normalized);
  const s = stored ?? {};

  const extras: Record<string, string> = { ...d.extras };
  for (const [key, value] of Object.entries(s.extras ?? {})) {
    // Only keys the registry declares are honoured, so a renamed extra cannot
    // resurrect a stale string from an old shape.
    if (key in extras) extras[key] = str(value, extras[key]);
  }

  return {
    path: normalized,
    title: str(s.title, d.title),
    lead: str(s.lead, d.lead),
    updated: str(s.updated, d.updated),
    legalReview:
      typeof s.legalReview === "boolean" ? s.legalReview : d.legalReview,
    blocks: blockList(s.blocks, d.blocks),
    blocksAfter: blockList(s.blocksAfter, d.blocksAfter),
    extras,
    extra: (key: string) => extras[key] ?? "",
  };
}

/** Read the stored row for a path, or `null`. Uncached. */
async function readStored(path: string): Promise<StoredPageContent | null> {
  await dbConnect();
  const doc = await PageContent.findOne({ path }).lean<{
    title?: string;
    lead?: string;
    updated?: string;
    legalReview?: boolean | null;
    blocks?: unknown;
    blocksAfter?: unknown;
    extras?: Record<string, string> | Map<string, string>;
  }>();
  if (!doc) return null;
  return {
    title: doc.title,
    lead: doc.lead,
    updated: doc.updated,
    legalReview: doc.legalReview,
    blocks: doc.blocks,
    blocksAfter: doc.blocksAfter,
    // `.lean()` returns a plain object for a Map field, but be defensive: a
    // non-lean path or a driver change would hand back a real Map.
    extras:
      doc.extras instanceof Map
        ? Object.fromEntries(doc.extras)
        : ((doc.extras ?? {}) as Record<string, string>),
  };
}

/**
 * The resolved content for a code-owned route. Cached per path; falls back to
 * the shipped copy if the database is unreachable.
 */
export async function getPageContent(
  path: string,
): Promise<ResolvedPageContent> {
  const normalized = normalizePagePath(path);
  try {
    const stored = await unstable_cache(
      () => readStored(normalized),
      ["page-content", normalized],
      { tags: [PAGE_CONTENT_TAG], revalidate: 300 },
    )();
    return resolvePageContent(normalized, stored);
  } catch {
    return resolvePageContent(normalized, null);
  }
}
