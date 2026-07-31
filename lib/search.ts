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
import { formatLocation } from "@/lib/format";
import { LISTING_SORT, listingRankAddFields } from "@/lib/ranking";
import { CellSource, Clinic, Condition, Location, Treatment } from "@/models";
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
  /**
   * Matches `locations.region` — state/province (case-insensitive). Pinned by a
   * route (a `/clinics/{state}` landing page); deliberately not parsed from the
   * query string, so it adds no new faceted-URL surface to crawl.
   */
  region?: string;
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

export const SUGGESTION_TYPES = [
  "clinic",
  "treatment",
  "condition",
  "location",
] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

/**
 * The directory filter a suggestion stands for. Lets a two-field search combine
 * a term with a place ("MSC therapy" + "Mexico" → one filtered `/clinics` URL)
 * instead of dropping half of what the visitor typed.
 */
export interface SuggestionFilter {
  key: "treatment" | "condition" | "country" | "city";
  value: string;
}

export interface Suggestion {
  type: SuggestionType;
  label: string;
  slug: string;
  /**
   * Ready-made destination. Resolved server-side because a city's URL needs its
   * parent country (`/locations/mexico/cancun`), which the client can't derive
   * from the slug alone.
   */
  href: string;
  /** Second line: a clinic's city, or "12 clinics" for a term. */
  sublabel?: string;
  /** Published clinics behind the term (omitted for clinics). */
  count?: number;
  /** Emoji flag, for country suggestions that have one. */
  flag?: string;
  filter?: SuggestionFilter;
}

export interface SuggestOptions {
  /** Max suggestions returned overall (not per type). */
  limit?: number;
  /** Restrict to certain kinds — e.g. only places for a location field. */
  types?: readonly SuggestionType[];
}

export interface SearchProvider {
  searchClinics(params: ClinicSearchParams): Promise<ClinicSearchResult>;
  /** Header typeahead across clinics + taxonomy (PRD §6.6). */
  suggest(query: string, opts?: SuggestOptions): Promise<Suggestion[]>;
}

// ── Defaults / helpers ───────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/** Escape a user string for safe use inside a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Base letter → every accented form that must match it. */
const DIACRITIC_FORMS: Record<string, string> = {
  a: "aàáâãäåāăą",
  c: "cçćĉċč",
  d: "dďđ",
  e: "eèéêëēĕėęě",
  g: "gĝğġģ",
  i: "iìíîïĩīĭįı",
  l: "lĺļľłŀ",
  n: "nñńņň",
  o: "oòóôõöøōŏő",
  r: "rŕŗř",
  s: "sśŝşš",
  t: "tţťŧ",
  u: "uùúûüũūŭůűų",
  y: "yýÿŷ",
  z: "zźżž",
};

/**
 * Anchored, case- AND accent-insensitive equality regex for a place name.
 *
 * Place names reach us from two sides that spell accents inconsistently: the
 * Location taxonomy stores the correct form ("Cancún", "Bogotá") while a clinic
 * record imported from the clinic's own site usually stores the ASCII one
 * ("Cancun"). A plain `^…$/i` regex therefore matched nothing, so
 * `/locations/mexico/cancun` listed zero clinics despite having one — an empty
 * directory page, which is exactly what Google files as a **Soft 404**.
 *
 * Folds the pattern to base letters, then expands each back into a character
 * class covering its accented forms, so either spelling on either side matches.
 * Strictly widening: it can only add results, never drop them.
 */
function placeNameRegex(value: string): RegExp {
  return new RegExp(`^${diacriticPattern(value)}$`, "i");
}

/** Strip accents and lowercase, so the two spellings of "Cancun" compare equal. */
export function foldForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Regex source that matches `value` ignoring case and accents (see above). */
function diacriticPattern(value: string): string {
  const folded = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // `escapeRegex` only escapes non-letters, so no letter here follows a
  // backslash and this substitution can't corrupt an escape sequence.
  return escapeRegex(folded).replace(/[a-z]/gi, (ch) => {
    const forms = DIACRITIC_FORMS[ch.toLowerCase()];
    return forms ? `[${forms}]` : ch;
  });
}

/** Unanchored accent-insensitive *contains* regex \u2014 the typeahead's candidate filter. */
function containsNameRegex(value: string): RegExp {
  return new RegExp(diacriticPattern(value), "i");
}

// \u2500\u2500 Typeahead ranking \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** Hard ceiling on suggestions per request, whatever the caller asks for. */
export const MAX_SUGGESTIONS = 12;

/**
 * Per-type slots in one menu. Without these, a query like "stem" that matches
 * thirty clinic names returns thirty clinics and hides the treatment page the
 * visitor actually wanted.
 */
const TYPE_CAP: Record<SuggestionType, number> = {
  clinic: 4,
  treatment: 3,
  condition: 3,
  location: 3,
};

/**
 * How well `label` answers `query`, highest first.
 *
 * Mongo's regex only tells us *that* a row matched, not *where* \u2014 so an exact
 * hit ranked below an incidental mid-word one ("Cell" matching "Excellence
 * Medical" above "Cell therapy"). Position decides the tier; popularity only
 * breaks ties within it, so a well-reviewed clinic can never outrank a
 * better-matching term.
 */
