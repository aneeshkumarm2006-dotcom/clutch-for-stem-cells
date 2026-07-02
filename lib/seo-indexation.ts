/**
 * Indexation rules — the single source of truth for "should this URL be
 * indexed?", shared by page `generateMetadata` and the sitemap so they can
 * never disagree (a page that self-`noindex`es must not appear in the sitemap).
 *
 * Two concerns:
 *  - {@link shouldNoindexDirectory} — thin/filtered/paginated *directory* URLs
 *    (`/clinics`, `/treatments/[slug]`, …). The clean base path is the one
 *    canonical, indexable URL; every faceted/sorted/paged variant canonicalizes
 *    back to it (see `lib/seo.ts` `buildMetadata`) and is `noindex, follow`.
 *  - {@link isMatrixIndexable} — a programmatic *combination* page is indexable
 *    only when its content record is approved AND content-complete. Combination
 *    URLs are authored-into-existence (generated only from approved records), so
 *    this is a defensive second gate, not the primary one.
 *
 * Pure & dependency-free (mongoose-free) so it runs in server components, the
 * sitemap route, and unit tests alike.
 */

/** Query keys that represent a user-applied filter/sort/pagination state. */
const FILTER_QUERY_KEYS = new Set([
  "q",
  "query",
  "treatment",
  "treatments",
  "condition",
  "conditions",
  "cellSource",
  "cellSources",
  "country",
  "city",
  "language",
  "languages",
  "priceMin",
  "priceMax",
  "verified",
  "minRating",
  "sort",
  "page",
  "pageSize",
  "view",
]);

/** Directory filter dimension → the query keys that express it. */
const DIMENSION_QUERY_KEYS: Record<string, string[]> = {
  treatment: ["treatment", "treatments"],
  condition: ["condition", "conditions"],
  cellSource: ["cellSource", "cellSources"],
  country: ["country"],
  city: ["city"],
  language: ["language", "languages"],
};

function lockedQueryKeys(locked?: string[]): Set<string> {
  const keys = new Set<string>();
  for (const dim of locked ?? []) {
    for (const key of DIMENSION_QUERY_KEYS[dim] ?? []) keys.add(key);
  }
  return keys;
}

/**
 * `true` when a directory URL is a thin/filtered variant that should be
 * `noindex, follow` (canonical already points to the clean base).
 *
 * A URL is "clean" (indexable) when it carries no filter/sort params beyond the
 * route-locked dimension(s) — i.e. no user facets, `page<=1`, and `view=all`.
 * `locked` dimensions (pinned in the path, e.g. the treatment on
 * `/treatments/[slug]`) are ignored if they also appear in the query.
 */
export function shouldNoindexDirectory(
  searchParams: Record<string, string | string[] | undefined>,
  opts: { locked?: string[] } = {},
): boolean {
  const ignore = lockedQueryKeys(opts.locked);
  for (const [key, raw] of Object.entries(searchParams)) {
    if (raw == null) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value == null || value === "") continue;
    if (ignore.has(key)) continue;
    if (key === "page") {
      if (Number(value) > 1) return true;
      continue;
    }
    if (key === "view") {
      if (value !== "all") return true; // e.g. ?view=top → alternate view
      continue;
    }
    if (FILTER_QUERY_KEYS.has(key)) return true;
  }
  return false;
}

/**
 * The structural shape {@link isMatrixIndexable} needs — kept as a local
 * interface (not a model import) so this module stays mongoose-free.
 */
export interface IndexableContentRecord {
  reviewStatus: string;
  intro?: string | null;
  body?: string | null;
  faqs?: readonly unknown[] | null;
  keyFacts?: readonly unknown[] | null;
  reviewedBy?: unknown;
}

/** Minimum content depth a combination page needs to be worth indexing. */
export function isContentComplete(record: IndexableContentRecord): boolean {
  const hasFaqs = (record.faqs?.length ?? 0) >= 3;
  const hasFacts = (record.keyFacts?.length ?? 0) >= 3;
  return Boolean(
    record.intro?.trim() &&
    record.body?.trim() &&
    (hasFaqs || hasFacts) &&
    record.reviewedBy,
  );
}

/**
 * `true` when a combination page may be `index, follow`. Requires an approved
 * record (which the CMS approval gate only grants once `reviewedBy` is set and
 * every content flag is acknowledged) AND content completeness. An approved but
 * thin record renders `noindex, follow`; a non-approved record is never
 * generated as a URL at all.
 */
export function isMatrixIndexable(record: IndexableContentRecord): boolean {
  return record.reviewStatus === "approved" && isContentComplete(record);
}
