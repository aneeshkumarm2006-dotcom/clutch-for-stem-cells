/**
 * Indexation rules — the single source of truth for "should this URL be
 * indexed?", shared by page `generateMetadata` and the sitemap so they can
 * never disagree (a page that self-`noindex`es must not appear in the sitemap).
 *
 * Two concerns:
 *  - {@link shouldNoindexDirectory} — filtered/sorted/paginated *directory*
 *    URLs (`/clinics`, `/treatments/[slug]`, …). The clean base path is the one
 *    canonical, indexable URL; every faceted/sorted/paged variant canonicalizes
 *    back to it (see `lib/seo.ts` `buildMetadata`) and is `noindex, follow`.
 *  - {@link isMatrixIndexable} — an authored page is indexable once its content
 *    record is approved.
 *
 * What is deliberately NOT a gate anywhere here: how much content a page has.
 * Taxonomy terms with zero clinics, clinic landings matching nothing, and
 * clinics with no reviews are all indexable and all in the sitemap. The URL
 * itself is the query we want to own, and emptiness is treated as a temporary
 * state rather than a reason to hide. The accepted trade-off is that Google may
 * file some of these as Soft 404 / "Crawled - currently not indexed" until they
 * fill in; the editor's per-record `seo.noindex` toggle is the way to withhold
 * a specific page.
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
}

/**
 * `true` when an authored page (combination page, composed CMS page) may be
 * `index, follow`.
 *
 * Editorial approval is the only test. Content depth deliberately is not one:
 * a published page is indexable however thin it is, matching the directory
 * routes, which no longer gate on clinic inventory either. A non-approved
 * record is never generated as a URL at all, so this stays a defensive second
 * gate rather than the primary one.
 */
export function isMatrixIndexable(record: IndexableContentRecord): boolean {
  return record.reviewStatus === "approved";
}
