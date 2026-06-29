/**
 * Taxonomy validation (PRD §5.3 / Stage 1.10) — Treatment, Condition,
 * CellSource, Accreditation, Location. `clinicCount` is computed server-side
 * and excluded from input.
 */
import { z } from "zod";
import { LOCATION_KINDS } from "@/lib/enums";
import {
  imageSchema,
  objectIdSchema,
  seoSchema,
  slugSchema,
} from "@/lib/validation/common";

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
};

export const treatmentCreateSchema = z.object({
  ...taxonomyBase,
  category: z.string().max(120).optional(),
});
export const treatmentUpdateSchema = treatmentCreateSchema.partial();

export const conditionCreateSchema = z.object({
  ...taxonomyBase,
  category: z.string().max(120).optional(),
});
export const conditionUpdateSchema = conditionCreateSchema.partial();

export const cellSourceCreateSchema = z.object({ ...taxonomyBase });
export const cellSourceUpdateSchema = cellSourceCreateSchema.partial();

export const accreditationCreateSchema = z.object({
  ...taxonomyBase,
  issuingBody: z.string().max(200).optional(),
});
export const accreditationUpdateSchema = accreditationCreateSchema.partial();

export const locationCreateSchema = z.object({
  ...taxonomyBase,
  kind: z.enum(LOCATION_KINDS).default("country"),
  countryCode: z.string().length(2).toUpperCase().optional(),
  region: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  flag: z.string().max(16).optional(),
});
export const locationUpdateSchema = locationCreateSchema.partial();

export type TreatmentInput = z.infer<typeof treatmentCreateSchema>;
export type ConditionInput = z.infer<typeof conditionCreateSchema>;
export type CellSourceInput = z.infer<typeof cellSourceCreateSchema>;
export type AccreditationInput = z.infer<typeof accreditationCreateSchema>;
export type LocationInput = z.infer<typeof locationCreateSchema>;
