/**
 * Public data-access layer — Stage 5.
 *
 * Server-only read helpers that the public pages (homepage, directory, profile,
 * resources, …) call. Keeps the Mongoose/aggregation details out of the page
 * components and returns plain, serializable view models (no Mongoose docs cross
 * the server/client boundary). Pairs with `lib/search.ts` (faceted directory
 * query) and `lib/seo.ts` (metadata/JSON-LD).
 *
 * Stable reference data (taxonomy, languages) is wrapped in `unstable_cache` so
 * it's cached across requests — see {@link getTreatments} et al.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { Types } from "mongoose";

import { dbConnect } from "@/lib/db";
import { formatLocation } from "@/lib/format";
import { compareClinicsForListing } from "@/lib/ranking";
import {
  searchClinics,
  type ClinicListItem,
  type ClinicSearchParams,
  type ClinicSearchResult,
  type FacetCount,
} from "@/lib/search";
import type { ClinicCardData } from "@/components/clinic/clinic-card";
import {
  Accreditation,
  Article,
  CellSource,
  Clinic,
  Condition,
  Lead,
  Location,
  Plan,
  Review,
  SiteSetting,
  Treatment,
  User,
  type IArticle,
  type IClinic,
  type IPlan,
  type IReview,
  type ISeo,
  type ITaxonomyBase,
} from "@/models";

// ── Small serialization helpers ──────────────────────────────────────────────

const id = (v: unknown): string => String(v);

/** A lightweight, serializable taxonomy term for grids, chips, and filters. */
export interface TaxonomyTerm {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  /** Long-form admin-editable SEO intro for the term's directory page (§8.5). */
  description?: string;
  /** Per-term SEO overrides (metaTitle/metaDescription/ogImage/canonical/noindex). */
  seo?: ISeo | null;
  icon?: string;
  category?: string;
  clinicCount: number;
}

export interface CountryTerm extends TaxonomyTerm {
  countryCode?: string;
  flag?: string;
}

function toTerm(doc: ITaxonomyBase & { category?: string }): TaxonomyTerm {
  return {
    id: id(doc._id),
    name: doc.name,
    slug: doc.slug,
    shortDescription: doc.shortDescription,
    description: doc.description,
    seo: doc.seo ? { ...doc.seo } : null,
    icon: doc.icon,
    category: doc.category,
    clinicCount: doc.clinicCount ?? 0,
  };
}

// ── Taxonomy (cached cross-request) ──────────────────────────────────────────
// Taxonomy + language lists are stable reference data read on many pages,
// including the *dynamic* directory routes (URL-driven facets). `unstable_cache`
// caches them across requests with a 1-hour revalidate so those dynamic renders
// don't re-query Mongo every time (Stage 9.5 "cached taxonomy" / PRD §13). The
// shared `taxonomy` tag lets admin taxonomy mutations bust the cache on demand
// via `revalidateTag("taxonomy")`; the time bound is the safety net.
export const TAXONOMY_CACHE_TAG = "taxonomy";
const TAXONOMY_REVALIDATE_SECONDS = 3600;

function cachedTaxonomy<T>(key: string, fn: () => Promise<T>): () => Promise<T> {
  return unstable_cache(fn, [`public-taxonomy:${key}`], {
    revalidate: TAXONOMY_REVALIDATE_SECONDS,
    tags: [TAXONOMY_CACHE_TAG],
  });
}

export const getTreatments = cachedTaxonomy(
  "treatments",
  async (): Promise<TaxonomyTerm[]> => {
    await dbConnect();
    const docs = await Treatment.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .lean();
    return docs.map((d) => toTerm(d as unknown as ITaxonomyBase));
  },
);

export const getConditions = cachedTaxonomy(
  "conditions",
  async (): Promise<TaxonomyTerm[]> => {
    await dbConnect();
    const docs = await Condition.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .lean();
    return docs.map((d) => toTerm(d as unknown as ITaxonomyBase));
  },
);

export const getCellSources = cachedTaxonomy(
  "cell-sources",
  async (): Promise<TaxonomyTerm[]> => {
    await dbConnect();
    const docs = await CellSource.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .lean();
    return docs.map((d) => toTerm(d as unknown as ITaxonomyBase));
  },
);

export const getAccreditations = cachedTaxonomy(
  "accreditations",
  async (): Promise<TaxonomyTerm[]> => {
    await dbConnect();
    const docs = await Accreditation.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .lean();
    return docs.map((d) => toTerm(d as unknown as ITaxonomyBase));
  },
);

export const getCountries = cachedTaxonomy(
  "countries",
  async (): Promise<CountryTerm[]> => {
    await dbConnect();
    const docs = await Location.find({ kind: "country", isActive: true })
      .sort({ order: 1, name: 1 })
      .lean();
    return docs.map((d) => ({
      ...toTerm(d as unknown as ITaxonomyBase),
      countryCode: d.countryCode,
      flag: d.flag,
    }));
  },
);

/** Spoken languages present on published clinics (for the directory filter). */
export const getClinicLanguages = cachedTaxonomy(
  "clinic-languages",
  async (): Promise<string[]> => {
    await dbConnect();
    const langs = await Clinic.distinct("languages", {
      status: "published",
      isDeleted: false,
    });
    return (langs as string[])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  },
);