function relevance(query: string, label: string, popularity = 0): number {
  const q = foldForMatch(query.trim());
  const name = foldForMatch(label);

  let tier = 10; // matched somewhere in the middle of a word
  if (name === q) tier = 100;
  else if (name.startsWith(q)) tier = 70;
  else if (new RegExp(`\\b${escapeRegex(q)}`).test(name)) tier = 40;

  // Shorter labels are the more precise match for the same tier ("MSC therapy"
  // over "MSC therapy for knee osteoarthritis").
  const brevity = Math.max(0, 6 - name.length / 12);
  return tier * 100 + Math.min(popularity, 60) + brevity;
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
    if (params.country || params.city || params.region) {
      const loc: Record<string, unknown> = {};
      if (params.city) loc.city = placeNameRegex(params.city);
      if (params.region) loc.region = placeNameRegex(params.region);
      if (params.country)
        loc.$or = [
          { country: placeNameRegex(params.country) },
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

  async suggest(
    query: string,
    opts: SuggestOptions = {},
  ): Promise<Suggestion[]> {
    const q = query.trim();
    if (!q) return [];

    const limit = Math.min(Math.max(opts.limit ?? 8, 1), MAX_SUGGESTIONS);
    const wants = (type: SuggestionType): boolean =>
      !opts.types?.length || opts.types.includes(type);

    await dbConnect();
    // Accent-insensitive so "cancun" finds "Cancún" and "sao paulo" finds
    // "São Paulo" — the old plain-substring regex missed both.
    const rx = containsNameRegex(q);
    // Over-fetch per collection: the pool is re-ranked in JS below, so the DB's
    // arbitrary order can't decide which few rows survive.
    const pool = limit * 2;

    const [clinics, treatments, conditions, places] = await Promise.all([
      wants("clinic")
        ? Clinic.find({ status: "published", isDeleted: false, name: rx })
            .select("name slug locations reviewCount ratingAvg")
            .sort({ sortScore: -1 })
            .limit(pool)
            .lean()
        : [],
      wants("treatment")
        ? Treatment.find({ isActive: true, name: rx })
            .select("name slug clinicCount")
            .limit(pool)
            .lean()
        : [],
      wants("condition")
        ? Condition.find({ isActive: true, name: rx })
            .select("name slug clinicCount")
            .limit(pool)
            .lean()
        : [],
      wants("location")
        ? Location.find({ isActive: true, name: rx })
            .select("name slug clinicCount kind parentId flag")
            .limit(pool)
            .lean()
        : [],
    ]);

    // A city's URL lives under its country (`/locations/mexico/cancun`), so
    // resolve the parents in one extra query rather than one per row.
    const parentIds = places
      .filter((p) => p.kind === "city" && p.parentId)
      .map((p) => p.parentId as Types.ObjectId);
    const countrySlugs = new Map<string, string>();
    if (parentIds.length) {
      const parents = await Location.find({ _id: { $in: parentIds } })
        .select("slug")
        .lean();
      for (const p of parents)
        countrySlugs.set(String(p._id), p.slug as string);
    }

    /** `popularity` only feeds ranking; it is stripped before returning. */
    type Candidate = Suggestion & { popularity: number };

    const candidates: Candidate[] = [
      ...clinics.map((c): Candidate => {
        const hq = c.locations?.find((l) => l.isHQ) ?? c.locations?.[0];
        return {
          type: "clinic" as const,
          label: c.name,
          slug: c.slug,
          href: `/clinic/${c.slug}`,
          sublabel:
            formatLocation({ city: hq?.city, country: hq?.country }) ||
            undefined,
          // Reviewed clinics break ties ahead of empty listings.
          popularity: c.reviewCount ?? 0,
        };
      }),
      ...treatments.map((t): Candidate => ({
        type: "treatment",
        label: t.name,
        slug: t.slug,
        href: `/treatments/${t.slug}`,
        count: t.clinicCount ?? 0,
        filter: { key: "treatment", value: t.slug },
        popularity: t.clinicCount ?? 0,
      })),
      ...conditions.map((c): Candidate => ({
        type: "condition",
        label: c.name,
        slug: c.slug,
        href: `/conditions/${c.slug}`,
        count: c.clinicCount ?? 0,
        filter: { key: "condition", value: c.slug },
        popularity: c.clinicCount ?? 0,
      })),
      ...places.map((p): Candidate => {
        const isCity = p.kind === "city";
        const parentSlug = p.parentId
          ? countrySlugs.get(String(p.parentId))
          : undefined;
        return {
          type: "location",
          label: p.name,
          flag: p.flag || undefined,
          slug: p.slug,
          // An orphaned city has no country page to link to; send it to the
          // filtered directory instead of a URL that would 404.
          href:
            isCity && parentSlug
              ? `/locations/${parentSlug}/${p.slug}`
              : isCity
                ? `/clinics?city=${encodeURIComponent(p.name)}`
                : `/locations/${p.slug}`,
          count: p.clinicCount ?? 0,
          // Filter by NAME, not slug: the directory matches these against
          // `locations.city` / `locations.country` strings on the clinic.
          filter: { key: isCity ? "city" : "country", value: p.name },
          popularity: p.clinicCount ?? 0,
        };
      }),
    ];

    // Rank globally, then cap each type so one crowded group can't fill the menu.
    const ranked = candidates
      .map((s) => ({ s, score: relevance(q, s.label, s.popularity) }))
      .sort((a, b) => b.score - a.score || a.s.label.localeCompare(b.s.label));

    const taken: Record<SuggestionType, number> = {
      clinic: 0,
      treatment: 0,
      condition: 0,
      location: 0,
    };
    const out: Suggestion[] = [];
    for (const { s } of ranked) {
      if (out.length >= limit) break;
      if (taken[s.type] >= TYPE_CAP[s.type]) continue;
      taken[s.type] += 1;
      // `popularity` was only ever a ranking input; it does not belong on the
      // wire.
      const suggestion: Suggestion = { ...s };
      delete (suggestion as Partial<Candidate>).popularity;
      out.push(suggestion);
    }
    return out;
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
  opts?: SuggestOptions,
): Promise<Suggestion[]> => searchProvider.suggest(query, opts);

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
