/**
 * Page metadata with admin-tunable defaults — Stage 7.2 / PRD §11.
 *
 * `buildMetadata` (lib/seo.ts) is pure and DB-free; this thin server-only wrapper
 * loads the `SiteSetting.seoDefaults` (title template, default OG image, twitter
 * handle, fallback description, global noindex) and threads them through so every
 * public page resolves metadata as: per-entity `seo` override → Settings defaults
 * → `config/site.ts` constants. Use it inside `generateMetadata`.
 */
import "server-only";
import { cache } from "react";
import type { Metadata } from "next";

import { dbConnect } from "@/lib/db";
import { buildMetadata, type BuildMetadataInput } from "@/lib/seo";
import { SiteSetting, type ISeoDefaults } from "@/models";

/**
 * Settings-configured SEO defaults, memoized per request. Resilient: returns
 * `null` if the DB is unavailable (e.g. at build time) so metadata still renders
 * from the `config/site.ts` constants rather than throwing.
 */
export const getSeoDefaults = cache(async (): Promise<ISeoDefaults | null> => {
  try {
    await dbConnect();
    const settings = await SiteSetting.getGlobal();
    return settings.seoDefaults ?? null;
  } catch {
    return null;
  }
});

/**
 * Build a Next.js `Metadata` object with the admin Settings defaults applied.
 * Drop-in for `buildMetadata` in any async `generateMetadata`; pass a per-entity
 * `seo` override (clinic/article/taxonomy term) and it wins over the defaults.
 */
export async function pageMetadata(
  input: Omit<BuildMetadataInput, "defaults"> = {},
): Promise<Metadata> {
  const defaults = await getSeoDefaults();
  return buildMetadata({ ...input, defaults });
}
