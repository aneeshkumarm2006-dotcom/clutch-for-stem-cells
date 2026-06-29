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
  PRICE_MODELS,
  TEAM_SIZES,
  VERIFICATION_BADGES,
} from "@/lib/enums";
import {
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
  countryCode: z.string().length(2).toUpperCase().optional(),
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
});

// Cross-field invariants shared by create + update.
const priceOrderOk = (c: { priceMin?: number; priceMax?: number }) =>
  c.priceMax == null || c.priceMin == null || c.priceMax >= c.priceMin;
const focusSumOk = (c: { serviceFocus?: { percent: number }[] }) =>
  (c.serviceFocus ?? []).reduce((sum, f) => sum + f.percent, 0) <= 100;

export const clinicCreateSchema = clinicObjectSchema
  .refine(priceOrderOk, {
    message: "priceMax must be ≥ priceMin",
    path: ["priceMax"],
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
  .refine(focusSumOk, {
    message: "Service focus percentages cannot exceed 100%",
    path: ["serviceFocus"],
  });

export type ClinicInput = z.infer<typeof clinicCreateSchema>;
export type ClinicUpdateInput = z.infer<typeof clinicUpdateSchema>;
