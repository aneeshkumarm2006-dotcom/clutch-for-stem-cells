/**
 * Schema context — resolves the site identity the engine's builders read.
 *
 * Precedence mirrors the rest of the SEO layer: **admin `SiteSetting` → the
 * `config/content-engine` fallback**. That is what lets an editor change the org
 * name, logo, or social profiles and have every page's `Organization` node
 * update without a deploy.
 *
 * Memoized per request with `cache()` and resilient to a missing DB (build time,
 * outage) — it degrades to the config constants rather than throwing, exactly
 * like `getSeoDefaults` in `lib/page-metadata.ts`.
 */
import "server-only";
import { cache } from "react";

import { CONTENT_ENGINE } from "@/config/content-engine";
import { dbConnect } from "@/lib/db";
import { SiteSetting, type ISiteSetting } from "@/models";
import type { SchemaContext } from "@/lib/schema/types";

/** The socials an admin has actually filled in, as `sameAs` URLs. */
function sameAsFrom(settings: ISiteSetting | null): string[] {
  const social = settings?.social;
  if (!social) return [];
  return [
    social.linkedin,
    social.instagram,
    social.facebook,
    social.x,
    social.youtube,
  ].filter((v): v is string => Boolean(v?.trim()));
}

/**
 * Resolve the site identity for this request. Falls back to the config values
 * for any field the admin has left blank, so a half-filled Settings document
 * still produces a complete `Organization` node.
 */
export const getSchemaContext = cache(async (): Promise<SchemaContext> => {
  const fallback = CONTENT_ENGINE.siteIdentity;

  let settings: ISiteSetting | null = null;
  try {
    await dbConnect();
    settings = await SiteSetting.getGlobal();
  } catch {
    // DB unavailable (build time / outage) — config-only identity is still valid.
  }

  const structured = settings?.structuredData;
  const sameAs = sameAsFrom(settings);

  return {
    siteName: structured?.organizationName?.trim() || fallback.name,
    siteUrl: fallback.url,
    logo: structured?.logo?.url || fallback.logo,
    sameAs: sameAs.length ? sameAs : [...fallback.sameAs],
    defaultOgImage:
      settings?.seoDefaults?.ogImage || fallback.defaultOgImage,
    organizationType:
      structured?.organizationType?.trim() || fallback.organizationType,
    searchPath: fallback.searchPath,
  };
});
