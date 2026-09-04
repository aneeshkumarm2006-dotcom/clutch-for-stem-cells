/**
 * The clinic index the matching tools run against.
 *
 * `lib/tools/price-data.ts` answers "what does this cost"; this answers "which
 * clinics fit". Same shape of job: one cached read that turns published clinic
 * records into a compact, serializable structure the client widgets can work
 * over without a round trip.
 *
 * **Why the whole index ships to the browser.** The quiz re-ranks on every
 * answer, and a fetch per keystroke would be four API calls to show three
 * results, plus a rate limiter, plus a loading state, on a page whose entire
 * appeal is that it answers instantly. So the index is prerendered into the page
 * and the filtering happens client-side. The payload is the reason that is
 * affordable: the fields below are what a result card renders and nothing else,
 * about 250 bytes per clinic, and {@link MAX_INDEXED_CLINICS} bounds it as the
 * directory grows. If the directory ever outgrows that cap, the fix is an API
 * route, not a bigger cap.
 *
 * Only published, non-deleted clinics are indexed, which is the same set the
 * directory shows. Nothing here reads a clinic's plan, tier or sort score: see
 * the ranking note in `lib/tools/match.ts` for why.
 */
import "server-only";
import { unstable_cache } from "next/cache";

import { dbConnect } from "@/lib/db";
import { formatLocation } from "@/lib/format";
import { DEFAULT_CURRENCY } from "@/config/site";
import { Clinic, Condition, Treatment, type IClinic } from "@/models";
import {
  emptyMatchIndex,
  type ClinicMatchIndex,
  type MatchClinic,
  type MatchOption,
} from "@/lib/tools/match";

export const MATCH_INDEX_TAG = "tools-match-index";
const MATCH_INDEX_REVALIDATE_SECONDS = 3600;

/**
 * Ceiling on clinics shipped to the browser, ordered by review count so the
 * best-documented listings survive a truncation. Well above the current
 * directory; it exists so an import of several thousand clinics degrades into a
 * partial index rather than a several-megabyte page.
 */
export const MAX_INDEXED_CLINICS = 500;

const id = (v: unknown): string => String(v);

/** Slugify a country name the way the directory's location filter expects. */
export function countrySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "City, Country (+N)" headline location, matching the directory card. */
function locationLabel(locations: IClinic["locations"]): string | undefined {
  if (!locations?.length) return undefined;
  const hq = locations.find((l) => l.isHQ) ?? locations[0]!;
  const base = formatLocation({ city: hq.city, country: hq.country });
  if (!base) return undefined;
  return locations.length > 1 ? `${base} +${locations.length - 1}` : base;
}

