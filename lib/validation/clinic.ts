/**
 * Clinic validation (PRD §5.1 / Stage 1.10).
 *
 * Mirrors the admin create/edit form (§8.2). Computed fields (ratingAvg,
 * ratingBreakdown, reviewCount, topMentions, sortScore) are owned by the server
 * and intentionally excluded here.
 */
import { z } from "zod";
import {
  CLINIC_STATUSES,
  CLINIC_TIERS,
  EXTERNAL_SENTIMENTS,
  PRICE_MODELS,
  TEAM_SIZES,
  VERIFICATION_BADGES,
} from "@/lib/enums";
import {
  blankToUndefined,
  currencySchema,
  imageSchema,
  objectIdSchema,
  personSchema,
  seoSchema,
  slugSchema,
} from "@/lib/validation/common";

const verificationSchema = z.object({
  isVerified: z.boolean().default(false),
  verifiedAt: z.coerce.date().nullish(),
  badge: z.enum(VERIFICATION_BADGES).optional(),
  method: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const serviceFocusSchema = z.object({
  treatmentId: objectIdSchema,
  percent: z.number().min(0).max(100),
});

const clinicLocationSchema = z.object({
  isHQ: z.boolean().default(false),
  addressLine: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  countryCode: z.preprocess(
    blankToUndefined,
    z.string().length(2).toUpperCase().optional(),
  ),
  postalCode: z.string().max(20).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  phone: z.string().max(40).optional(),
});

const socialSchema = z
  .object({
    linkedin: z.string().url().optional().or(z.literal("")),
    instagram: z.string().url().optional().or(z.literal("")),
    facebook: z.string().url().optional().or(z.literal("")),
    x: z.string().url().optional().or(z.literal("")),
    youtube: z.string().url().optional().or(z.literal("")),
  })
  .partial();

const caseStudySchema = z.object({
  title: z.string().min(1).max(200),
  conditionId: objectIdSchema.optional(),
  summary: z.string().max(4000).optional(),
  outcome: z.string().max(4000).optional(),
  images: z.array(imageSchema).default([]),
  isAnonymized: z.boolean().default(true),
});

const faqSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(4000),
});

/**
 * Copy + meta for the child `/clinic/[slug]/reviews` page. All-optional: a
 * blank field means "fall back to the auto-generated copy", so the form can
 * submit empty strings for anything the editor didn't fill in.
 */
const reviewsPageSchema = z
  .object({
    heading: z.preprocess(blankToUndefined, z.string().max(200).optional()),
    intro: z.preprocess(blankToUndefined, z.string().max(2000).optional()),
    introEmpty: z.preprocess(blankToUndefined, z.string().max(2000).optional()),
    bodyMarkdown: z.preprocess(
      blankToUndefined,
      z.string().max(20_000).optional(),
    ),
    ctaHeading: z.preprocess(blankToUndefined, z.string().max(200).optional()),
    ctaBody: z.preprocess(blankToUndefined, z.string().max(1000).optional()),
    seo: seoSchema.optional(),
  })
  .partial();

/**
 * Price data + copy for the child `/clinic/[slug]/cost` page. Same all-optional
 * contract as `reviewsPageSchema` — a blank field means "fall back to the
 * derived copy", so the form can submit empty strings freely.
 *
 * A price row with neither bound is legal and meaningful: it is a line the
 * clinic offers but only quotes privately, which the page renders as "On
 * consultation" rather than inventing a figure.
 */
const priceItemSchema = z.object({
  label: z.string().min(1).max(200),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  currency: z.preprocess(
    blankToUndefined,
    z.string().length(3).toUpperCase().optional(),
  ),
  unit: z.preprocess(blankToUndefined, z.string().max(60).optional()),
  note: z.preprocess(blankToUndefined, z.string().max(500).optional()),
});

const priceSourceSchema = z.object({
  label: z.string().min(1).max(200),
  url: z.string().url().optional().or(z.literal("")),
});

const costPageSchema = z
  .object({
    heading: z.preprocess(blankToUndefined, z.string().max(200).optional()),
    intro: z.preprocess(blankToUndefined, z.string().max(2000).optional()),
    introEmpty: z.preprocess(blankToUndefined, z.string().max(2000).optional()),
    items: z.array(priceItemSchema).default([]),
    includes: z.array(z.string().max(300)).default([]),
    excludes: z.array(z.string().max(300)).default([]),
    insuranceNote: z.preprocess(
      blankToUndefined,
      z.string().max(1000).optional(),
    ),
    financingNote: z.preprocess(
      blankToUndefined,
      z.string().max(1000).optional(),
    ),
    bodyMarkdown: z.preprocess(
      blankToUndefined,
      z.string().max(20_000).optional(),
    ),
    faqs: z.array(faqSchema).default([]),
    sources: z.array(priceSourceSchema).default([]),
    // The form submits `""` for "not set"; `z.coerce.date()` would turn that
    // into an Invalid Date, so blank it out before coercion.
    lastVerifiedAt: z.preprocess(blankToUndefined, z.coerce.date().nullish()),
    ctaHeading: z.preprocess(blankToUndefined, z.string().max(200).optional()),
    ctaBody: z.preprocess(blankToUndefined, z.string().max(1000).optional()),
    seo: seoSchema.optional(),
  })
  .partial();

