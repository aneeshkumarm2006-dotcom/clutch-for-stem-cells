/**
 * The page node for a code-owned route that isn't a record, a directory, or a
 * composed page — `/for-clinics`, `/find-a-clinic`, `/contact`.
 *
 * These routes hand-roll their own layout, so they were the ones left without
 * any JSON-LD at all: a crawler could see the site's `Organization` and
 * `WebSite` on them (via `<BaseSchema>`) but nothing saying what the URL itself
 * is. This is the one-line fix, reading title and description from the same
 * static-page registry that already feeds `<title>` and the meta description, so
 * the node can never drift from the head.
 *
 * Prose/legal pages don't use this — `<ProsePage>` emits its own node plus
 * whatever its content blocks contribute.
 */
import * as React from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { staticPageMeta } from "@/config/static-pages";
import { webPageJsonLd, type WebPageType } from "@/lib/seo";

export function StaticPageSchema({
  path,
  type,
  name,
}: {
  /** Normalized root-relative path, e.g. `/for-clinics`. */
  path: string;
  /** Narrower `@type` where one applies (`ContactPage`, `AboutPage`). */
  type?: WebPageType;
  /** Fallback name for a path with no registry entry. */
  name?: string;
}) {
  const meta = staticPageMeta(path);
  const pageName = meta?.title ?? name;
  if (!pageName) return null;

  return (
    <JsonLd
      data={webPageJsonLd({
        name: pageName,
        description: meta?.description,
        path,
        type,
      })}
    />
  );
}
