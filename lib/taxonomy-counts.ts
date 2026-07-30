/**
 * Denormalized taxonomy `clinicCount` recompute.
 *
 * The admin create/update routes and the clinic importer do NOT maintain
 * `clinicCount` on taxonomy terms — only the seed sets it — so after
 * adding/publishing/archiving clinics the stored counts drift.
 *
 * That drift used to be cosmetic (a stale badge on a related-links rail). It is
 * now load-bearing: `lib/seo-indexation.ts::isThinDirectoryTerm` reads
 * `clinicCount` to decide whether a term page is indexed and whether it appears
 * in `sitemap.xml`. A term stuck at 0 would be withheld from the index even
 * after clinics were attached to it, so the count has to be refreshed on a
 * schedule rather than by hand — see `/api/cron/recompute`.
 *
 * Idempotent: re-running yields the same result. Counts are derived from one
 * read of every published, non-deleted clinic, exactly the way `seed.ts`
 * (`setRefCounts`) derives them — ref-based taxonomies by id membership,
 * locations by `countryCode` (country) or `city` name (city).
 */
// No `server-only` guard, deliberately: `scripts/recompute-clinic-counts.ts`
// imports this under plain `tsx` (same as `lib/ranking` and `lib/ratings`).
import type { Model } from "mongoose";

import { dbConnect } from "@/lib/db";
import {
  Accreditation,
  CellSource,
  Clinic,
  Condition,
  Location,
  Treatment,
  type IClinic,
} from "@/models";

/** Case- and accent-folded place name, for comparing the two spellings. */
function foldPlaceName(value: string | undefined | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export interface ClinicCountRecomputeResult {
  /** Terms whose stored count differed and was corrected. */
  changed: number;
  /** Terms already holding the right count. */
  unchanged: number;
  /** Published clinics the counts were derived from. */
  clinics: number;
  /** `"<Label> <slug>: <before> -> <after>"` for each corrected term. */
  drift: string[];
}

/**
 * Recompute `clinicCount` for every taxonomy term. Pass `{ dry: true }` to
 * report drift without writing (what `npm run recompute-counts -- --dry` does).
 */
export async function recomputeAllClinicCounts(
  opts: { dry?: boolean } = {},
): Promise<ClinicCountRecomputeResult> {
  const { dry = false } = opts;
  await dbConnect();

  // One read of every public clinic; all counts are computed in memory from it.
  const clinics = (await Clinic.find(
    { status: "published", isDeleted: false },
    {
      treatmentTypes: 1,
      conditionsTreated: 1,
      cellSources: 1,
      accreditations: 1,
      locations: 1,
    },
  ).lean()) as unknown as IClinic[];

  const has = (arr: unknown[], termId: unknown) =>
    (arr as { toString(): string }[]).some(
      (x) => String(x) === String(termId),
    );

  const result: ClinicCountRecomputeResult = {
    changed: 0,
    unchanged: 0,
    clinics: clinics.length,
    drift: [],
  };

  const record = (label: string, slug: string, current: number, next: number) => {
    if (current === next) {
      result.unchanged++;
      return false;
    }
    result.changed++;
    result.drift.push(`${label} ${slug}: ${current} -> ${next}`);
    return true;
  };

  // ── Ref-based taxonomies (treatment/condition/cellSource/accreditation) ──
  // Mongoose's Model<T> is invariant, so a permissive element type is required
  // to hold the distinct taxonomy models (Treatment, Condition, …) in one array.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refGroups: [string, Model<any>, keyof IClinic][] = [
    ["Treatment", Treatment, "treatmentTypes"],
    ["Condition", Condition, "conditionsTreated"],
    ["CellSource", CellSource, "cellSources"],
    ["Accreditation", Accreditation, "accreditations"],
  ];
  for (const [label, TermModel, field] of refGroups) {
    const terms = await TermModel.find({}, { slug: 1, clinicCount: 1 }).lean();
    for (const term of terms) {
      const next = clinics.filter((c) =>
        has(c[field] as unknown[], term._id),
      ).length;
      if (record(label, term.slug, term.clinicCount ?? 0, next) && !dry) {
        await TermModel.updateOne(
          { _id: term._id },
          { $set: { clinicCount: next } },
        );
      }
    }
  }

  // ── Location taxonomy: country by countryCode, city by name (seed parity) ──
  // City names are matched accent- and case-insensitively, mirroring
  // `lib/search.ts::placeNameRegex`: the taxonomy stores "Cancún" while an
  // imported clinic usually stores "Cancun", and a count that disagreed with
  // what the page actually lists would gate indexation on the wrong number.
  const locs = await Location.find(
    {},
    { slug: 1, name: 1, kind: 1, countryCode: 1, clinicCount: 1 },
  ).lean();
  for (const loc of locs) {
    const cityName = foldPlaceName(loc.name);
    const next = clinics.filter((c) =>
      (c.locations ?? []).some((l) =>
        loc.kind === "country"
          ? l.countryCode === loc.countryCode
          : foldPlaceName(l.city) === cityName,
      ),
    ).length;
    if (record("Location", loc.slug, loc.clinicCount ?? 0, next) && !dry) {
      await Location.updateOne(
        { _id: loc._id },
        { $set: { clinicCount: next } },
      );
    }
  }

  return result;
}
