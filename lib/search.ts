/**
 * Search & filtering — behind a swappable `searchProvider` (Stage 3.3 / PRD §10).
 *
 * MVP provider: MongoDB `$text` index across clinic name/tagline/description +
 * a single faceted aggregation that returns the result page **and** facet counts
 * in one round trip. Filters combine **AND across categories, OR within a
 * category** (standard facet behavior). All inputs are plain values so the
 * directory page (Stage 5.2) can hydrate them straight from URL query params.
 *
 * Facet counts use *per-dimension exclusion*: each facet reflects every active
 * selection except its own, so sibling option sizes stay visible as you filter.
 *
 * Upgrade path (PRD §10, Phase 2): Atlas Search / Meilisearch / Algolia — swap
 * {@link searchProvider} for a new implementation of {@link SearchProvider};
 * callers depend only on the interface.
 */
import { Types, type Model, type PipelineStage } from "mongoose";
import { z } from "zod";

import { dbConnect } from "@/lib/db";
import { LISTING_SORT, listingRankAddFields } from "@/lib/ranking";
import { CellSource, Clinic, Condition, Treatment } from "@/models";
import type { IClinic } from "@/models";

// ── Public types ─────────────────────────────────────────────────────────────

export const CLINIC_SORTS = [
  "recommended",
  "rating",
  "reviews",
  "price_low",
  "price_high",
  "newest",
  "relevance",
] as const;
export type ClinicSort = (typeof CLINIC_SORTS)[number];

export interface ClinicSearchParams {
  /** Free-text query (clinic name/tagline/description text index). */
  query?: string;
  /** Treatment slugs or 24-hex ids (OR within). */
  treatments?: string[];
  conditions?: string[];
  cellSources?: string[];
  /** Matches `locations.country` (case-insensitive) or its ISO country code. */
  country?: string;
  /** Matches `locations.city` (case-insensitive). */
  city?: string;
  /** Spoken languages (OR within). */
  languages?: string[];
  /** Budget window (USD-agnostic; overlaps the clinic's price range). */
  priceMin?: number;
  priceMax?: number;
  verifiedOnly?: boolean;
  /** Minimum `ratingAvg` (1..5). */
  minRating?: number;
  sort?: ClinicSort;
  /** 1-based page. */
  page?: number;
  pageSize?: number;
  /** Admin/internal: include non-published clinics. Public callers omit this. */
  includeUnpublished?: boolean;
}

/** Card-shaped projection returned for listings (Design §10.4). */
export type ClinicListItem = Pick<
  IClinic,
  | "_id"
  | "name"
  | "slug"
  | "tagline"
  | "logo"
  | "coverImage"
  | "ratingAvg"
  | "ratingBreakdown"
  | "reviewCount"
  | "verification"
  | "tier"
  | "priceMin"
  | "priceMax"
  | "currency"
  | "priceModel"
  | "priceNote"
  | "treatmentTypes"
  | "serviceFocus"
  | "conditionsTreated"
  | "cellSources"
  | "accreditations"
  | "languages"
  | "locations"
  | "highlights"
  | "topMentions"
  | "sortScore"
  | "website"
  | "createdAt"
>;

/** `value` is the term's id (taxonomy) or raw string (country/language). */
export interface FacetCount {
  value: string;
  count: number;
}

export interface ClinicFacets {
  treatments: FacetCount[];
  conditions: FacetCount[];
  cellSources: FacetCount[];
  countries: FacetCount[];
  languages: FacetCount[];
  /** Count of verified clinics within the current (non-verified) selection. */
  verified: number;
}

export interface ClinicSearchResult {
  clinics: ClinicListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: ClinicFacets;
}

export type SuggestionType = "clinic" | "treatment" | "condition";
export interface Suggestion {
  type: SuggestionType;
  label: string;
  slug: string;
}

