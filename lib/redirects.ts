/**
 * Redirect resolution.
 *
 * Deliberately NOT in Edge middleware: middleware runs on the Edge runtime,
 * which can't open a Mongoose connection, and doing a per-request DB read (or a
 * fetch to an internal API) on *every* request to serve a handful of redirects
 * would tax the whole site to benefit a rounding error of traffic.
 *
 * Instead the redirect table is read once and cached (`unstable_cache`, 5 min),
 * then consulted only where a redirect can actually matter: the `/[slug]`
 * catch-all and the not-found boundary — i.e. exactly when a URL fails to
 * resolve, which is the case redirects exist for (content moved, slug changed).
 *
 * A URL that still resolves to a live page is intentionally NOT redirected; the
 * live page wins. That is the correct precedence and avoids an editor
 * accidentally shadowing a working route.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { dbConnect } from "@/lib/db";
import { normalizePath } from "@/lib/validation/redirect";
import { Redirect } from "@/models";

export const REDIRECTS_CACHE_TAG = "redirects";

export interface ResolvedRedirect {
  to: string;
  statusCode: 301 | 302;
}

/**
 * The whole redirect table as a `from → {to, statusCode}` map. Small by nature
 * (tens to low hundreds of rows), so loading it once beats a query per miss.
 *
 * Tagged so a redirect write can `revalidateTag(REDIRECTS_CACHE_TAG)` and take
 * effect immediately instead of waiting out the TTL.
 */
const loadRedirectMap = unstable_cache(
  async (): Promise<Record<string, ResolvedRedirect>> => {
    try {
      await dbConnect();
      const rows = await Redirect.find({})
        .select("from to statusCode")
        .lean<{ from: string; to: string; statusCode: 301 | 302 }[]>();

      const map: Record<string, ResolvedRedirect> = {};
      for (const row of rows) {
        map[row.from] = { to: row.to, statusCode: row.statusCode };
      }
      return map;
    } catch {
      // DB unavailable — no redirects rather than a crashed page.
      return {};
    }
  },
  ["redirect-map"],
  { revalidate: 300, tags: [REDIRECTS_CACHE_TAG] },
);

/**
 * The redirect for a path, or `null`. Follows one hop of chaining (a → b → c)
 * with a small bound so a cycle an editor created can never hang a request.
 */
export async function resolveRedirect(
  path: string,
): Promise<ResolvedRedirect | null> {
  const map = await loadRedirectMap();

  let current = normalizePath(path);
  const seen = new Set<string>([current]);
  let hit: ResolvedRedirect | null = null;

  // Collapse a chain (a → b → c) to its final destination so the browser makes
  // one hop, not three. Bounded and cycle-guarded: an editor who creates a loop
  // gets the last good hop, never a hung request.
  for (let i = 0; i < MAX_REDIRECT_HOPS; i++) {
    const next = map[current];
    if (!next) break;

    hit = next;

    // An off-site destination ends the chain — we can't redirect it further.
    if (!next.to.startsWith("/")) break;

    const target = normalizePath(next.to);
    if (seen.has(target)) break; // cycle → stop at the last good hop
    seen.add(target);
    current = target;
  }

  return hit;
}

/** Chain depth before we stop following. Redirect chains should be rare. */
const MAX_REDIRECT_HOPS = 5;

/**
 * Send the visitor onward at the status code the editor chose.
 *
 * Next's `redirect()` emits **307 Temporary Redirect** and takes no status
 * argument, so calling it for a rule stored as `301` silently downgrades a
 * permanent move to a temporary one and the destination never inherits the
 * source's link equity — the entire point of recording the redirect. App Router
 * cannot emit a literal `301`; `permanentRedirect()` emits **308**, which is the
 * permanent equivalent and which search engines treat interchangeably with 301.
 *
 * So: `301` → 308 (permanent), `302` → 307 (temporary).
 *
 * `to` overrides the stored destination for routes that rebuild a child path
 * from a parent's rule (`/clinic/old/cost` → `/clinic/new/cost`).
 *
 * Never returns.
 */
export function applyRedirect(hit: ResolvedRedirect, to?: string): never {
  const target = to ?? hit.to;
  if (hit.statusCode === 301) permanentRedirect(target);
  redirect(target);
}

/**
 * The one line a dynamic route calls instead of `notFound()`.
 *
 * "This URL doesn't resolve" is precisely the moment a redirect should be
 * considered, so every route whose content can move (a renamed page, a
 * re-slugged post) should 404 *through* here. If a redirect exists we send the
 * visitor — and the crawler's link equity — to the new URL; otherwise the normal
 * 404 renders.
 *
 * Never returns.
 */
export async function redirectOrNotFound(path: string): Promise<never> {
  const hit = await resolveRedirect(path);
  if (hit) applyRedirect(hit);
  notFound();
}