/**
 * Third-party reception (Google listing + Reddit discussion).
 *
 * All-optional throughout, and that is load-bearing rather than lazy: the
 * research that fills this in frequently comes back with a Google rating and no
 * Reddit thread, or a Reddit thread and no listing. Requiring either branch
 * would push whoever is importing toward inventing the missing half.
 *
 * `rating` is capped at 5 to match Google's scale, and `reviewCount` is an
 * integer because a fractional count means the number was guessed.
 */
const externalSourceSchema = z.object({
  label: z.string().min(1).max(200),
  url: z.string().url().optional().or(z.literal("")),
});

const externalReviewSummarySchema = z
  .object({
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().int().min(0).optional(),
    summary: z.preprocess(blankToUndefined, z.string().max(1200).optional()),
    themes: z.array(z.string().max(80)).default([]),
    url: z.string().url().optional().or(z.literal("")),
    checkedAt: z.preprocess(blankToUndefined, z.coerce.date().nullish()),
  })
  .partial();

const redditDiscussionSchema = z
  .object({
    summary: z.preprocess(blankToUndefined, z.string().max(1200).optional()),
    threadCount: z.number().int().min(0).optional(),
    sentiment: z.enum(EXTERNAL_SENTIMENTS).optional(),
    themes: z.array(z.string().max(80)).default([]),
    sources: z.array(externalSourceSchema).default([]),
    checkedAt: z.preprocess(blankToUndefined, z.coerce.date().nullish()),
  })
  .partial();

const externalReviewsSchema = z
  .object({
    google: externalReviewSummarySchema.optional(),
    reddit: redditDiscussionSchema.optional(),
  })
  .partial();

const clinicObjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: slugSchema,
  status: z.enum(CLINIC_STATUSES).default("draft"),
  tier: z.enum(CLINIC_TIERS).default("basic"),
  verification: verificationSchema.default({ isVerified: false }),
  tagline: z.string().max(200).optional(),
  description: z.string().optional(),
  logo: imageSchema.optional(),
  coverImage: imageSchema.optional(),
  gallery: z.array(imageSchema).default([]),
  videoUrl: z.string().url().optional().or(z.literal("")),

  treatmentTypes: z.array(objectIdSchema).default([]),
  conditionsTreated: z.array(objectIdSchema).default([]),
  cellSources: z.array(objectIdSchema).default([]),
  serviceFocus: z.array(serviceFocusSchema).default([]),
  accreditations: z.array(objectIdSchema).default([]),

  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  currency: currencySchema,
  priceModel: z.enum(PRICE_MODELS).optional(),
  priceNote: z.string().max(500).optional(),

  foundedYear: z.number().int().min(1800).max(2200).optional(),
  teamSize: z.enum(TEAM_SIZES).optional(),
  physiciansCount: z.number().int().min(0).optional(),
  medicalDirector: personSchema.optional(),
  team: z.array(personSchema).default([]),
  languages: z.array(z.string().max(60)).default([]),

  locations: z
    .array(clinicLocationSchema)
    .min(1, "At least one location is required"),

  website: z.string().url().optional().or(z.literal("")),
  social: socialSchema.default({}),
  contactEmail: z.string().email().optional().or(z.literal("")),

  caseStudies: z.array(caseStudySchema).default([]),
  faqs: z.array(faqSchema).default([]),
  highlights: z.array(z.string().max(200)).default([]),

  ownerUserId: objectIdSchema.nullish(),
  isClaimed: z.boolean().default(false),
  seo: seoSchema.optional(),
  reviewsPage: reviewsPageSchema.optional(),
  costPage: costPageSchema.optional(),
  externalReviews: externalReviewsSchema.optional(),
});

// Cross-field invariants shared by create + update.
const priceOrderOk = (c: { priceMin?: number; priceMax?: number }) =>
  c.priceMax == null || c.priceMin == null || c.priceMax >= c.priceMin;
/** Same rule, applied row by row to the cost page's price table. */
const costRowsOk = (c: {
  costPage?: { items?: { priceMin?: number; priceMax?: number }[] };
}) => (c.costPage?.items ?? []).every(priceOrderOk);
const focusSumOk = (c: { serviceFocus?: { percent: number }[] }) =>
  (c.serviceFocus ?? []).reduce((sum, f) => sum + f.percent, 0) <= 100;

export const clinicCreateSchema = clinicObjectSchema
  .refine(priceOrderOk, {
    message: "priceMax must be ≥ priceMin",
    path: ["priceMax"],
  })
  .refine(costRowsOk, {
    message: "Each cost row's max price must be ≥ its min price",
    path: ["costPage", "items"],
  })
  .refine(focusSumOk, {
    message: "Service focus percentages cannot exceed 100%",
    path: ["serviceFocus"],
  });

/** Partial for PATCH/edit + draft saves (relaxes the create-time requirements). */
export const clinicUpdateSchema = clinicObjectSchema
  .partial()
  .refine(priceOrderOk, {
    message: "priceMax must be ≥ priceMin",
    path: ["priceMax"],
  })
  .refine(costRowsOk, {
    message: "Each cost row's max price must be ≥ its min price",
    path: ["costPage", "items"],
  })
  .refine(focusSumOk, {
    message: "Service focus percentages cannot exceed 100%",
    path: ["serviceFocus"],
  });

export type ClinicInput = z.infer<typeof clinicCreateSchema>;
export type ClinicUpdateInput = z.infer<typeof clinicUpdateSchema>;
