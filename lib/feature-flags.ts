/**
 * Runtime feature flags for the public site.
 *
 * `config/site.ts` holds the build-time defaults; the `SiteSetting` singleton
 * may override any of them at runtime (PRD §8.10), which is what makes a flag a
 * kill switch rather than a deploy. Resolved here in one place, cached per
 * request the same way `getAnalyticsConfig` is, so a layout can read a flag
 * without forcing a dynamic render.
 *
 * A Settings read that fails falls back to the build-time default: an
 * unreachable database must not silently change what the site does.
 */
import "server-only";
import { cache } from "react";

import { FEATURES, type FeatureFlag } from "@/config/site";
import { dbConnect } from "@/lib/db";
import { SiteSetting, toPlainObject } from "@/models";

export type ResolvedFeatureFlags = Record<FeatureFlag, boolean>;

export const getFeatureFlags = cache(
  async (): Promise<ResolvedFeatureFlags> => {
    try {
      await dbConnect();
      const doc = await SiteSetting.getGlobal();
      const stored = toPlainObject(doc.featureFlags) as Partial<
        Record<FeatureFlag, unknown>
      > | null;
      if (!stored) return { ...FEATURES };
      const merged = { ...FEATURES } as ResolvedFeatureFlags;
      for (const key of Object.keys(FEATURES) as FeatureFlag[]) {
        const value = stored[key];
        if (typeof value === "boolean") merged[key] = value;
      }
      return merged;
    } catch {
      return { ...FEATURES };
    }
  },
);

/** Resolve a single flag. Prefer {@link getFeatureFlags} when reading several. */
export async function isFeatureOn(flag: FeatureFlag): Promise<boolean> {
  return (await getFeatureFlags())[flag];
}
