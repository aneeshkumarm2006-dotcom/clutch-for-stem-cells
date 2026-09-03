/**
 * Price aggregation for the cost tools — the read layer that turns published
 * clinic pricing into the bands `/tools/stem-cell-cost-calculator` starts from.
 *
 * The whole argument for putting a cost calculator on a directory rather than on
 * a blog is here: the starting number is not an assumption, it is the middle of
 * what the clinics listed on this site actually publish, and the visitor can
 * click through to the records behind it. So the sample size travels with every
 * band and the pages print it, because a band built from four clinics and a band
 * built from forty deserve different amounts of trust.
 *
 * Deliberate limits, all of which the copy states:
 *  - Only clinics publishing a price in the site's default currency are counted.
 *    Mixing currencies without live FX would invent precision that is not there.
 *  - A clinic quoting a single figure contributes it as both ends of its range.
 *  - Bands need `MIN_SAMPLE` clinics to stand on their own. Below that the tool
 *    falls back to the all-clinics band and says it did.
 *
 * Cached across requests under its own tag with an hourly floor, the same shape
 * as the taxonomy readers in `lib/public-data.ts`. The statistics themselves
 * live in `lib/tools/price-band.ts`, which the client calculators import; this
 * file is the part that talks to Mongo.
 */
import "server-only";
import { unstable_cache } from "next/cache";

import { dbConnect } from "@/lib/db";
import { DEFAULT_CURRENCY } from "@/config/site";
import { Clinic, Treatment, type ITaxonomyBase } from "@/models";
import {
  MIN_SAMPLE,
  bandFromPoints,
  emptyPriceData,
  type PricePoint,
  type PriceSlice,
  type ToolPriceData,
} from "@/lib/tools/price-band";

export const PRICE_DATA_TAG = "tools-price-data";
const PRICE_DATA_REVALIDATE_SECONDS = 3600;

interface PricedClinic {
  point: PricePoint;
  treatmentIds: string[];
  countries: string[];
}

/** One clinic's price point, or `null` when it publishes nothing usable. */
function pointFor(min?: number, max?: number): PricePoint | null {
  const lo = typeof min === "number" && min > 0 ? min : undefined;
  const hi = typeof max === "number" && max > 0 ? max : undefined;
  if (lo === undefined && hi === undefined) return null;
  const low = lo ?? hi!;
  const high = hi ?? lo!;
  // A clinic that filed its range backwards still has a range.
  if (high < low) return { low: high, high: low, mid: (low + high) / 2 };
  return { low, high, mid: (low + high) / 2 };
}

/** Slugify a country name the way the directory's location filter expects. */
function countrySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readPriceData(): Promise<ToolPriceData> {
  await dbConnect();

  const [clinicDocs, treatmentDocs] = await Promise.all([
    Clinic.find({
      status: "published",
      isDeleted: false,
      currency: DEFAULT_CURRENCY,
      $or: [{ priceMin: { $gt: 0 } }, { priceMax: { $gt: 0 } }],
    })
      .select("priceMin priceMax treatmentTypes locations")
      .lean(),
    Treatment.find({ isActive: true }).select("name slug").lean(),
  ]);

  const priced: PricedClinic[] = [];
  for (const doc of clinicDocs) {
    const point = pointFor(doc.priceMin, doc.priceMax);
    if (!point) continue;
    priced.push({
      point,
      treatmentIds: (doc.treatmentTypes ?? []).map(String),
      countries: Array.from(
        new Set(
          (doc.locations ?? [])
            .map((l) => l.country?.trim())
            .filter((c): c is string => Boolean(c)),
        ),
      ),
    });
  }

  const overall = bandFromPoints(priced.map((c) => c.point));

  // Treatments, keyed by the term's id so the join needs no extra query.
  const treatmentTerms = (treatmentDocs as unknown as ITaxonomyBase[]).map(
    (t) => ({ id: String(t._id), name: t.name, slug: t.slug }),
  );
  const byTreatment = new Map<string, PricePoint[]>();
  for (const clinic of priced) {
    for (const tid of clinic.treatmentIds) {
      const list = byTreatment.get(tid);
      if (list) list.push(clinic.point);
      else byTreatment.set(tid, [clinic.point]);
    }
  }

  const treatments: PriceSlice[] = treatmentTerms
    .map((term) => {
      const points = byTreatment.get(term.id) ?? [];
      const ownData = points.length >= MIN_SAMPLE;
      return {
        slug: term.slug,
        name: term.name,
        band: ownData
          ? bandFromPoints(points)
          : { ...overall, sampleSize: points.length },
        ownData,
      };
    })
    .filter((slice) => slice.band.typical > 0);

  // Countries, keyed by name because that is what a clinic location stores.
  const byCountry = new Map<string, PricePoint[]>();
  for (const clinic of priced) {
    for (const name of clinic.countries) {
      const list = byCountry.get(name);
      if (list) list.push(clinic.point);
      else byCountry.set(name, [clinic.point]);
    }
  }

  const countries: PriceSlice[] = Array.from(byCountry.entries())
    .map(([name, points]) => {
      const ownData = points.length >= MIN_SAMPLE;
      return {
        slug: countrySlug(name),
        name,
        band: ownData
          ? bandFromPoints(points)
          : { ...overall, sampleSize: points.length },
        ownData,
      };
    })
    .filter((slice) => slice.band.typical > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    overall,
    treatments: treatments.sort((a, b) => a.name.localeCompare(b.name)),
    countries,
    currency: DEFAULT_CURRENCY,
    clinicCount: priced.length,
  };
}

/** Cached price bands for the cost tools. Never throws. */
export async function getToolPriceData(): Promise<ToolPriceData> {
  try {
    return await unstable_cache(readPriceData, ["tools-price-data"], {
      revalidate: PRICE_DATA_REVALIDATE_SECONDS,
      tags: [PRICE_DATA_TAG],
    })();
  } catch {
    return emptyPriceData(DEFAULT_CURRENCY);
  }
}
