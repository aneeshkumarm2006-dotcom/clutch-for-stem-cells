/**
 * Clinics admin read-layer (PRD §8.2 / Stage 6.3–6.4).
 *
 * List rows for the DataTable + the full serialized form model for the editor.
 * Admin reads see every status and soft-deleted rows.
 */
import "server-only";
import { cache } from "react";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import {
  id,
  initials,
  iso,
  paginate,
  serializeImage,
  type Paginated,
} from "@/lib/admin/serialize";
import { Clinic } from "@/models";
import type { IClinic } from "@/models";
import type { ClinicStatus, ClinicTier } from "@/lib/enums";

export interface AdminClinicRow {
  id: string;
  name: string;
  slug: string;
  initials: string;
  logoUrl?: string;
  status: ClinicStatus;
  tier: ClinicTier;
  isVerified: boolean;
  ratingAvg: number;
  reviewCount: number;
  location: string;
  updatedAt?: string;
  isDeleted: boolean;
}

export interface ClinicsQuery {
  q?: string;
  status?: string;
  tier?: string;
  country?: string;
  treatment?: string;
  verified?: boolean;
  includeDeleted?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
}

const SORTS: Record<string, Record<string, 1 | -1>> = {
  updated_desc: { updatedAt: -1 },
  updated_asc: { updatedAt: 1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  rating_desc: { ratingAvg: -1 },
  rating_asc: { ratingAvg: 1 },
  reviews_desc: { reviewCount: -1 },
  reviews_asc: { reviewCount: 1 },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function primaryLocation(c: IClinic): string {
  const loc = c.locations?.find((l) => l.isHQ) ?? c.locations?.[0];
  if (!loc) return "–";
  const place = loc.city || loc.region || loc.country;
  const cc = loc.countryCode || loc.country;
  return place ? (cc && cc !== place ? `${place}, ${cc}` : place) : "–";
}

function buildFilter(query: ClinicsQuery): FilterQuery<IClinic> {
  const filter: FilterQuery<IClinic> = {};
  if (!query.includeDeleted) filter.isDeleted = false;
  if (query.status) filter.status = query.status as ClinicStatus;
  if (query.tier) filter.tier = query.tier as ClinicTier;
  if (query.country) filter["locations.country"] = query.country;
  if (query.treatment) filter.treatmentTypes = query.treatment;
  if (query.verified) filter["verification.isVerified"] = true;
  if (query.q) filter.name = new RegExp(escapeRegex(query.q), "i");
  return filter;
}

export async function getAdminClinics(
  query: ClinicsQuery = {},
): Promise<Paginated<AdminClinicRow>> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const filter = buildFilter(query);
  const sort = SORTS[query.sort ?? "updated_desc"] ?? SORTS.updated_desc;

  const [docs, total] = await Promise.all([
    Clinic.find(filter)
      .select(
        "name slug status tier verification ratingAvg reviewCount logo locations updatedAt isDeleted",
      )
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Clinic.countDocuments(filter),
  ]);

  const rows: AdminClinicRow[] = docs.map((c) => ({
    id: id(c._id),
    name: c.name,
    slug: c.slug,
    initials: initials(c.name),
    logoUrl: c.logo?.url,
    status: c.status,
    tier: c.tier,
    isVerified: Boolean(c.verification?.isVerified),
    ratingAvg: c.ratingAvg ?? 0,
    reviewCount: c.reviewCount ?? 0,
    location: primaryLocation(c as IClinic),
    updatedAt: iso(c.updatedAt),
    isDeleted: c.isDeleted,
  }));

  return paginate(rows, total, page, pageSize);
}

/** Distinct, non-empty country names for the list filter dropdown. */
export const getClinicCountries = cache(async (): Promise<string[]> => {
  await dbConnect();
  const values = (await Clinic.distinct("locations.country", {
    isDeleted: false,
  })) as (string | null)[];
  return values.filter(Boolean).sort() as string[];
});

/** Flattened rows for CSV export (PRD §8.2). */
export async function getClinicsForExport(
  query: ClinicsQuery = {},
): Promise<AdminClinicRow[]> {
  const { rows } = await getAdminClinics({ ...query, page: 1, pageSize: 5000 });
  return rows;
}

// ── Full form model (editor — Stage 6.4) ─────────────────────────────────────

export interface ClinicFormData {
  id: string;
  values: Record<string, unknown>;
}

/**
 * Serialize a clinic into the shape the editor form (and `clinicCreateSchema`)
 * expects: ObjectId refs → string ids, sub-docs → plain objects.
 */
export async function getAdminClinicFormData(
  clinicId: string,
): Promise<ClinicFormData | null> {
  await dbConnect();
  const c = await Clinic.findById(clinicId).lean();
  if (!c) return null;

  const person = (p?: IClinic["medicalDirector"]) =>
    p
      ? {
          name: p.name,
          title: p.title,
          credentials: p.credentials,
          bio: p.bio,
          photo: serializeImage(p.photo),
        }
      : undefined;

  const values = {
    name: c.name,
    slug: c.slug,
    status: c.status,
    tier: c.tier,
    verification: {
      isVerified: Boolean(c.verification?.isVerified),
      verifiedAt: iso(c.verification?.verifiedAt),
      badge: c.verification?.badge,
      method: c.verification?.method ?? "",
      notes: c.verification?.notes ?? "",
    },
    tagline: c.tagline ?? "",
    description: c.description ?? "",
    logo: serializeImage(c.logo),
    coverImage: serializeImage(c.coverImage),
    gallery: (c.gallery ?? []).map((g) => serializeImage(g)).filter(Boolean),
    videoUrl: c.videoUrl ?? "",
    treatmentTypes: (c.treatmentTypes ?? []).map(id),
    conditionsTreated: (c.conditionsTreated ?? []).map(id),
    cellSources: (c.cellSources ?? []).map(id),
    serviceFocus: (c.serviceFocus ?? []).map((f) => ({
      treatmentId: id(f.treatmentId),
      percent: f.percent,
    })),
    accreditations: (c.accreditations ?? []).map(id),
    priceMin: c.priceMin,
    priceMax: c.priceMax,
    currency: c.currency ?? "USD",
    priceModel: c.priceModel,
    priceNote: c.priceNote ?? "",
    foundedYear: c.foundedYear,
    teamSize: c.teamSize,
    physiciansCount: c.physiciansCount,
    medicalDirector: person(c.medicalDirector),
    team: (c.team ?? []).map((t) => person(t)),
    languages: c.languages ?? [],
    locations: (c.locations ?? []).map((l) => ({
      isHQ: l.isHQ,
      addressLine: l.addressLine ?? "",
      city: l.city ?? "",
      region: l.region ?? "",
      country: l.country ?? "",
      countryCode: l.countryCode ?? "",
      postalCode: l.postalCode ?? "",
      lat: l.lat,
      lng: l.lng,
      phone: l.phone ?? "",
    })),
    website: c.website ?? "",
    social: {
      linkedin: c.social?.linkedin ?? "",
      instagram: c.social?.instagram ?? "",
      facebook: c.social?.facebook ?? "",
      x: c.social?.x ?? "",
      youtube: c.social?.youtube ?? "",
    },
    contactEmail: c.contactEmail ?? "",
    caseStudies: (c.caseStudies ?? []).map((cs) => ({
      title: cs.title,
      conditionId: cs.conditionId ? id(cs.conditionId) : undefined,
      summary: cs.summary ?? "",
      outcome: cs.outcome ?? "",
      images: (cs.images ?? []).map((g) => serializeImage(g)).filter(Boolean),
      isAnonymized: cs.isAnonymized,
    })),
    faqs: (c.faqs ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    highlights: c.highlights ?? [],
    ownerUserId: c.ownerUserId ? id(c.ownerUserId) : undefined,
    isClaimed: c.isClaimed,
    seo: c.seo
      ? {
          metaTitle: c.seo.metaTitle ?? "",
          metaDescription: c.seo.metaDescription ?? "",
          ogImage: c.seo.ogImage ?? "",
          canonicalUrl: c.seo.canonicalUrl ?? "",
          noindex: c.seo.noindex ?? false,
        }
      : undefined,
    // Always a filled object (never `undefined`) so react-hook-form registers
    // the nested inputs as controlled from the first render.
    reviewsPage: {
      heading: c.reviewsPage?.heading ?? "",
      intro: c.reviewsPage?.intro ?? "",
      introEmpty: c.reviewsPage?.introEmpty ?? "",
      bodyMarkdown: c.reviewsPage?.bodyMarkdown ?? "",
      ctaHeading: c.reviewsPage?.ctaHeading ?? "",
      ctaBody: c.reviewsPage?.ctaBody ?? "",
      seo: {
        metaTitle: c.reviewsPage?.seo?.metaTitle ?? "",
        metaDescription: c.reviewsPage?.seo?.metaDescription ?? "",
        ogImage: c.reviewsPage?.seo?.ogImage ?? "",
        canonicalUrl: c.reviewsPage?.seo?.canonicalUrl ?? "",
        noindex: c.reviewsPage?.seo?.noindex ?? false,
      },
    },
    costPage: {
      heading: c.costPage?.heading ?? "",
      intro: c.costPage?.intro ?? "",
      introEmpty: c.costPage?.introEmpty ?? "",
      items: (c.costPage?.items ?? []).map((i) => ({
        label: i.label,
        priceMin: i.priceMin,
        priceMax: i.priceMax,
        currency: i.currency ?? "",
        unit: i.unit ?? "",
        note: i.note ?? "",
      })),
      includes: c.costPage?.includes ?? [],
      excludes: c.costPage?.excludes ?? [],
      insuranceNote: c.costPage?.insuranceNote ?? "",
      financingNote: c.costPage?.financingNote ?? "",
      bodyMarkdown: c.costPage?.bodyMarkdown ?? "",
      faqs: (c.costPage?.faqs ?? []).map((f) => ({
        question: f.question,
        answer: f.answer,
      })),
      sources: (c.costPage?.sources ?? []).map((s) => ({
        label: s.label,
        url: s.url ?? "",
      })),
      // `<input type="date">` wants `YYYY-MM-DD`; Zod coerces it back on save.
      lastVerifiedAt: c.costPage?.lastVerifiedAt
        ? new Date(c.costPage.lastVerifiedAt).toISOString().slice(0, 10)
        : "",
      ctaHeading: c.costPage?.ctaHeading ?? "",
      ctaBody: c.costPage?.ctaBody ?? "",
      seo: {
        metaTitle: c.costPage?.seo?.metaTitle ?? "",
        metaDescription: c.costPage?.seo?.metaDescription ?? "",
        ogImage: c.costPage?.seo?.ogImage ?? "",
        canonicalUrl: c.costPage?.seo?.canonicalUrl ?? "",
        noindex: c.costPage?.seo?.noindex ?? false,
      },
    },
    externalReviews: {
      google: {
        // Left as `undefined` rather than `0`: a blank rating field must stay
        // blank, and `0` would render as a real one-star average.
        rating: c.externalReviews?.google?.rating,
        reviewCount: c.externalReviews?.google?.reviewCount,
        summary: c.externalReviews?.google?.summary ?? "",
        themes: c.externalReviews?.google?.themes ?? [],
        highlights: (c.externalReviews?.google?.highlights ?? []).map((h) => ({
          author: h.author,
          rating: h.rating,
          text: h.text,
          publishedAt: dateInput(h.publishedAt),
          publishedLabel: h.publishedLabel ?? "",
          url: h.url ?? "",
        })),
        url: c.externalReviews?.google?.url ?? "",
        checkedAt: dateInput(c.externalReviews?.google?.checkedAt),
      },
      reddit: {
        summary: c.externalReviews?.reddit?.summary ?? "",
        threadCount: c.externalReviews?.reddit?.threadCount,
        sentiment: c.externalReviews?.reddit?.sentiment ?? "",
        themes: c.externalReviews?.reddit?.themes ?? [],
        sources: (c.externalReviews?.reddit?.sources ?? []).map((s) => ({
          label: s.label,
          url: s.url ?? "",
        })),
        checkedAt: dateInput(c.externalReviews?.reddit?.checkedAt),
      },
    },
  };

  return { id: id(c._id), values };
}

/** `<input type="date">` wants `YYYY-MM-DD`; Zod coerces it back on save. */
function dateInput(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
