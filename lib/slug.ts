/**
 * Slugify — URL-safe slug from a title/name (shared by admin forms + server).
 * Lowercase, strip accents, non-alphanumerics → single hyphens, trimmed.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
