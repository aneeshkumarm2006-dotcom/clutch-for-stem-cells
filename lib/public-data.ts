/**
 * Public data-access layer — Stage 5.
 *
 * Server-only read helpers that the public pages (homepage, directory, profile,
 * …) call. Keeps the Mongoose/aggregation details out of the page
 * components and returns plain, serializable view models (no Mongoose docs cross
 * the server/client boundary). Pairs with `lib/search.ts` (faceted directory
 * query) and `lib/seo.ts` (metadata/JSON-LD).
 *
 * Stable reference data (taxonomy, languages) is wrapped in `unstable_cache` so
 * it's cached across requests — see {@link getTreatments} et al.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { Types, type Model } from "mongoose";

import { dbConnect } from "@/lib/db";
import { parseBlocks } from "@/lib/blocks/content";
import { formatLocation } from "@/lib/format";
import { getHomepageContent } from "@/lib/homepage";
import { compareClinicsForListing } from "@/lib/ranking";
import {
  isThinDirectoryTerm,
  type DirectoryTermIndexability,
} from "@/lib/seo-indexation";
import type { HomepageContent } from "@/config/homepage";
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
  CellSource,
  Clinic,
  Condition,
  Lead,
  Location,
  MedicalReviewer,
  Plan,
  Review,
  SiteSetting,
  Treatment,
  User,
  type IClinic,
  type IPlan,
  type IReview,
  type ISeo,
  type ITaxonomyBase,
} from "@/models";
import type { EvidenceLevel } from "@/lib/enums";
import type { BlockInput } from "@/lib/validation/block";
import type { ReviewerByline } from "@/components/content/reviewed-by-byline";

// ── Small serialization helpers ──────────────────────────────────────────────

const id = (v: unknown): string => String(v);

/**
 * View a concrete taxonomy model (Treatment/Condition/…) as its shared base for
 * generic reads. The per-kind interfaces diverge enough that a union of the
 * models isn't callable, so we widen to `Model<ITaxonomyBase>` at the call site.
 */
const asTaxonomyModel = (m: unknown): Model<ITaxonomyBase> =>
  m as Model<ITaxonomyBase>;

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
  /**
   * Approved editorial content for the term's detail page (body, FAQ, key
   * facts, medical-reviewer byline). Populated ONLY by the single-term readers
   * and ONLY when `reviewStatus === "approved"` — grid/facet readers leave it
   * undefined. `null` means "no approved editorial content".
   */
  editorial?: TermEditorial | null;
}

export interface CountryTerm extends TaxonomyTerm {
  countryCode?: string;
  flag?: string;
}

/** One labeled long-form section composed from a term's per-kind fields. */
export interface EditorialSection {
  title: string;
  /** Markdown source (render via `lib/markdown.ts::renderMarkdown`). */
  body: string;
}

