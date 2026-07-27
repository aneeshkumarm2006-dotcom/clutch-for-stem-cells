/**
 * Clinic landing-page read layer — the `/clinics/{slug}` curated directory cuts.
 *
 * Deliberately a small module of its own rather than another section of
 * `lib/public-data.ts`: a landing page owns no clinic data, it only names a set
 * of pinned filters that the existing directory query then runs. Everything
 * here is a plain serializable view — no Mongoose docs cross into a component.
 */
import "server-only";
import { cache } from "react";

import { dbConnect } from "@/lib/db";
import { searchClinics, type ClinicSearchParams } from "@/lib/search";
import type { SitemapEntry } from "@/lib/public-data";
import type { FilterDimension } from "@/components/directory/directory-controls";
import { ClinicLanding, type IClinicLanding, type ISeo } from "@/models";

export interface ClinicLandingFaq {
  question: string;
  answer: string;
}

export interface ClinicLandingView {
  slug: string;
  name: string;
  path: string;
  /** On-page `<h1>` — falls back to the record's name. */
  heading: string;
  intro?: string;
  filters: {
    country?: string;
    region?: string;
    city?: string;
    treatments?: string[];
    conditions?: string[];
  };
  seo?: ISeo | null;
  faqs: ClinicLandingFaq[];
  updatedAt: Date;
}

type LeanLanding = IClinicLanding;

function toView(doc: LeanLanding): ClinicLandingView {
  const filters = doc.filters ?? {};
  return {
    slug: doc.slug,
    name: doc.name,
    path: `/clinics/${doc.slug}`,
    heading: doc.heading?.trim() || doc.name,
    intro: doc.intro?.trim() || undefined,
    filters: {
      country: filters.country?.trim() || undefined,
      region: filters.region?.trim() || undefined,
      city: filters.city?.trim() || undefined,
      treatments: filters.treatments?.length ? filters.treatments : undefined,
      conditions: filters.conditions?.length ? filters.conditions : undefined,
    },
    seo: doc.seo ?? null,
    faqs: (doc.faqs ?? [])
      .filter((f) => f?.question && f?.answer)
      .map((f) => ({ question: f.question, answer: f.answer })),
    updatedAt: doc.updatedAt,
  };
}

/**
 * The active landing page at `/clinics/{slug}`, or `null`. Request-memoized —
 * `generateMetadata` and the page body both resolve it.
 */
export const getClinicLanding = cache(
  async (slug: string): Promise<ClinicLandingView | null> => {
    await dbConnect();
    const doc = await ClinicLanding.findOne({
      slug: slug.toLowerCase(),
      isActive: true,
    }).lean<LeanLanding | null>();
    return doc ? toView(doc) : null;
  },
);

/** Every active landing slug — powers `generateStaticParams`. */
export async function getClinicLandingSlugs(): Promise<string[]> {
  await dbConnect();
  const rows = await ClinicLanding.find({ isActive: true })
    .select("slug")
    .lean<{ slug: string }[]>();
  return rows.map((r) => r.slug);
}

/**
 * Sitemap entries — active pages that are actually worth crawling.
 *
 * Two exclusions, both mirroring what the page itself will render: an editor
 * `noindex`, and a page whose filters currently match no published clinic. The
 * emptiness check runs the same directory query the page runs, so the sitemap
 * can't claim a page the page's own robots tag denies — and a landing page
 * re-enters the sitemap by itself as soon as a matching clinic is published.
 */
export async function getClinicLandingSitemapEntries(): Promise<SitemapEntry[]> {
  await dbConnect();
  const rows = await ClinicLanding.find({ isActive: true })
    .lean<LeanLanding[]>();

  const candidates = rows.map(toView).filter((l) => !l.seo?.noindex);
  const counts = await Promise.all(
    candidates.map((l) =>
      searchClinics({ ...landingFilterOverrides(l), pageSize: 1 }).then(
        (r) => r.total,
      ),
    ),
  );

  return candidates
    .filter((_, i) => (counts[i] ?? 0) > 0)
    .map((l) => ({ path: l.path, lastModified: l.updatedAt }));
}

/**
 * The landing page's pinned filters as directory-query overrides. Kept next to
 * the view so the route and any future consumer can't apply them differently.
 */
export function landingFilterOverrides(
  landing: ClinicLandingView,
): Partial<ClinicSearchParams> {
  const { country, region, city, treatments, conditions } = landing.filters;
  return {
    ...(country ? { country } : {}),
    ...(region ? { region } : {}),
    ...(city ? { city } : {}),
    ...(treatments ? { treatments } : {}),
    ...(conditions ? { conditions } : {}),
  };
}

/**
 * Dimensions this page pins, for the indexation rule — a `?country=` that only
 * restates what the path already fixes doesn't make the URL a filtered variant.
 * `region` is absent because it has no query-string form to ignore.
 */
export function landingIndexationLocks(landing: ClinicLandingView): string[] {
  const locked: string[] = [];
  if (landing.filters.country) locked.push("country");
  if (landing.filters.city) locked.push("city");
  if (landing.filters.treatments?.length) locked.push("treatment");
  if (landing.filters.conditions?.length) locked.push("condition");
  return locked;
}

/**
 * The same pins, narrowed to the dimensions the filter rail actually renders,
 * so a pinned facet is hidden rather than shown as changeable. `city` isn't a
 * rail dimension (the location facet is country-level), which is why this is a
 * separate list from {@link landingIndexationLocks} rather than a cast.
 */
export function landingRailLocks(
  landing: ClinicLandingView,
): FilterDimension[] {
  const locked: FilterDimension[] = [];
  if (landing.filters.country) locked.push("country");
  if (landing.filters.treatments?.length) locked.push("treatment");
  if (landing.filters.conditions?.length) locked.push("condition");
  return locked;
}
