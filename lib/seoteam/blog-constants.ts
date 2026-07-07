/**
 * Client-safe blog constants (no server-only / mongoose imports) so the editor,
 * the public read layer, and JSON-LD all agree on one value.
 */

/**
 * Byline used for any blog post with no explicit human author — the site's
 * editorial team. Blog posts are informational SEO content authored by the team,
 * so this is the sensible default rather than an empty byline.
 */
export const DEFAULT_BLOG_AUTHOR = "Stem Cell Guide Team";
