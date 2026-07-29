/**
 * Taxonomy validation (PRD §5.3 / Stage 1.10) — Treatment, Condition,
 * CellSource, Accreditation, Location. `clinicCount` is computed server-side
 * and excluded from input.
 */
import { z } from "zod";
import {
  CONTENT_REVIEW_STATUSES,
  EVIDENCE_LEVELS,
  LOCATION_KINDS,
} from "@/lib/enums";
import { blocksSchema } from "@/lib/validation/block";
import {
  imageSchema,
  objectIdSchema,
  seoSchema,
  slugSchema,
} from "@/lib/validation/common";

/** One scoped Q&A pair (editorial `faqs`). */
export const faqInputSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
});

/** One sourced key fact (editorial `keyFacts`). */
export const keyFactInputSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(400),
  sourceUrl: z.string().max(500).optional(),
});

/**
 * Editorial + review-gate fields shared by every taxonomy kind (mirrors the
 * model's `editorialFields`). `contentFlags` is computed server-side from
 * `scanContentFlags`, so — like `clinicCount` — it is NOT accepted as input.
 */
const editorialBase = {
  body: z.string().optional(),
  /** The modular section builder. HTML inside blocks is sanitized on write. */
  blocks: blocksSchema,
  faqs: z.array(faqInputSchema).default([]),
  keyFacts: z.array(keyFactInputSchema).default([]),
  reviewStatus: z.enum(CONTENT_REVIEW_STATUSES).default("draft"),
  reviewedBy: objectIdSchema.nullish(),
  lastReviewedAt: z.coerce.date().nullish(),
  flagsAcknowledged: z.boolean().default(false),
};

const taxonomyBase = {
  name: z.string().min(1, "Name is required").max(160),
  slug: slugSchema,
  description: z.string().optional(),
  shortDescription: z.string().max(400).optional(),
  icon: z.string().max(80).optional(),
  image: imageSchema.optional(),
  seo: seoSchema.optional(),
  parentId: objectIdSchema.nullish(),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
  ...editorialBase,
};

export const treatmentCreateSchema = z.object({
  ...taxonomyBase,
  category: z.string().max(120).optional(),
  mechanism: z.string().optional(),
  evidenceLevel: z.enum(EVIDENCE_LEVELS).optional(),
  evidenceSummary: z.string().optional(),
  costRange: z.string().optional(),
  recoveryTimeline: z.string().optional(),
  risks: z.string().optional(),
});
export const treatmentUpdateSchema = treatmentCreateSchema.partial();

export const conditionCreateSchema = z.object({
  ...taxonomyBase,
  category: z.string().max(120).optional(),
  overview: z.string().optional(),
  standardOfCare: z.string().optional(),
  evidenceForCellTherapy: z.string().optional(),
  symptoms: z.array(z.string().max(120)).default([]),
});
export const conditionUpdateSchema = conditionCreateSchema.partial();

export const cellSourceCreateSchema = z.object({ ...taxonomyBase });
export const cellSourceUpdateSchema = cellSourceCreateSchema.partial();

export const accreditationCreateSchema = z.object({
  ...taxonomyBase,
  issuingBody: z.string().max(200).optional(),
});
export const accreditationUpdateSchema = accreditationCreateSchema.partial();

/**
 * Location slugs that would collide with the static combination-page folders
 * nested under `/locations/[country]/` (see `app/(public)/locations/[country]/
 * {treatments,conditions}/`). A country or city with one of these slugs would
 * shadow those routes, so they're reserved.
 */
const RESERVED_LOCATION_SLUGS = new Set(["treatments", "conditions"]);

const reservedSlugError = {
  message: "This slug is reserved by the destination page routing.",
  path: ["slug"],
};

const locationObject = z.object({
  ...taxonomyBase,
  kind: z.enum(LOCATION_KINDS).default("country"),
  countryCode: z.string().length(2).toUpperCase().optional(),
  region: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  flag: z.string().max(16).optional(),
  regulatoryStatus: z.string().optional(),
  logistics: z.string().optional(),
  travelNotes: z.string().optional(),
});

export const locationCreateSchema = locationObject.refine(
  (v) => !RESERVED_LOCATION_SLUGS.has(v.slug),
  reservedSlugError,
);
export const locationUpdateSchema = locationObject
  .partial()
  .refine(
    (v) => v.slug == null || !RESERVED_LOCATION_SLUGS.has(v.slug),
    reservedSlugError,
  );

export type TreatmentInput = z.infer<typeof treatmentCreateSchema>;
export type ConditionInput = z.infer<typeof conditionCreateSchema>;
export type CellSourceInput = z.infer<typeof cellSourceCreateSchema>;
export type AccreditationInput = z.infer<typeof accreditationCreateSchema>;
export type LocationInput = z.infer<typeof locationCreateSchema>;