/** Approved, human-reviewed editorial content rendered on a term detail page. */
export interface TermEditorial {
  body?: string;
  /** Editor-composed sections (the modular block builder), in display order. */
  blocks: BlockInput[];
  faqs: { question: string; answer: string }[];
  keyFacts: { label: string; value: string; sourceUrl?: string }[];
  sections: EditorialSection[];
  evidenceLevel?: EvidenceLevel | null;
  reviewer?: ReviewerByline | null;
  lastReviewedAt?: string | null;
  updatedAt?: string | null;
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

/** Labeled per-kind editorial sections, in display order (blank fields skipped). */
const EDITORIAL_SECTION_FIELDS: { field: string; title: string }[] = [
  // Condition
  { field: "overview", title: "Overview" },
  { field: "standardOfCare", title: "Standard of care" },
  { field: "evidenceForCellTherapy", title: "Evidence for cell therapy" },
  // Treatment
  { field: "mechanism", title: "How it works" },
  { field: "evidenceSummary", title: "What the evidence shows" },
  { field: "costRange", title: "Typical cost" },
  { field: "recoveryTimeline", title: "Recovery timeline" },
  { field: "risks", title: "Risks & considerations" },
  // Location (country)
  { field: "regulatoryStatus", title: "Regulatory status" },
  { field: "logistics", title: "Getting there & logistics" },
  { field: "travelNotes", title: "Travel notes" },
];

/**
 * Build the gated editorial view for a taxonomy detail page. Returns `null`
 * unless the term is `approved` (drafts/in-review never render publicly). Loads
 * the credentialed reviewer for the byline + schema.
 */
/** Load a credentialed reviewer as a byline (or null if unset/inactive). */
export async function loadReviewerByline(
  reviewedById: unknown,
): Promise<ReviewerByline | null> {
  if (!reviewedById) return null;
  const r = await MedicalReviewer.findById(reviewedById)
    .select("name credentials title slug sameAs isActive")
    .lean();
  if (!r || !r.isActive) return null;
  return {
    name: r.name,
    credentials: r.credentials,
    title: r.title,
    slug: r.slug,
    sameAs: r.sameAs,
  };
}

async function buildTermEditorial(
  doc: Record<string, unknown>,
): Promise<TermEditorial | null> {
  if (doc.reviewStatus !== "approved") return null;

  const reviewer = await loadReviewerByline(doc.reviewedBy);

  const sections: EditorialSection[] = [];
  for (const { field, title } of EDITORIAL_SECTION_FIELDS) {
    const value = doc[field];
    if (typeof value === "string" && value.trim()) {
      sections.push({ title, body: value });
    }
  }

  const faqs =
    (doc.faqs as { question: string; answer: string }[] | undefined) ?? [];
  const keyFacts =
    (doc.keyFacts as
      { label: string; value: string; sourceUrl?: string }[] | undefined) ?? [];

  return {
    body: typeof doc.body === "string" ? doc.body : undefined,
    blocks: parseBlocks(doc.blocks),
    faqs: faqs.map((f) => ({ question: f.question, answer: f.answer })),
    keyFacts: keyFacts.map((k) => ({
      label: k.label,
      value: k.value,
      sourceUrl: k.sourceUrl,
    })),
    sections,
    evidenceLevel: (doc.evidenceLevel as EvidenceLevel | undefined) ?? null,
    reviewer,
    // Only claim a medical-review date when a credentialed reviewer actually
    // resolved. `lastReviewedAt` is stamped on every approved save, so exposing
    // it unconditionally would put `lastReviewed` in the page's MedicalWebPage
    // JSON-LD for content nobody reviewed.
    lastReviewedAt:
      reviewer && doc.lastReviewedAt
        ? new Date(doc.lastReviewedAt as Date).toISOString()
        : null,
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as Date).toISOString()
      : null,
  };
}

/**
 * Field projection for the sitemap's indexation test. Everything
 * {@link isThinDirectoryTerm} reads, and nothing else — no reviewer lookup, no
 * block parsing, one query per collection.
 */
const EDITORIAL_PRESENCE_SELECT = [
  "slug",
  "updatedAt",
  "clinicCount",
  "reviewStatus",
  "body",
  "blocks",
  "faqs",
  "keyFacts",
  ...EDITORIAL_SECTION_FIELDS.map((f) => f.field),
].join(" ");

/**
 * The minimal `editorial` shape {@link isThinDirectoryTerm} needs. Mirrors
 * {@link buildTermEditorial}'s approval gate exactly (drafts and in-review terms
 * return `null`) so a term's sitemap presence and its own `generateMetadata` can
 * never disagree — without paying for the reviewer join the page render does.
 */