export interface SearchProvider {
  searchClinics(params: ClinicSearchParams): Promise<ClinicSearchResult>;
  /** Header typeahead across clinics + taxonomy (PRD §6.6). */
  suggest(query: string, limit?: number): Promise<Suggestion[]>;
}

// ── Defaults / helpers ───────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/** Escape a user string for safe use inside a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve a mix of slugs and ids to ObjectIds for a taxonomy collection. */
async function resolveIds<TDoc extends { _id: Types.ObjectId; slug: string }>(
  model: Model<TDoc>,
  values?: string[],
): Promise<Types.ObjectId[]> {
  if (!values?.length) return [];
  const ids: Types.ObjectId[] = [];
  const slugs: string[] = [];
  for (const v of values) {
    if (OBJECT_ID_RE.test(v)) ids.push(new Types.ObjectId(v));
    else if (v.trim()) slugs.push(v.trim());
  }
  if (slugs.length) {
    const docs = await model
      .find({ slug: { $in: slugs } })
      .select("_id")
      .lean();
    for (const d of docs) ids.push(d._id);
  }
  return ids;
}

/** Mongo sort spec for each public sort option. */
function sortSpec(sort: ClinicSort, hasQuery: boolean): Record<string, 1 | -1> {
  switch (sort) {
    case "rating":
      return { ratingAvg: -1, reviewCount: -1 };
    case "reviews":
      return { reviewCount: -1 };
    case "price_low":
      return { priceMin: 1 };
    case "price_high":
      return { priceMax: -1 };
    case "newest":
      return { createdAt: -1 };
    case "relevance":
      // Relevance only means something with a text query; else fall through.
      return hasQuery ? { _score: -1, ...LISTING_SORT } : { ...LISTING_SORT };
    case "recommended":
    default:
      return { ...LISTING_SORT };
  }
}

// Card fields returned by the results branch (inclusion projection also drops
// the internal _score / _featuredRank / _verifiedRank helper fields).
const RESULT_PROJECTION = {
  name: 1,
  slug: 1,
  tagline: 1,
  logo: 1,
  coverImage: 1,
  ratingAvg: 1,
  ratingBreakdown: 1,
  reviewCount: 1,
  verification: 1,
  tier: 1,
  priceMin: 1,
  priceMax: 1,
  currency: 1,
  priceModel: 1,
  priceNote: 1,
  treatmentTypes: 1,
  serviceFocus: 1,
  conditionsTreated: 1,
  cellSources: 1,
  accreditations: 1,
  languages: 1,
  locations: 1,
  highlights: 1,
  topMentions: 1,
  sortScore: 1,
  website: 1,
  createdAt: 1,
} as const;

interface SearchAggResult {
  results: ClinicListItem[];
  totalCount: { n: number }[];
  fTreatments: { _id: Types.ObjectId; count: number }[];
  fConditions: { _id: Types.ObjectId; count: number }[];
  fCellSources: { _id: Types.ObjectId; count: number }[];
  fCountries: { _id: string; count: number }[];
  fLanguages: { _id: string; count: number }[];
  fVerified: { n: number }[];
}

const toFacet = (
  rows: { _id: Types.ObjectId | string; count: number }[],
): FacetCount[] =>
  rows
    .filter((r) => r._id != null)
    .map((r) => ({ value: String(r._id), count: r.count }));

// ── MongoDB provider (MVP) ───────────────────────────────────────────────────

