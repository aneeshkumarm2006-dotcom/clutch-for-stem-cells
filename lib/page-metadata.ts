/**
 * Page metadata with admin-tunable defaults — Stage 7.2 / PRD §11.
 *
 * `buildMetadata` (lib/seo.ts) is pure and DB-free; this thin server-only wrapper
 * loads the `SiteSetting.seoDefaults` (title template, default OG image, twitter
 * handle, fallback description, global noindex) and threads them through so every
 * public page resolves metadata as: per-entity `seo` override → per-route
 * override (`SiteSetting.pageSeo`, edited at `/admin/seo`) → the route's own
 * copy → the `config/static-pages.ts` shipped default → Settings defaults →
 * `config/site.ts` constants. Use it inside `generateMetadata`.
 */
import "server-only";
import { cache } from "react";
import type { Metadata } from "next";

import { dbConnect } from "@/lib/db";
import { buildMetadata, type BuildMetadataInput } from "@/lib/seo";
import { normalizePagePath, staticPageMeta } from "@/config/static-pages";
import {
  SiteSetting,
  toPlainObject,
  type IPageSeoOverride,
  type ISeo,
  type ISeoDefaults,
} from "@/models";

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
 * Per-route meta overrides keyed by normalized path, memoized per request. Same
 * build-time resilience as {@link getSeoDefaults} — an unreachable DB degrades
 * to "no overrides" rather than failing the render.
 */
export const getPageSeoOverrides = cache(
  async (): Promise<Map<string, IPageSeoOverride>> => {
    try {
      await dbConnect();
      const settings = await SiteSetting.getGlobal();
      const map = new Map<string, IPageSeoOverride>();
      for (const entry of settings.pageSeo ?? []) {
        if (!entry?.path) continue;
        // `getGlobal()` returns a hydrated document, so these are Mongoose
        // subdocuments — spreading one copies internal `$__`/`_doc` keys and
        // none of the real values. `toPlainObject` is the project's guard.
        map.set(
          normalizePagePath(entry.path),
          toPlainObject(entry) as IPageSeoOverride,
        );
      }
      return map;
    } catch {
      return new Map();
    }
  },
);

/** Blank strings mean "not set" — an editor clearing a field must fall through. */
function present(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

/**
 * Layer a route-level override under an entity's own `seo`. The entity wins
 * field-by-field (not wholesale) so a clinic that sets only `metaTitle` still
 * picks up a route-level `metaDescription`.
 */
function mergeSeo(
  base: IPageSeoOverride | undefined,
  entity: ISeo | null | undefined,
): ISeo | null {
  if (!base && !entity) return null;
  if (!base) return entity ?? null;

  // `path` is the lookup key, not a metadata field — drop it.
  const baseSeo: Record<string, unknown> = { ...base };
  delete baseSeo.path;
  if (!entity) return baseSeo as ISeo;

  const merged: Record<string, unknown> = { ...baseSeo };
  // `entity` can be a Mongoose subdocument too — normalize before enumerating.
  for (const [key, value] of Object.entries(toPlainObject(entity))) {
    if (present(value)) merged[key] = value;
  }
  return merged as ISeo;
}

/**
 * Build a Next.js `Metadata` object with the admin Settings defaults applied.
 * Drop-in for `buildMetadata` in any async `generateMetadata`; pass a per-entity
 * `seo` override (clinic/article/taxonomy term) and it wins over the defaults.
 *
 * When `path` names a route registered in `config/static-pages.ts`, its shipped
 * title/description fill in for anything the caller didn't pass — which is what
 * lets `/admin/seo` list and override those pages without each route file
 * repeating its own copy.
 */
export async function pageMetadata(
  input: Omit<BuildMetadataInput, "defaults"> = {},
): Promise<Metadata> {
  const [defaults, overrides] = await Promise.all([
    getSeoDefaults(),
    getPageSeoOverrides(),
  ]);

  const shipped = input.path ? staticPageMeta(input.path) : undefined;
  // A path carrying a query (`/blog?page=2`) is a variant of the canonical
  // route, not the route itself — it keeps its own computed title rather than
  // inheriting the override written for the clean URL.
  const routeOverride =
    input.path && !input.path.includes("?")
      ? overrides.get(normalizePagePath(input.path))
      : undefined;

  return buildMetadata({
    ...input,
    title: input.title ?? shipped?.title,
    description: input.description ?? shipped?.description,
    seo: mergeSeo(routeOverride, input.seo),
    defaults,
  });
}