function editorialPresence(
  doc: Record<string, unknown>,
): DirectoryTermIndexability["editorial"] {
  if (doc.reviewStatus !== "approved") return null;
  const sections = EDITORIAL_SECTION_FIELDS.filter(({ field }) => {
    const value = doc[field];
    return typeof value === "string" && value.trim().length > 0;
  });
  return {
    body: typeof doc.body === "string" ? doc.body : null,
    blocks: (doc.blocks as unknown[] | undefined) ?? [],
    faqs: (doc.faqs as unknown[] | undefined) ?? [],
    keyFacts: (doc.keyFacts as unknown[] | undefined) ?? [],
    sections,
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

function cachedTaxonomy<T>(
  key: string,
  fn: () => Promise<T>,
): () => Promise<T> {
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
  const model = asTaxonomyModel(kind === "treatment" ? Treatment : Condition);
  const doc = await model.findOne({ slug, isActive: true }).lean();
  if (!doc) return null;
  return {
    ...toTerm(doc as unknown as ITaxonomyBase),
    editorial: await buildTermEditorial(
      doc as unknown as Record<string, unknown>,
    ),
  };
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
    editorial: await buildTermEditorial(
      doc as unknown as Record<string, unknown>,
    ),
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
    editorial: await buildTermEditorial(
      doc as unknown as Record<string, unknown>,
    ),
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
  for (const t of [
    ...treatments,
    ...conditions,
    ...cellSources,
    ...countries,
  ]) {
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
    .populate(
      "treatmentTypes",
      "name slug shortDescription category clinicCount",
    )
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
  const conditionRefs = (doc.conditionsTreated ??
    []) as unknown as PopulatedRef[];
  const cellSourceRefs = (doc.cellSources ?? []) as unknown as PopulatedRef[];
  const accreditationRefs = (doc.accreditations ??
    []) as unknown as (PopulatedRef & {
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
  const conditionRefs = (doc.conditionsTreated ??
    []) as unknown as PopulatedRef[];
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
        ? {
            range: r.cost.range,
            isConfidential: Boolean(r.cost.isConfidential),
          }
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

/** One star bucket of a clinic's rating histogram. */
export interface RatingBucket {
  /** 1–5. Overall ratings are rounded to the nearest whole star. */
  stars: number;
  count: number;
  /** Share of all approved reviews, 0–100. */
  percent: number;
}

export interface ClinicReviewStats {
  total: number;
  /** Always five buckets, 5★ → 1★, zero-filled. */
  distribution: RatingBucket[];
  /** % of reviewers who answered "would recommend" — `null` if none answered. */
  recommendRate: number | null;
  /** How many of the reviews are treatment-verified. */
  verifiedCount: number;
  /** ISO timestamp of the newest approved review, or `null`. */
  lastReviewedAt: string | null;
}

const EMPTY_REVIEW_STATS: ClinicReviewStats = {
  total: 0,
  distribution: [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: 0,
    percent: 0,
  })),
  recommendRate: null,
  verifiedCount: 0,
  lastReviewedAt: null,
};

/**
 * Aggregate review stats for the dedicated `/clinic/[slug]/reviews` page — the
 * star histogram, recommend rate, verified count, and freshness date. One
 * `$facet` pass over the approved reviews rather than four round trips.
 *
 * Deliberately computed live rather than denormalized onto `Clinic`: it's a
 * single indexed aggregation on one page, and it can never drift out of sync
 * with moderation the way `ratingAvg`/`reviewCount` can between recomputes.
 */
export async function getClinicReviewStats(
  clinicId: string,
): Promise<ClinicReviewStats> {
  await dbConnect();

  const [agg] = await Review.aggregate<{
    buckets: { _id: number; count: number }[];
    recommend: { yes: number; answered: number }[];
    totals: { total: number; verified: number; latest: Date | null }[];
  }>([
    {
      $match: {
        clinicId: new Types.ObjectId(clinicId),
        status: "approved",
        isDeleted: false,
      },
    },
    {
      $facet: {
        buckets: [
          {
            $group: {
              _id: { $round: ["$ratingOverall", 0] },
              count: { $sum: 1 },
            },
          },
        ],
        recommend: [
          { $match: { wouldRecommend: { $ne: null } } },
          {
            $group: {
              _id: null,
              yes: { $sum: { $cond: ["$wouldRecommend", 1, 0] } },
              answered: { $sum: 1 },
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              verified: { $sum: { $cond: ["$isVerified", 1, 0] } },
              latest: { $max: "$createdAt" },
            },
          },
        ],
      },
    },
  ]);

  const totals = agg?.totals?.[0];
  const total = totals?.total ?? 0;
  if (!total) return EMPTY_REVIEW_STATS;

  const counts = new Map<number, number>();
  for (const b of agg?.buckets ?? []) {
    // Clamp defensively — a stray 0 or 6 would otherwise fall out of the chart.
    const stars = Math.min(5, Math.max(1, b._id));
    counts.set(stars, (counts.get(stars) ?? 0) + b.count);
  }

  const recommend = agg?.recommend?.[0];

  return {
    total,
    distribution: [5, 4, 3, 2, 1].map((stars) => {
      const count = counts.get(stars) ?? 0;
      return { stars, count, percent: Math.round((count / total) * 100) };
    }),
    recommendRate: recommend?.answered
      ? Math.round((recommend.yes / recommend.answered) * 100)
      : null,
    verifiedCount: totals?.verified ?? 0,
    lastReviewedAt: totals?.latest
      ? new Date(totals.latest).toISOString()
      : null,
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

// ── Related taxonomy terms (hub-and-spoke internal linking) ───────────────────
// These power the `RelatedLinks` sections on taxonomy + combination pages so no
// term is orphaned and link equity flows across the treatment/condition/location
// matrix. All are DB-backed like the directory query these pages already run.

/** Sibling terms in the same `category`, ranked by clinic coverage (self excluded). */
export async function getRelatedTerms(
  kind: "treatment" | "condition",
  slug: string,
  limit = 6,
): Promise<TaxonomyTerm[]> {
  await dbConnect();
  const model = asTaxonomyModel(kind === "treatment" ? Treatment : Condition);
  const term = await model
    .findOne({ slug, isActive: true })
    .select("category")
    .lean<{ category?: string } | null>();
  if (!term) return [];
  const query: Record<string, unknown> = {
    slug: { $ne: slug },
    isActive: true,
  };
  if (term.category) query.category = term.category;
  const docs = await model
    .find(query)
    .sort({ clinicCount: -1, order: 1, name: 1 })
    .limit(limit)
    .lean();
  return docs.map((d) => toTerm(d as unknown as ITaxonomyBase));
}

/**
 * Conditions most often co-listed by published clinics that offer `treatmentSlug`
 * — a data-driven "related conditions" set that works before any editorial
 * combination page exists. Neutral by construction (co-occurrence, not efficacy).
 */
export async function getCoOccurringConditions(
  treatmentSlug: string,
  limit = 6,
): Promise<TaxonomyTerm[]> {
  await dbConnect();
  const treatment = await Treatment.findOne({
    slug: treatmentSlug,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (!treatment) return [];
  return coOccurringTerms(
    asTaxonomyModel(Condition),
    { treatmentTypes: treatment._id },
    "$conditionsTreated",
    limit,
  );
}

/** Treatments most often co-listed by published clinics that treat `conditionSlug`. */
export async function getCoOccurringTreatments(
  conditionSlug: string,
  limit = 6,
): Promise<TaxonomyTerm[]> {
  await dbConnect();
  const condition = await Condition.findOne({
    slug: conditionSlug,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (!condition) return [];
  return coOccurringTerms(
    asTaxonomyModel(Treatment),
    { conditionsTreated: condition._id },
    "$treatmentTypes",
    limit,
  );
}

/** Shared co-occurrence aggregation: count a facet array over matching clinics. */
async function coOccurringTerms(
  termModel: Model<ITaxonomyBase>,
  match: Record<string, unknown>,
  unwindField: string,
  limit: number,
): Promise<TaxonomyTerm[]> {
  const rows = await Clinic.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { status: "published", isDeleted: false, ...match } },
    { $unwind: unwindField },
    { $group: { _id: unwindField, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  if (!rows.length) return [];
  const rank = new Map(rows.map((r) => [id(r._id), r.count]));
  const docs = await termModel
    .find({ _id: { $in: rows.map((r) => r._id) }, isActive: true })
    .lean();
  return docs
    .map((d) => toTerm(d as unknown as ITaxonomyBase))
    .sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0));
}

/** Active cities under a country (by slug), ranked by clinic coverage. */
export async function getCitiesByCountry(
  countrySlug: string,
  limit = 12,
): Promise<TaxonomyTerm[]> {
  await dbConnect();
  const country = await Location.findOne({
    kind: "country",
    slug: countrySlug,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (!country) return [];
  const docs = await Location.find({
    kind: "city",
    parentId: country._id,
    isActive: true,
  })
    .sort({ clinicCount: -1, order: 1, name: 1 })
    .limit(limit)
    .lean();
  return docs.map((d) => toTerm(d as unknown as ITaxonomyBase));
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

/**
 * The homepage's data: the editable copy (`content`, resolved from Settings by
 * `lib/homepage.ts`) plus the feeds and counts it can only get from the
 * database. Every string the page renders comes from `content` — the page holds
 * no copy of its own.
 */
export interface HomeData {
  content: HomepageContent;
  treatments: TaxonomyTerm[];
  conditions: TaxonomyTerm[];
  countries: CountryTerm[];
  featuredClinics: ClinicCardData[];
  stats: { clinics: number; verified: number; reviews: number };
}

/** Featured clinics: admin-curated IDs first, then top-ranked verified clinics. */
async function getFeaturedClinics(
  featuredIds: Types.ObjectId[],
  limit = 4,
): Promise<ClinicCardData[]> {
  await dbConnect();
  const base = { status: "published", isDeleted: false } as const;

  const curated = featuredIds?.length
    ? await Clinic.find({ ...base, _id: { $in: featuredIds } }).lean<
        IClinic[]
      >()
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
  const [settings, content] = await Promise.all([
    SiteSetting.getGlobal(),
    getHomepageContent(),
  ]);

  const [
    treatments,
    conditions,
    countries,
    featuredClinics,
    clinicCount,
    verifiedCount,
    reviewCount,
  ] = await Promise.all([
    getTreatments(),
    getConditions(),
    getCountries(),
    getFeaturedClinics(settings.featuredClinicIds ?? [], content.featured.limit),
    Clinic.countDocuments({ status: "published", isDeleted: false }),
    Clinic.countDocuments({
      status: "published",
      isDeleted: false,
      "verification.isVerified": true,
    }),
    Review.countDocuments({ status: "approved", isDeleted: false }),
  ]);

  return {
    content,
    treatments,
    conditions,
    countries,
    featuredClinics,
    stats: {
      clinics: clinicCount,
      verified: verifiedCount,
      reviews: reviewCount,
    },
  };
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

// ── Global search (clinics) ──────────────────────────────────────────────────

export interface GlobalSearchResult {
  clinics: ClinicCardData[];
  clinicTotal: number;
}

export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const q = query.trim();
  if (!q) {
    return { clinics: [], clinicTotal: 0 };
  }
  await dbConnect();

  const clinicResult = await getDirectoryData({
    query: q,
    pageSize: 12,
    sort: "relevance",
  });

  return {
    clinics: clinicResult.cards,
    clinicTotal: clinicResult.total,
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

/**
 * The dedicated `/clinic/[slug]/reviews` URLs. Emitted only for clinics that
 * actually have approved reviews — an empty reviews page self-`noindex`es, and
 * the sitemap must never disagree with the page (see `lib/seo-indexation.ts`).
 */
export async function getClinicReviewSitemapEntries(): Promise<SitemapEntry[]> {
  await dbConnect();
  const docs = await Clinic.find({
    status: "published",
    isDeleted: false,
    reviewCount: { $gt: 0 },
  })
    .select("slug updatedAt")
    .lean();
  return docs.map((d) => ({
    path: `/clinic/${d.slug}/reviews`,
    lastModified: d.updatedAt,
  }));
}

/**
 * Programmatic taxonomy landing-page URLs (Stage 7.1): every active treatment,
 * condition, country, and city term — countries/cities resolved to their
 * `/locations/[country]([/city])` paths.
 *
 * Terms that would render `noindex` are withheld. Submitting a "Clinics treating
 * X" page with zero clinics and no approved guide is what earns a **Soft 404**
 * in Search Console, and a sitemap that lists self-`noindex`ing URLs contradicts
 * itself — so the exact test the term routes run ({@link isThinDirectoryTerm})
 * runs here too, over the same denormalized `clinicCount`.
 */
export async function getTaxonomySitemapEntries(): Promise<SitemapEntry[]> {
  await dbConnect();
  const select = EDITORIAL_PRESENCE_SELECT;
  const [treatments, conditions, countries, cities] = await Promise.all([
    Treatment.find({ isActive: true }).select(select).lean(),
    Condition.find({ isActive: true }).select(select).lean(),
    Location.find({ kind: "country", isActive: true }).select(select).lean(),
    Location.find({ kind: "city", isActive: true })
      .select(`${select} parentId`)
      .lean(),
  ]);

  const countrySlugById = new Map(
    countries.map((c) => [id(c._id), c.slug] as const),
  );

  /** Drop terms whose page self-`noindex`es (nothing to list, nothing to read). */
  const indexable = (docs: unknown[]) =>
    (docs as Record<string, unknown>[]).filter(
      (d) =>
        !isThinDirectoryTerm({
          clinicCount: d.clinicCount as number | undefined,
          editorial: editorialPresence(d),
        }),
    );

  const entries: SitemapEntry[] = [
    ...indexable(treatments).map((t) => ({
      path: `/treatments/${t.slug as string}`,
      lastModified: t.updatedAt as Date | undefined,
    })),
    ...indexable(conditions).map((c) => ({
      path: `/conditions/${c.slug as string}`,
      lastModified: c.updatedAt as Date | undefined,
    })),
    ...indexable(countries).map((c) => ({
      path: `/locations/${c.slug as string}`,
      lastModified: c.updatedAt as Date | undefined,
    })),
  ];

  for (const city of indexable(cities)) {
    const countrySlug = city.parentId
      ? countrySlugById.get(id(city.parentId))
      : undefined;
    if (!countrySlug) continue; // skip orphan cities (no crawlable URL)
    entries.push({
      path: `/locations/${countrySlug}/${city.slug as string}`,
      lastModified: city.updatedAt as Date | undefined,
    });
  }

  return entries;
}