export const mongoSearchProvider: SearchProvider = {
  async searchClinics(params: ClinicSearchParams): Promise<ClinicSearchResult> {
    await dbConnect();

    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE)),
    );
    const query = params.query?.trim();
    const hasQuery = Boolean(query);
    const sort = params.sort ?? "recommended";

    const [treatmentIds, conditionIds, cellSourceIds] = await Promise.all([
      resolveIds(Treatment, params.treatments),
      resolveIds(Condition, params.conditions),
      resolveIds(CellSource, params.cellSources),
    ]);

    // Always-on constraints — every facet count reflects these.
    const baseMatch: Record<string, unknown> = params.includeUnpublished
      ? {}
      : { status: "published", isDeleted: false };
    if (query) baseMatch.$text = { $search: query };
    if (params.minRating) baseMatch.ratingAvg = { $gte: params.minRating };
    if (params.priceMin != null || params.priceMax != null) {
      const lo = params.priceMin ?? 0;
      const hi = params.priceMax ?? Number.MAX_SAFE_INTEGER;
      // True range overlap; clinics with no price set are excluded when a price
      // bound is active (both $ifNull branches resolve to null → comparisons fail).
      baseMatch.$expr = {
        $and: [
          { $lte: [{ $ifNull: ["$priceMin", "$priceMax"] }, hi] },
          { $gte: [{ $ifNull: ["$priceMax", "$priceMin"] }, lo] },
        ],
      };
    }

    // Faceted selections — each keyed by dimension so a facet can exclude its own.
    const sel: Record<string, Record<string, unknown>> = {};
    if (treatmentIds.length)
      sel.treatments = { treatmentTypes: { $in: treatmentIds } };
    if (conditionIds.length)
      sel.conditions = { conditionsTreated: { $in: conditionIds } };
    if (cellSourceIds.length)
      sel.cellSources = { cellSources: { $in: cellSourceIds } };
    if (params.languages?.length)
      sel.languages = { languages: { $in: params.languages } };
    if (params.country || params.city) {
      const loc: Record<string, unknown> = {};
      if (params.city)
        loc.city = new RegExp(`^${escapeRegex(params.city)}$`, "i");
      if (params.country)
        loc.$or = [
          { country: new RegExp(`^${escapeRegex(params.country)}$`, "i") },
          { countryCode: params.country.toUpperCase() },
        ];
      sel.location = { locations: { $elemMatch: loc } };
    }
    if (params.verifiedOnly) sel.verified = { "verification.isVerified": true };

    const mergeExcept = (dim?: string): Record<string, unknown> =>
      Object.assign(
        {},
        ...Object.entries(sel)
          .filter(([k]) => k !== dim)
          .map(([, v]) => v),
      );
    const fullSelection = mergeExcept();

    const pipeline = [
      { $match: baseMatch },
      ...(hasQuery ? [{ $addFields: { _score: { $meta: "textScore" } } }] : []),
      {
        $facet: {
          results: [
            { $match: fullSelection },
            { $addFields: listingRankAddFields() },
            { $sort: sortSpec(sort, hasQuery) },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            { $project: RESULT_PROJECTION },
          ],
          totalCount: [{ $match: fullSelection }, { $count: "n" }],
          fTreatments: [
            { $match: mergeExcept("treatments") },
            { $unwind: "$treatmentTypes" },
            { $group: { _id: "$treatmentTypes", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          fConditions: [
            { $match: mergeExcept("conditions") },
            { $unwind: "$conditionsTreated" },
            { $group: { _id: "$conditionsTreated", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          fCellSources: [
            { $match: mergeExcept("cellSources") },
            { $unwind: "$cellSources" },
            { $group: { _id: "$cellSources", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          fCountries: [
            { $match: mergeExcept("location") },
            // De-dup countries within a clinic so multi-site clinics count once.
            {
              $project: {
                c: { $setUnion: [{ $ifNull: ["$locations.country", []] }, []] },
              },
            },
            { $unwind: "$c" },
            { $group: { _id: "$c", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          fLanguages: [
            { $match: mergeExcept("languages") },
            { $unwind: "$languages" },
            { $group: { _id: "$languages", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          fVerified: [
            { $match: mergeExcept("verified") },
            { $match: { "verification.isVerified": true } },
            { $count: "n" },
          ],
        },
      },
    ] as unknown as PipelineStage[];

    const [agg] = await Clinic.aggregate<SearchAggResult>(pipeline).option({
      allowDiskUse: true,
    });

    const total = agg?.totalCount?.[0]?.n ?? 0;
    return {
      clinics: agg?.results ?? [],
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      facets: {
        treatments: toFacet(agg?.fTreatments ?? []),
        conditions: toFacet(agg?.fConditions ?? []),
        cellSources: toFacet(agg?.fCellSources ?? []),
        countries: toFacet(agg?.fCountries ?? []),
        languages: toFacet(agg?.fLanguages ?? []),
        verified: agg?.fVerified?.[0]?.n ?? 0,
      },
    };
  },

  async suggest(query: string, limit = 5): Promise<Suggestion[]> {
    const q = query.trim();
    if (!q) return [];
    await dbConnect();
    const rx = new RegExp(escapeRegex(q), "i");

    const [clinics, treatments, conditions] = await Promise.all([
      Clinic.find({ status: "published", isDeleted: false, name: rx })
        .select("name slug")
        .limit(limit)
        .lean(),
      Treatment.find({ isActive: true, name: rx })
        .select("name slug")
        .limit(limit)
        .lean(),
      Condition.find({ isActive: true, name: rx })
        .select("name slug")
        .limit(limit)
        .lean(),
    ]);

    return [
      ...clinics.map((c) => ({
        type: "clinic" as const,
        label: c.name,
        slug: c.slug,
      })),
      ...treatments.map((t) => ({
        type: "treatment" as const,
        label: t.name,
        slug: t.slug,
      })),
      ...conditions.map((c) => ({
        type: "condition" as const,
        label: c.name,
        slug: c.slug,
      })),
    ];
  },
};

/**
 * The active search provider. Swap this single binding to migrate the whole app
 * to Atlas Search / Meilisearch / Algolia in Phase 2 (PRD §10).
 */
export const searchProvider: SearchProvider = mongoSearchProvider;

export const searchClinics = (
  params: ClinicSearchParams,
): Promise<ClinicSearchResult> => searchProvider.searchClinics(params);

export const suggestClinics = (
  query: string,
  limit?: number,
): Promise<Suggestion[]> => searchProvider.suggest(query, limit);

// ── URL ↔ params (so the directory page can hydrate from the query string) ────

/** Split a repeatable/comma-joined query value into a clean string list. */
function listParam(value: string | string[] | undefined | null): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : value.split(",");
  return raw.map((s) => s.trim()).filter(Boolean);
}

const numberParam = z.coerce.number().finite().optional().catch(undefined);

/**
 * Coerce Next.js `searchParams` (or a `URLSearchParams`) into typed, validated
 * {@link ClinicSearchParams}. Unknown/garbage values fall back to safe defaults
 * so a hand-edited URL never throws.
 */
export function parseClinicSearchParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): ClinicSearchParams {
  const get = (key: string): string | string[] | undefined =>
    input instanceof URLSearchParams
      ? input.getAll(key).length > 1
        ? input.getAll(key)
        : (input.get(key) ?? undefined)
      : input[key];

  const sortRaw = Array.isArray(get("sort")) ? get("sort")![0] : get("sort");
  const sort = (CLINIC_SORTS as readonly string[]).includes(sortRaw as string)
    ? (sortRaw as ClinicSort)
    : undefined;

  const single = (key: string): string | undefined => {
    const v = get(key);
    const s = Array.isArray(v) ? v[0] : v;
    return s?.trim() || undefined;
  };

  return {
    query: single("q") ?? single("query"),
    treatments: listParam(get("treatment") ?? get("treatments")),
    conditions: listParam(get("condition") ?? get("conditions")),
    cellSources: listParam(get("cellSource") ?? get("cellSources")),
    country: single("country"),
    city: single("city"),
    languages: listParam(get("language") ?? get("languages")),
    priceMin: numberParam.parse(single("priceMin")),
    priceMax: numberParam.parse(single("priceMax")),
    verifiedOnly: single("verified") === "1" || single("verified") === "true",
    minRating: numberParam.parse(single("minRating")),
    sort,
    page: numberParam.parse(single("page")),
    pageSize: numberParam.parse(single("pageSize")),
  };
}
