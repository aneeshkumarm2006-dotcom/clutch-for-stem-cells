/**
 * Composed-page slug rules — pure, so anything can import them.
 *
 * Split out of `lib/seoteam/page-data.ts` because that module reaches into the
 * React block renderer to project a stored page, which makes it unimportable
 * from a plain Node script. The rules themselves are string work with no
 * dependencies, and the read layer re-exports them, so callers keep importing
 * `isReservedSlug` from wherever they already did.
 */

/**
 * Slugs a composed Page may never claim, because a real route already owns that
 * first path segment. Next.js would give the static route precedence anyway, so
 * a colliding page would simply be unreachable — this turns that silent dead end
 * into a save-time error the editor can act on.
 */
export const RESERVED_SLUGS = new Set([
  "about",
  "account",
  "admin",
  "analyticshub",
  "api",
  "auth",
  "blog",
  "clinic",
  "clinics",
  "conditions",
  "contact",
  "editorial-policy",
  "faq",
  "find-a-clinic",
  "for-clinics",
  "locations",
  "medical-disclaimer",
  "methodology",
  "privacy",
  "r",
  "reviews",
  "reviewers",
  "robots.txt",
  "search",
  "seoteam",
  "shortlist",
  "sitemap.xml",
  "terms",
  "treatments",
]);

/**
 * Route prefixes a composed page *may* nest under, because that route explicitly
 * falls back to a composed page when its own record lookup misses.
 *
 * `/treatments/[slug]` does this: an editorial page like
 * `treatments/prp-vs-stem-cell-therapy` is a comparison guide, not a treatment
 * the directory can filter clinics by, so it must not become a taxonomy term —
 * but it still belongs at that URL. Adding a prefix here without teaching the
 * matching route to look for the page would create a saveable, unreachable URL.
 */
export const NESTABLE_SLUG_PREFIXES = new Set(["treatments"]);

/** `["treatments", "prp-vs-x"]` → the two parts, or a single-element array. */
function slugSegments(slug: string): string[] {
  return slug.toLowerCase().split("/").filter(Boolean);
}

export function isReservedSlug(slug: string): boolean {
  const segments = slugSegments(slug);
  const [first] = segments;
  if (!first) return true;

  // A nested slug is legal only under a route that opts in; the deeper segment
  // lives inside that route's namespace, so it can't collide with anything.
  if (segments.length > 1) {
    return segments.length > 2 || !NESTABLE_SLUG_PREFIXES.has(first);
  }
  return RESERVED_SLUGS.has(first);
}
