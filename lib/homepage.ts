/**
 * Resolved homepage content, server side.
 *
 * Thin request-memoized wrapper over `resolveHomepage` (config/homepage.ts): it
 * loads the `SiteSetting` singleton, hands both halves of the landing page's
 * storage to the pure resolver, and returns content that is always complete —
 * anything unset falls back to the shipped copy.
 *
 * Two callers on the same request (`generateMetadata` for the keywords, the page
 * body for everything else) share one read thanks to `cache()`. A DB that is
 * unreachable at build time degrades to the shipped defaults rather than
 * throwing, matching how `getSeoDefaults` behaves.
 */
import "server-only";
import { cache } from "react";

import { dbConnect } from "@/lib/db";
import { SiteSetting, toPlainObject } from "@/models";
import {
  HOMEPAGE_DEFAULTS,
  resolveHomepage,
  type HomepageContent,
  type HomepageLegacySource,
  type HomepageOverrides,
} from "@/config/homepage";

export const getHomepageContent = cache(async (): Promise<HomepageContent> => {
  try {
    await dbConnect();
    const settings = await SiteSetting.getGlobal();
    // `getGlobal()` returns a hydrated document, so `homepage` is a Mongoose
    // subdocument — spreading one copies internal keys and none of the values.
    // The two arrays are read field by field for the same reason.
    return resolveHomepage(
      toPlainObject(settings.homepage) as HomepageOverrides,
      {
        hero: toPlainObject(settings.hero),
        popularSearches: (settings.popularSearches ?? []).map((p) => ({
          label: p.label,
          href: p.href,
        })),
        testimonials: (settings.testimonials ?? []).map((t) => ({
          quote: t.quote,
          author: t.author,
          role: t.role,
          location: t.location,
          rating: t.rating,
        })),
      } as HomepageLegacySource,
    );
  } catch {
    return HOMEPAGE_DEFAULTS;
  }
});