/** Count how many clinics carry each slug, dropping options nothing matches. */
function optionsFrom(
  terms: { slug: string; name: string }[],
  counts: Map<string, number>,
): MatchOption[] {
  return terms
    .map((t) => ({ slug: t.slug, name: t.name, count: counts.get(t.slug) ?? 0 }))
    .filter((o) => o.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function readMatchIndex(): Promise<ClinicMatchIndex> {
  await dbConnect();

  const [clinicDocs, treatmentDocs, conditionDocs] = await Promise.all([
    Clinic.find({ status: "published", isDeleted: false })
      .select(
        "name slug logo locations ratingAvg reviewCount verification priceMin priceMax currency priceModel treatmentTypes conditionsTreated serviceFocus",
      )
      .sort({ reviewCount: -1, name: 1 })
      .limit(MAX_INDEXED_CLINICS)
      .lean(),
    Treatment.find({ isActive: true }).select("name slug").lean(),
    Condition.find({ isActive: true }).select("name slug").lean(),
  ]);

  const treatmentBySlug = new Map(
    (treatmentDocs as unknown as { _id: unknown; name: string; slug: string }[]).map(
      (t) => [id(t._id), { slug: t.slug, name: t.name }],
    ),
  );
  const conditionBySlug = new Map(
    (conditionDocs as unknown as { _id: unknown; name: string; slug: string }[]).map(
      (c) => [id(c._id), { slug: c.slug, name: c.name }],
    ),
  );

  const conditionCounts = new Map<string, number>();
  const treatmentCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const countryNames = new Map<string, string>();

  const clinics: MatchClinic[] = clinicDocs.map((doc) => {
    const conditions = (doc.conditionsTreated ?? [])
      .map((c) => conditionBySlug.get(id(c)))
      .filter((c): c is { slug: string; name: string } => Boolean(c));
    const treatments = (doc.treatmentTypes ?? [])
      .map((t) => treatmentBySlug.get(id(t)))
      .filter((t): t is { slug: string; name: string } => Boolean(t));
    const countries = Array.from(
      new Set(
        (doc.locations ?? [])
          .map((l) => l.country?.trim())
          .filter((c): c is string => Boolean(c)),
      ),
    );

    for (const c of conditions) {
      conditionCounts.set(c.slug, (conditionCounts.get(c.slug) ?? 0) + 1);
    }
    for (const t of treatments) {
      treatmentCounts.set(t.slug, (treatmentCounts.get(t.slug) ?? 0) + 1);
    }
    for (const name of countries) {
      const slug = countrySlug(name);
      countryCounts.set(slug, (countryCounts.get(slug) ?? 0) + 1);
      countryNames.set(slug, name);
    }

    // The focus label the directory card shows, resolved here so the index is
    // self-contained and the widget needs no second lookup.
    const focus = [...(doc.serviceFocus ?? [])]
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3)
      .map((f) => {
        const t = treatmentBySlug.get(id(f.treatmentId));
        return t ? `${f.percent}% ${t.name}` : null;
      })
      .filter(Boolean);

    return {
      slug: doc.slug,
      name: doc.name,
      location: locationLabel(doc.locations),
      logoUrl: doc.logo?.url,
      badge: doc.verification?.isVerified
        ? (doc.verification.badge ?? "verified")
        : null,
      verified: Boolean(doc.verification?.isVerified),
      ratingAvg: doc.ratingAvg ?? 0,
      reviewCount: doc.reviewCount ?? 0,
      chips: conditions.slice(0, 3).map((c) => c.name),
      focusLabel: focus.length ? focus.join(" · ") : undefined,
      conditions: conditions.map((c) => c.slug),
      treatments: treatments.map((t) => t.slug),
      countries,
      countrySlugs: countries.map(countrySlug),
      priceMin: doc.priceMin && doc.priceMin > 0 ? doc.priceMin : null,
      priceMax: doc.priceMax && doc.priceMax > 0 ? doc.priceMax : null,
      currency: doc.currency,
      priceModel: doc.priceModel,
    };
  });

  return {
    clinics,
    conditions: optionsFrom(
      Array.from(conditionBySlug.values()),
      conditionCounts,
    ),
    treatments: optionsFrom(
      Array.from(treatmentBySlug.values()),
      treatmentCounts,
    ),
    countries: optionsFrom(
      Array.from(countryNames.entries()).map(([slug, name]) => ({ slug, name })),
      countryCounts,
    ),
    currency: DEFAULT_CURRENCY,
    clinicCount: clinics.length,
  };
}

/**
 * Cached clinic index for the matching tools. Never throws: a build with no
 * database renders the "directory is empty" state rather than failing, the same
 * way {@link import("@/lib/tools/price-data").getToolPriceData} does.
 */
export async function getClinicMatchIndex(): Promise<ClinicMatchIndex> {
  try {
    return await unstable_cache(readMatchIndex, ["tools-match-index"], {
      revalidate: MATCH_INDEX_REVALIDATE_SECONDS,
      tags: [MATCH_INDEX_TAG],
    })();
  } catch {
    return emptyMatchIndex(DEFAULT_CURRENCY);
  }
}
