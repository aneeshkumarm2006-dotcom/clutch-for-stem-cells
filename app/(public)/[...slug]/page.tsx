/**
 * Composed (block) pages — served at `/{slug}` — and the redirect backstop.
 *
 * A catch-all rather than a single `[slug]` segment so it does double duty:
 *  - a one-segment path may be an editor-composed Page;
 *  - a path of *any* depth that no other route claimed gets checked against the
 *    redirect table before we 404.
 *
 * Next.js resolves static segments before dynamic ones and dynamic before
 * catch-alls, so this can never shadow an existing route (`/about`, `/clinics`,
 * `/blog/[slug]`, …). `RESERVED_SLUGS` additionally stops an editor from
 * *creating* a page whose URL would be unreachable.
 *
 * A composed page may also be nested under a route that opts in (see
 * `NESTABLE_SLUG_PREFIXES`) — those never reach this catch-all, because the
 * owning route matches first and looks the page up itself.
 *
 * Metadata and JSON-LD both flow through the shared engines, so an editor gets
 * correct `<head>` tags and valid structured data purely by composing blocks.
 */
import type { Metadata } from "next";

import { ComposedPageView } from "@/components/blocks/composed-page-view";
import { pageMetadata } from "@/lib/page-metadata";
import { redirectOrNotFound } from "@/lib/redirects";
import {
  getApprovedPage,
  getApprovedPageSlugs,
} from "@/lib/seoteam/page-data";

export const revalidate = 600;

export async function generateStaticParams() {
  // Best-effort: a build-time DB outage degrades to on-demand rendering rather
  // than failing the build (the same fallback the clinic route uses).
  try {
    const slugs = await getApprovedPageSlugs();
    // Nested pages belong to the route they're nested under, not to this
    // catch-all — pre-rendering them here would claim a path this file can't
    // actually serve.
    return slugs
      .filter((slug) => !slug.includes("/"))
      .map((slug) => ({ slug: [slug] }));
  } catch {
    return [];
  }
}

/** A composed page reached *through this route* only ever lives at one segment. */
function pageSlugOf(segments: string[]): string | null {
  return segments.length === 1 ? (segments[0] ?? null) : null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string[] };
}): Promise<Metadata> {
  const slug = pageSlugOf(params.slug);
  const page = slug ? await getApprovedPage(slug) : null;
  if (!page) return pageMetadata({ title: "Page not found" });

  return pageMetadata({
    title: page.title,
    description: page.intro,
    path: page.path,
    type: "article",
    // The per-page SEO override (meta/OG/Twitter/robots/canonical) wins over the
    // Settings defaults — see `buildMetadata`.
    seo: page.seo,
    // A thin page still renders, but stays out of the index (noindex, follow).
    noindex: !page.indexable,
  });
}

export default async function ComposedPage({
  params,
}: {
  params: { slug: string[] };
}) {
  const slug = pageSlugOf(params.slug);
  const page = slug ? await getApprovedPage(slug) : null;

  // Nothing resolves here — the one moment a redirect should fire. `return`s so
  // TypeScript narrows `page` below (the helper's `never` only terminates
  // control flow at a return statement).
  if (!page) return redirectOrNotFound(`/${params.slug.join("/")}`);

  return <ComposedPageView page={page} />;
}