/** A single taxonomy term by slug (for directory landing pages). */
export async function getTaxonomyTermBySlug(
  kind: "treatment" | "condition",
  slug: string,
): Promise<TaxonomyTerm | null> {
  await dbConnect();
  const model = kind === "treatment" ? Treatment : Condition;
  const doc = await model.findOne({ slug, isActive: true }).lean();
  return doc ? toTerm(doc as unknown as ITaxonomyBase) : null;
}

export async function getCountryBySlug(
  slug: string,
): Promise<CountryTerm | null> {
  await dbConnect();
  const doc = await Location.findOne({
    kind: "country",
    slug,
    isActive: true,
  }).lean();
  if (!doc) return null;
  return {
    ...toTerm(doc as unknown as ITaxonomyBase),
    countryCode: doc.countryCode,
    flag: doc.flag,
  };
}

export async function getCityBySlug(
  slug: string,
): Promise<(TaxonomyTerm & { region?: string; countryCode?: string }) | null> {
  await dbConnect();
  const doc = await Location.findOne({
    kind: "city",
    slug,
    isActive: true,
  }).lean();
  if (!doc) return null;
  return {
    ...toTerm(doc as unknown as ITaxonomyBase),
    region: doc.region,
    countryCode: doc.countryCode,
  };
}

// ── Clinic card mapping ──────────────────────────────────────────────────────

/** "City, Country (+N)" headline location from a clinic's locations array. */
function locationLabel(locations: IClinic["locations"]): string | undefined {
  if (!locations?.length) return undefined;
  const hq = locations.find((l) => l.isHQ) ?? locations[0]!;
  const base = formatLocation({ city: hq.city, country: hq.country });
  if (!base) return undefined;
  return locations.length > 1 ? `${base} +${locations.length - 1}` : base;
}

