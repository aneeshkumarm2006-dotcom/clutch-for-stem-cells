/**
 * ClinicLanding validation — the curated `/clinics/{slug}` landing pages.
 *
 * Create requires the identity fields; update is the same shape made partial,
 * matching the PATCH semantics every other admin form uses.
 */
import { z } from "zod";

import { faqInputSchema } from "@/lib/validation/taxonomy";
import { imageSchema, seoSchema, slugSchema } from "@/lib/validation/common";

const filtersSchema = z
  .object({
    country: z.string().max(120),
    region: z.string().max(120),
    city: z.string().max(120),
    treatments: z.array(z.string().min(1).max(120)).max(25),
    conditions: z.array(z.string().min(1).max(120)).max(25),
  })
  .partial();

export const clinicLandingCreateSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(200),
  heading: z.string().max(200).optional(),
  intro: z.string().max(2000).optional(),
  image: imageSchema.optional(),
  filters: filtersSchema.optional(),
  seo: seoSchema.optional(),
  faqs: z.array(faqInputSchema).max(25).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const clinicLandingUpdateSchema = clinicLandingCreateSchema.partial();

export type ClinicLandingCreateInput = z.infer<typeof clinicLandingCreateSchema>;
export type ClinicLandingUpdateInput = z.infer<typeof clinicLandingUpdateSchema>;