/** Resolve a clinic's serviceFocus into "55% MSC therapy · 25% Exosomes". */
function focusLabel(
  serviceFocus: IClinic["serviceFocus"],
  names: Map<string, string>,
): string | undefined {
  if (!serviceFocus?.length) return undefined;
  const parts = [...serviceFocus]
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3)
    .map((f) => {
      const name = names.get(id(f.treatmentId));
      return name ? `${f.percent}% ${name}` : null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

/**
 * Fetch display names for every treatment/condition referenced by a set of
 * clinics in two queries, so cards can render chips + focus labels.
 */
async function loadClinicLabels(clinics: ClinicListItem[]): Promise<{
  treatments: Map<string, string>;
  conditions: Map<string, string>;
}> {
  const treatmentIds = new Set<string>();
  const conditionIds = new Set<string>();
  for (const c of clinics) {
    for (const t of c.treatmentTypes ?? []) treatmentIds.add(id(t));
    for (const f of c.serviceFocus ?? []) treatmentIds.add(id(f.treatmentId));
    for (const cond of c.conditionsTreated ?? []) conditionIds.add(id(cond));
  }
  const [treatments, conditions] = await Promise.all([
    treatmentIds.size
      ? Treatment.find({ _id: { $in: [...treatmentIds] } })
          .select("name")
          .lean()
      : Promise.resolve([]),
    conditionIds.size
      ? Condition.find({ _id: { $in: [...conditionIds] } })
          .select("name")
          .lean()
      : Promise.resolve([]),
  ]);
  return {
    treatments: new Map(treatments.map((t) => [id(t._id), t.name])),
    conditions: new Map(conditions.map((c) => [id(c._id), c.name])),
  };
}

function toClinicCard(
  item: ClinicListItem,
  labels: { treatments: Map<string, string>; conditions: Map<string, string> },
): ClinicCardData {
  const clinicId = id(item._id);
  const badge = item.verification?.isVerified
    ? (item.verification.badge ?? "verified")
    : null;
  const chips = (item.conditionsTreated ?? [])
    .map((c) => labels.conditions.get(id(c)))
    .filter((v): v is string => Boolean(v))
    .slice(0, 3);

  return {
    slug: item.slug,
    name: item.name,
    location: locationLabel(item.locations),
    logoUrl: item.logo?.url,
    badge,
    featured: item.tier === "featured",
    ratingAvg: item.ratingAvg ?? 0,
    reviewCount: item.reviewCount ?? 0,
    chips,
    focusLabel: focusLabel(item.serviceFocus, labels.treatments),
    priceMin: item.priceMin ?? null,
    currency: item.currency,
    priceModel: item.priceModel,
    websiteHref: item.website ? `/r/${clinicId}` : undefined,
  };
}

/** Map a result page of clinics to card view models (resolves chip/focus labels). */
export async function toClinicCards(
  clinics: ClinicListItem[],
): Promise<ClinicCardData[]> {
  if (!clinics.length) return [];
  const labels = await loadClinicLabels(clinics);
  return clinics.map((c) => toClinicCard(c, labels));
}

// ── Directory (faceted search → labeled facets + cards) ──────────────────────

export interface FacetOption {
  value: string;
  label: string;
  slug: string;
  count: number;
}

export interface DirectoryFacets {
  treatments: FacetOption[];
  conditions: FacetOption[];
  cellSources: FacetOption[];
  countries: FacetOption[];
  languages: FacetOption[];
  verified: number;
}

export interface DirectoryData {
  cards: ClinicCardData[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  facets: DirectoryFacets;
  /** slug → display label for the active-filter chips. */
  filterLabels: Record<string, string>;
}

/** Resolve id-keyed facet counts to labelled options via a term list. */
function labelFacets(
  counts: FacetCount[],
  terms: TaxonomyTerm[],
): FacetOption[] {
  const byId = new Map(terms.map((t) => [t.id, t]));
  return counts
    .map((c) => {
      const term = byId.get(c.value);
      if (!term) return null;
      return {
        value: term.slug,
        label: term.name,
        slug: term.slug,
        count: c.count,
      };
    })
    .filter((v): v is FacetOption => v != null);
}

/**
 * Country facets keyed by country **name** (what `searchClinics` matches on the
 * single `country` param), labelled for display, with the slug for any links.
 */
function labelCountryFacets(
  counts: FacetCount[],
  countries: CountryTerm[],
): FacetOption[] {
  const byName = new Map(countries.map((c) => [c.name.toLowerCase(), c]));
  return counts.map((c) => {
    const country = byName.get(c.value.toLowerCase());
    return {
      value: c.value,
      label: c.value,
      slug: country?.slug ?? "",
      count: c.count,
    };
  });
}

/**
 * Run the faceted directory search and shape it for the directory UI: card view
 * models + facet options labelled from the taxonomy collections.
 */
export async function getDirectoryData(
  params: ClinicSearchParams,
): Promise<DirectoryData> {
  const [result, treatments, conditions, cellSources, countries]: [
    ClinicSearchResult,
    TaxonomyTerm[],
    TaxonomyTerm[],
    TaxonomyTerm[],
    CountryTerm[],
  ] = await Promise.all([
    searchClinics(params),
    getTreatments(),
    getConditions(),
    getCellSources(),
    getCountries(),
  ]);

  const cards = await toClinicCards(result.clinics);

  const filterLabels: Record<string, string> = {};
  for (const t of [...treatments, ...conditions, ...cellSources, ...countries]) {
    filterLabels[t.slug] = t.name;
  }
  for (const f of result.facets.languages) filterLabels[f.value] = f.value;

  return {
    cards,
    total: result.total,
    page: result.page,
    pageCount: result.pageCount,
    pageSize: result.pageSize,
    filterLabels,
    facets: {
      treatments: labelFacets(result.facets.treatments, treatments),
      conditions: labelFacets(result.facets.conditions, conditions),
      cellSources: labelFacets(result.facets.cellSources, cellSources),
      countries: labelCountryFacets(result.facets.countries, countries),
      languages: result.facets.languages.map((f) => ({
        value: f.value,
        label: f.value,
        slug: f.value,
        count: f.count,
      })),
      verified: result.facets.verified,
    },
  };
}

// ── Clinic profile ───────────────────────────────────────────────────────────

export interface ProfilePerson {
  name: string;
  title?: string;
  credentials?: string;
  bio?: string;
  photoUrl?: string;
}

export interface ProfileLocation {
  isHQ: boolean;
  addressLine?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

export interface ClinicProfile {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  coverAlt?: string;
  gallery: { url: string; alt?: string }[];
  videoUrl?: string;
  badge: "verified" | "premier" | null;
  isVerified: boolean;
  verificationMethod?: string;
  verifiedAt?: string | null;
  featured: boolean;
  foundedYear?: number;
  teamSize?: string;
  physiciansCount?: number;
  languages: string[];
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  priceModel?: string;
  priceNote?: string;
  website?: string;
  social: Record<string, string | undefined>;
  ratingAvg: number;
  reviewCount: number;
  ratingBreakdown: IClinic["ratingBreakdown"];
  topMentions: { tag: string; count: number }[];
  treatments: TaxonomyTerm[];
  conditions: TaxonomyTerm[];
  cellSources: TaxonomyTerm[];
  accreditations: (TaxonomyTerm & { issuingBody?: string })[];
  serviceFocus: { name: string; percent: number }[];
  medicalDirector?: ProfilePerson;
  team: ProfilePerson[];
  locations: ProfileLocation[];
  caseStudies: {
    title: string;
    conditionName?: string;
    summary?: string;
    outcome?: string;
    isAnonymized: boolean;
    images: { url: string; alt?: string }[];
  }[];
  faqs: { question: string; answer: string }[];
  highlights: string[];
  /** Raw clinic for SEO JSON-LD builders (lean). */
  raw: IClinic;
}

type PopulatedRef = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  category?: string;
} & Partial<ITaxonomyBase>;

function person(p: IClinic["medicalDirector"]): ProfilePerson | undefined {
  if (!p?.name) return undefined;
  return {
    name: p.name,
    title: p.title,
    credentials: p.credentials,
    bio: p.bio,
    photoUrl: p.photo?.url,
  };
}

/** Load a published clinic profile by slug, with taxonomy refs resolved. */
export async function getClinicProfile(
  slug: string,
): Promise<ClinicProfile | null> {
  await dbConnect();
  const doc = await Clinic.findOne({
    slug,
    status: "published",
    isDeleted: false,
  })
    .populate("treatmentTypes", "name slug shortDescription category clinicCount")
    .populate("conditionsTreated", "name slug category clinicCount")
    .populate("cellSources", "name slug shortDescription")
    .populate("accreditations", "name slug issuingBody shortDescription")
    .populate("serviceFocus.treatmentId", "name slug")
    .populate("caseStudies.conditionId", "name slug")
    .lean<IClinic>();

  if (!doc) return null;

  const termOf = (r: PopulatedRef): TaxonomyTerm => ({
    id: id(r._id),
    name: r.name,
    slug: r.slug,
    shortDescription: r.shortDescription,
    category: r.category,
    clinicCount: r.clinicCount ?? 0,
  });

  const treatmentRefs = (doc.treatmentTypes ?? []) as unknown as PopulatedRef[];
  const conditionRefs = (doc.conditionsTreated ?? []) as unknown as PopulatedRef[];
  const cellSourceRefs = (doc.cellSources ?? []) as unknown as PopulatedRef[];
  const accreditationRefs = (doc.accreditations ?? []) as unknown as (PopulatedRef & {
    issuingBody?: string;
  })[];

  return {
    id: id(doc._id),
    slug: doc.slug,
    name: doc.name,
    tagline: doc.tagline,
    description: doc.description,
    logoUrl: doc.logo?.url,
    coverUrl: doc.coverImage?.url,
    coverAlt: doc.coverImage?.alt,
    gallery: (doc.gallery ?? []).map((g) => ({ url: g.url, alt: g.alt })),
    videoUrl: doc.videoUrl,
    badge: doc.verification?.isVerified
      ? (doc.verification.badge ?? "verified")
      : null,
    isVerified: Boolean(doc.verification?.isVerified),
    verificationMethod: doc.verification?.method,
    verifiedAt: doc.verification?.verifiedAt
      ? new Date(doc.verification.verifiedAt).toISOString()
      : null,
    featured: doc.tier === "featured",
    foundedYear: doc.foundedYear,
    teamSize: doc.teamSize,
    physiciansCount: doc.physiciansCount,
    languages: doc.languages ?? [],
    priceMin: doc.priceMin,
    priceMax: doc.priceMax,
    currency: doc.currency,
    priceModel: doc.priceModel,
    priceNote: doc.priceNote,
    website: doc.website,
    social: { ...doc.social },
    ratingAvg: doc.ratingAvg ?? 0,
    reviewCount: doc.reviewCount ?? 0,
    ratingBreakdown: doc.ratingBreakdown,
    topMentions: doc.topMentions ?? [],
    treatments: treatmentRefs.map(termOf),
    conditions: conditionRefs.map(termOf),
    cellSources: cellSourceRefs.map(termOf),
    accreditations: accreditationRefs.map((r) => ({
      ...termOf(r),
      issuingBody: r.issuingBody,
    })),
    serviceFocus: (doc.serviceFocus ?? [])
      .map((f) => {
        const ref = f.treatmentId as unknown as PopulatedRef | null;
        return ref?.name ? { name: ref.name, percent: f.percent } : null;
      })
      .filter((v): v is { name: string; percent: number } => v != null)
      .sort((a, b) => b.percent - a.percent),
    medicalDirector: person(doc.medicalDirector),
    team: (doc.team ?? [])
      .map(person)
      .filter((p): p is ProfilePerson => p != null),
    locations: (doc.locations ?? []).map((l) => ({
      isHQ: Boolean(l.isHQ),
      addressLine: l.addressLine,
      city: l.city,
      region: l.region,
      country: l.country,
      postalCode: l.postalCode,
      phone: l.phone,
      lat: l.lat,
      lng: l.lng,
    })),
    caseStudies: (doc.caseStudies ?? []).map((cs) => {
      const cond = cs.conditionId as unknown as PopulatedRef | null;
      return {
        title: cs.title,
        conditionName: cond?.name,
        summary: cs.summary,
        outcome: cs.outcome,
        isAnonymized: Boolean(cs.isAnonymized),
        images: (cs.images ?? []).map((im) => ({ url: im.url, alt: im.alt })),
      };
    }),
    faqs: (doc.faqs ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    highlights: doc.highlights ?? [],
    raw: doc,
  };
}

/** Slugs of every published clinic — for `generateStaticParams` / sitemap. */
export async function getPublishedClinicSlugs(): Promise<string[]> {
  await dbConnect();
  const docs = await Clinic.find({ status: "published", isDeleted: false })
    .select("slug")
    .lean();
  return docs.map((d) => d.slug);
}

/** Minimal clinic context for the review-submission form (Stage 5.5). */
export interface ReviewClinicOptions {
  id: string;
  name: string;
  slug: string;
  treatments: { id: string; name: string }[];
  conditions: { id: string; name: string }[];
}

export async function getReviewClinic(
  slug: string,
): Promise<ReviewClinicOptions | null> {
  await dbConnect();
  const doc = await Clinic.findOne({
    slug,
    status: "published",
    isDeleted: false,
  })
    .select("name slug")
    .populate("treatmentTypes", "name")
    .populate("conditionsTreated", "name")
    .lean<IClinic>();
  if (!doc) return null;

  const treatmentRefs = (doc.treatmentTypes ?? []) as unknown as PopulatedRef[];
  const conditionRefs = (doc.conditionsTreated ?? []) as unknown as PopulatedRef[];
  return {
    id: id(doc._id),
    name: doc.name,
    slug: doc.slug,
    treatments: treatmentRefs.map((r) => ({ id: id(r._id), name: r.name })),
    conditions: conditionRefs.map((r) => ({ id: id(r._id), name: r.name })),
  };
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export interface ReviewView {
  id: string;
  ratingOverall: number;
  ratings: IReview["ratings"];
  headline?: string;
  body: IReview["body"];
  isVerified: boolean;
  displayName: string;
  country?: string;
  treatmentName?: string;
  conditionName?: string;
  treatmentDate?: string;
  cost?: { range?: string; isConfidential: boolean };
  helpfulCount: number;
  wouldRecommend?: boolean;
  whyChosenTags: string[];
  createdAt: string;
  providerResponse?: { body: string; respondedAt?: string };
}

export type ReviewSortKey = "recent" | "highest" | "lowest" | "helpful";

const REVIEW_SORTS: Record<ReviewSortKey, Record<string, 1 | -1>> = {
  recent: { createdAt: -1 },
  highest: { ratingOverall: -1, createdAt: -1 },
  lowest: { ratingOverall: 1, createdAt: -1 },
  helpful: { helpfulCount: -1, createdAt: -1 },
};

export interface GetReviewsOptions {
  page?: number;
  pageSize?: number;
  sort?: ReviewSortKey;
  treatment?: string;
  condition?: string;
  minRating?: number;
}

export interface ReviewsResult {
  reviews: ReviewView[];
  total: number;
  page: number;
  pageCount: number;
}

/** Approved, non-deleted reviews for a clinic (filterable, sortable, paged). */
export async function getClinicReviews(
  clinicId: string,
  opts: GetReviewsOptions = {},
): Promise<ReviewsResult> {
  await dbConnect();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 8));
  const sort = REVIEW_SORTS[opts.sort ?? "recent"];

  const filter: Record<string, unknown> = {
    clinicId: new Types.ObjectId(clinicId),
    status: "approved",
    isDeleted: false,
  };
  if (opts.minRating) filter.ratingOverall = { $gte: opts.minRating };

  // Treatment/condition filters arrive as slugs → resolve to ids.
  if (opts.treatment) {
    const t = await Treatment.findOne({ slug: opts.treatment })
      .select("_id")
      .lean();
    if (t) filter.treatmentId = t._id;
  }
  if (opts.condition) {
    const c = await Condition.findOne({ slug: opts.condition })
      .select("_id")
      .lean();
    if (c) filter.conditionId = c._id;
  }

  const [docs, total] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("treatmentId", "name slug")
      .populate("conditionId", "name slug")
      .lean<IReview[]>(),
    Review.countDocuments(filter),
  ]);

  const reviews: ReviewView[] = docs.map((r) => {
    const treatment = r.treatmentId as unknown as PopulatedRef | null;
    const condition = r.conditionId as unknown as PopulatedRef | null;
    const anon = r.reviewer?.isAnonymous || !r.reviewer?.displayName;
    return {
      id: id(r._id),
      ratingOverall: r.ratingOverall,
      ratings: r.ratings,
      headline: r.headline,
      body: r.body,
      isVerified: Boolean(r.isVerified),
      displayName: anon ? "Verified Patient" : r.reviewer!.displayName!,
      country: r.reviewer?.country,
      treatmentName: treatment?.name,
      conditionName: condition?.name,
      treatmentDate: r.treatmentDate,
      cost: r.cost
        ? { range: r.cost.range, isConfidential: Boolean(r.cost.isConfidential) }
        : undefined,
      helpfulCount: r.helpfulCount ?? 0,
      wouldRecommend: r.wouldRecommend,
      whyChosenTags: r.whyChosenTags ?? [],
      createdAt: new Date(r.createdAt).toISOString(),
      providerResponse: r.providerResponse?.body
        ? {
            body: r.providerResponse.body,
            respondedAt: r.providerResponse.respondedAt
              ? new Date(r.providerResponse.respondedAt).toISOString()
              : undefined,
          }
        : undefined,
    };
  });

  return {
    reviews,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ── Related clinics ──────────────────────────────────────────────────────────

/** "Similar clinics" by shared treatments/conditions, then ranking order. */
export async function getRelatedClinics(
  clinic: Pick<IClinic, "_id" | "treatmentTypes" | "conditionsTreated">,
  limit = 3,
): Promise<ClinicCardData[]> {
  await dbConnect();
  const docs = await Clinic.find({
    _id: { $ne: clinic._id },
    status: "published",
    isDeleted: false,
    $or: [
      { treatmentTypes: { $in: clinic.treatmentTypes ?? [] } },
      { conditionsTreated: { $in: clinic.conditionsTreated ?? [] } },
    ],
  })
    .limit(limit * 3)
    .lean<IClinic[]>();

  const sorted = docs
    .sort(compareClinicsForListing)
    .slice(0, limit) as unknown as ClinicListItem[];
  return toClinicCards(sorted);
}

// ── Member shortlist (PRD §6.10 / §7) ────────────────────────────────────────

/** The member's saved-clinic slugs (seeds the client shortlist on login). */
export async function getUserShortlistSlugs(userId: string): Promise<string[]> {
  await dbConnect();
  const user = await User.findById(userId).select("shortlist").lean();
  if (!user?.shortlist?.length) return [];
  const clinics = await Clinic.find({
    _id: { $in: user.shortlist },
    isDeleted: false,
  })
    .select("slug")
    .lean();
  return clinics.map((c) => c.slug);
}

/** Card view models for a set of slugs, in the order given (for /shortlist). */
export async function getClinicsBySlugs(
  slugs: string[],
): Promise<ClinicCardData[]> {
  if (!slugs.length) return [];
  await dbConnect();
  const docs = await Clinic.find({
    slug: { $in: slugs },
    status: "published",
    isDeleted: false,
  }).lean<IClinic[]>();
  const cards = await toClinicCards(docs as unknown as ClinicListItem[]);
  const order = new Map(slugs.map((s, i) => [s, i]));
  return cards.sort(
    (a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0),
  );
}

// ── Homepage ─────────────────────────────────────────────────────────────────

export interface HomeData {
  hero: {
    headline: string;
    subhead: string;
    ctaPrimaryLabel: string;
    ctaSecondaryLabel: string;
  };
  popularSearches: { label: string; href: string }[];
  treatments: TaxonomyTerm[];
  conditions: TaxonomyTerm[];
  countries: CountryTerm[];
  featuredClinics: ClinicCardData[];
  testimonials: {
    quote: string;
    author?: string;
    role?: string;
    location?: string;
    rating?: number;
  }[];
  latestArticles: ArticleCardView[];
  stats: { clinics: number; verified: number; reviews: number };
}

const HERO_FALLBACK = {
  headline: "Find and trust regenerative-medicine clinics",
  subhead:
    "Compare accredited stem cell clinics worldwide by treatment, condition, location, and verified patient reviews.",
  ctaPrimaryLabel: "Find a clinic",
  ctaSecondaryLabel: "Browse all clinics",
};

const POPULAR_FALLBACK = [
  { label: "Knee osteoarthritis", href: "/conditions/knee-osteoarthritis" },
  { label: "MSC therapy", href: "/treatments/msc-therapy" },
  { label: "Anti-aging", href: "/conditions/anti-aging-longevity" },
  { label: "Clinics in Mexico", href: "/locations/mexico" },
];

/** Featured clinics: admin-curated IDs first, then top-ranked verified clinics. */
async function getFeaturedClinics(
  featuredIds: Types.ObjectId[],
  limit = 4,
): Promise<ClinicCardData[]> {
  await dbConnect();
  const base = { status: "published", isDeleted: false } as const;

  const curated = featuredIds?.length
    ? await Clinic.find({ ...base, _id: { $in: featuredIds } }).lean<IClinic[]>()
    : [];
  const curatedIds = new Set(curated.map((c) => id(c._id)));

  const pool = [...curated];
  if (pool.length < limit) {
    const fill = await Clinic.find({ ...base })
      .sort({ sortScore: -1 })
      .limit(limit * 2)
      .lean<IClinic[]>();
    for (const c of fill) {
      if (pool.length >= limit) break;
      if (!curatedIds.has(id(c._id))) pool.push(c);
    }
  }
  return toClinicCards(pool.slice(0, limit) as unknown as ClinicListItem[]);
}

export async function getHomeData(): Promise<HomeData> {
  await dbConnect();
  const settings = await SiteSetting.getGlobal();

  const [
    treatments,
    conditions,
    countries,
    featuredClinics,
    latestArticles,
    clinicCount,
    verifiedCount,
    reviewCount,
  ] = await Promise.all([
    getTreatments(),
    getConditions(),
    getCountries(),
    getFeaturedClinics(settings.featuredClinicIds ?? []),
    getLatestArticles(3),
    Clinic.countDocuments({ status: "published", isDeleted: false }),
    Clinic.countDocuments({
      status: "published",
      isDeleted: false,
      "verification.isVerified": true,
    }),
    Review.countDocuments({ status: "approved", isDeleted: false }),
  ]);

  return {
    hero: {
      headline: settings.hero?.headline || HERO_FALLBACK.headline,
      subhead: settings.hero?.subhead || HERO_FALLBACK.subhead,
      ctaPrimaryLabel:
        settings.hero?.ctaPrimaryLabel || HERO_FALLBACK.ctaPrimaryLabel,
      ctaSecondaryLabel:
        settings.hero?.ctaSecondaryLabel || HERO_FALLBACK.ctaSecondaryLabel,
    },
    popularSearches: settings.popularSearches?.length
      ? settings.popularSearches.map((p) => ({ label: p.label, href: p.href }))
      : POPULAR_FALLBACK,
    treatments,
    conditions,
    countries,
    featuredClinics,
    testimonials: (settings.testimonials ?? []).map((t) => ({
      quote: t.quote,
      author: t.author,
      role: t.role,
      location: t.location,
      rating: t.rating,
    })),
    latestArticles,
    stats: {
      clinics: clinicCount,
      verified: verifiedCount,
      reviews: reviewCount,
    },
  };
}

// ── Articles (education hub) ─────────────────────────────────────────────────

export interface ArticleCardView {
  title: string;
  slug: string;
  excerpt?: string;
  coverUrl?: string;
  coverAlt?: string;
  category?: string;
  readingTime?: number;
  publishedAt?: string;
  authorName?: string;
}

function toArticleCard(a: IArticle): ArticleCardView {
  return {
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    coverUrl: a.coverImage?.url,
    coverAlt: a.coverImage?.alt,
    category: a.categories?.[0],
    readingTime: a.readingTime,
    publishedAt: a.publishedAt
      ? new Date(a.publishedAt).toISOString()
      : undefined,
    authorName: a.author?.name,
  };
}

const articlePublishedFilter = {
  status: "published",
  isDeleted: false,
  publishedAt: { $ne: null },
} as const;

export async function getLatestArticles(
  limit = 3,
): Promise<ArticleCardView[]> {
  await dbConnect();
  const docs = await Article.find(articlePublishedFilter)
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean<IArticle[]>();
  return docs.map(toArticleCard);
}

export interface ArticlesPage {
  articles: ArticleCardView[];
  featured?: ArticleCardView;
  categories: { slug: string; label: string; count: number }[];
  total: number;
  page: number;
  pageCount: number;
}

const ARTICLE_PAGE_SIZE = 9;

/** Titleize a category slug ("medical-travel" → "Medical travel"). */
export function titleizeSlug(slug: string): string {
  const s = slug.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function getArticlesPage(opts: {
  category?: string;
  page?: number;
}): Promise<ArticlesPage> {
  await dbConnect();
  const page = Math.max(1, opts.page ?? 1);
  const filter: Record<string, unknown> = { ...articlePublishedFilter };
  if (opts.category) filter.categories = opts.category;

  const [docs, total, categoryAgg, featuredDoc] = await Promise.all([
    Article.find(filter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * ARTICLE_PAGE_SIZE)
      .limit(ARTICLE_PAGE_SIZE)
      .lean<IArticle[]>(),
    Article.countDocuments(filter),
    Article.aggregate<{ _id: string; count: number }>([
      { $match: articlePublishedFilter },
      { $unwind: "$categories" },
      { $group: { _id: "$categories", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    !opts.category && page === 1
      ? Article.findOne(articlePublishedFilter)
          .sort({ publishedAt: -1 })
          .lean<IArticle>()
      : Promise.resolve(null),
  ]);

  return {
    articles: docs.map(toArticleCard),
    featured: featuredDoc ? toArticleCard(featuredDoc) : undefined,
    categories: categoryAgg.map((c) => ({
      slug: c._id,
      label: titleizeSlug(c._id),
      count: c.count,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ARTICLE_PAGE_SIZE)),
  };
}

export interface ArticleDetail extends ArticleCardView {
  body?: string;
  authorBio?: string;
  authorAvatarUrl?: string;
  categories: string[];
  tags: string[];
  updatedAt?: string;
  relatedTreatments: TaxonomyTerm[];
  relatedConditions: TaxonomyTerm[];
  raw: IArticle;
}

export async function getArticleBySlug(
  slug: string,
): Promise<ArticleDetail | null> {
  await dbConnect();
  const doc = await Article.findOne({ slug, ...articlePublishedFilter })
    .populate("relatedTreatmentIds", "name slug clinicCount")
    .populate("relatedConditionIds", "name slug clinicCount")
    .lean<IArticle>();
  if (!doc) return null;

  const treatmentRefs = (doc.relatedTreatmentIds ?? []) as unknown as PopulatedRef[];
  const conditionRefs = (doc.relatedConditionIds ?? []) as unknown as PopulatedRef[];
  const termOf = (r: PopulatedRef): TaxonomyTerm => ({
    id: id(r._id),
    name: r.name,
    slug: r.slug,
    clinicCount: r.clinicCount ?? 0,
  });

  return {
    ...toArticleCard(doc),
    body: doc.body,
    authorBio: doc.author?.bio,
    authorAvatarUrl: doc.author?.avatar?.url,
    categories: doc.categories ?? [],
    tags: doc.tags ?? [],
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
    relatedTreatments: treatmentRefs.map(termOf),
    relatedConditions: conditionRefs.map(termOf),
    raw: doc,
  };
}

export async function getPublishedArticleSlugs(): Promise<string[]> {
  await dbConnect();
  const docs = await Article.find(articlePublishedFilter).select("slug").lean();
  return docs.map((d) => d.slug);
}

// ── Plans (for-clinics) ──────────────────────────────────────────────────────

export interface PlanView {
  key: string;
  name: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  currency: string;
  features: string[];
  badge?: string;
  highlighted: boolean;
  ctaLabel?: string;
}

export async function getActivePlans(): Promise<PlanView[]> {
  await dbConnect();
  const docs = await Plan.find({ isActive: true })
    .sort({ order: 1 })
    .lean<IPlan[]>();
  return docs.map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    currency: p.currency,
    features: p.features ?? [],
    badge: p.badge,
    highlighted: Boolean(p.highlighted),
    ctaLabel: p.ctaLabel,
  }));
}

// ── Member account (PRD §6.10) ───────────────────────────────────────────────

export interface MemberReview {
  id: string;
  clinicName: string;
  clinicSlug: string;
  status: string;
  ratingOverall: number;
  headline?: string;
  createdAt: string;
  emailVerified: boolean;
}

export interface MemberLead {
  id: string;
  type: string;
  clinicName?: string;
  status: string;
  createdAt: string;
}

/** The member's submitted reviews (matched by their private email). */
export async function getMemberReviews(email: string): Promise<MemberReview[]> {
  await dbConnect();
  const docs = await Review.find({ "reviewer.email": email.toLowerCase() })
    .sort({ createdAt: -1 })
    .populate("clinicId", "name slug")
    .lean<IReview[]>();
  return docs.map((r) => {
    const clinic = r.clinicId as unknown as PopulatedRef | null;
    return {
      id: id(r._id),
      clinicName: clinic?.name ?? "Clinic",
      clinicSlug: clinic?.slug ?? "",
      status: r.status,
      ratingOverall: r.ratingOverall,
      headline: r.headline,
      createdAt: new Date(r.createdAt).toISOString(),
      emailVerified: Boolean(r.emailVerifiedAt),
    };
  });
}

/** The member's inquiries/consultation requests (matched by email). */
export async function getMemberLeads(email: string): Promise<MemberLead[]> {
  await dbConnect();
  const docs = await Lead.find({ email: email.toLowerCase() })
    .sort({ createdAt: -1 })
    .populate("clinicId", "name")
    .lean();
  return docs.map((l) => {
    const clinic = l.clinicId as unknown as PopulatedRef | null;
    return {
      id: id(l._id),
      type: l.type,
      clinicName: clinic?.name,
      status: l.status,
      createdAt: new Date(l.createdAt).toISOString(),
    };
  });
}

// ── Global search (clinics + articles) ───────────────────────────────────────

export interface GlobalSearchResult {
  clinics: ClinicCardData[];
  clinicTotal: number;
  articles: ArticleCardView[];
  articleTotal: number;
}

export async function globalSearch(
  query: string,
): Promise<GlobalSearchResult> {
  const q = query.trim();
  if (!q) {
    return { clinics: [], clinicTotal: 0, articles: [], articleTotal: 0 };
  }
  await dbConnect();

  const [clinicResult, articleDocs] = await Promise.all([
    getDirectoryData({ query: q, pageSize: 12, sort: "relevance" }),
    Article.find({ ...articlePublishedFilter, $text: { $search: q } })
      .select("title slug excerpt coverImage categories readingTime publishedAt author")
      .limit(8)
      .lean<IArticle[]>(),
  ]);

  return {
    clinics: clinicResult.cards,
    clinicTotal: clinicResult.total,
    articles: articleDocs.map(toArticleCard),
    articleTotal: articleDocs.length,
  };
}

// ── Sitemap (Stage 7.4) ──────────────────────────────────────────────────────

/** A single URL entry for `app/sitemap.ts` (path is root-relative). */
export interface SitemapEntry {
  path: string;
  lastModified?: Date;
}

/** Published clinic profile URLs with their last-updated timestamp. */
export async function getClinicSitemapEntries(): Promise<SitemapEntry[]> {
  await dbConnect();
  const docs = await Clinic.find({ status: "published", isDeleted: false })
    .select("slug updatedAt")
    .lean();
  return docs.map((d) => ({
    path: `/clinic/${d.slug}`,
    lastModified: d.updatedAt,
  }));
}

/** Published article URLs with their last-updated timestamp. */
export async function getArticleSitemapEntries(): Promise<SitemapEntry[]> {
  await dbConnect();
  const docs = await Article.find(articlePublishedFilter)
    .select("slug updatedAt publishedAt")
    .lean();
  return docs.map((d) => ({
    path: `/resources/${d.slug}`,
    lastModified: d.updatedAt ?? d.publishedAt ?? undefined,
  }));
}

/**
 * Programmatic taxonomy landing-page URLs (Stage 7.1): every active treatment,
 * condition, country, and city term — countries/cities resolved to their
 * `/locations/[country]([/city])` paths.
 */
export async function getTaxonomySitemapEntries(): Promise<SitemapEntry[]> {
  await dbConnect();
  const [treatments, conditions, countries, cities] = await Promise.all([
    Treatment.find({ isActive: true }).select("slug updatedAt").lean(),
    Condition.find({ isActive: true }).select("slug updatedAt").lean(),
    Location.find({ kind: "country", isActive: true })
      .select("slug updatedAt")
      .lean(),
    Location.find({ kind: "city", isActive: true })
      .select("slug updatedAt parentId")
      .lean(),
  ]);

  const countrySlugById = new Map(
    countries.map((c) => [id(c._id), c.slug] as const),
  );

  const entries: SitemapEntry[] = [
    ...treatments.map((t) => ({
      path: `/treatments/${t.slug}`,
      lastModified: t.updatedAt,
    })),
    ...conditions.map((c) => ({
      path: `/conditions/${c.slug}`,
      lastModified: c.updatedAt,
    })),
    ...countries.map((c) => ({
      path: `/locations/${c.slug}`,
      lastModified: c.updatedAt,
    })),
  ];

  for (const city of cities) {
    const countrySlug = city.parentId
      ? countrySlugById.get(id(city.parentId))
      : undefined;
    if (!countrySlug) continue; // skip orphan cities (no crawlable URL)
    entries.push({
      path: `/locations/${countrySlug}/${city.slug}`,
      lastModified: city.updatedAt,
    });
  }

  return entries;
}
