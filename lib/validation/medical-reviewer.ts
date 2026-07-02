/**
 * MedicalReviewer validation — the credentialed people who medically review
 * YMYL content. `sameAs` links should point at authoritative profiles (a
 * medical registry, ORCID, LinkedIn) for E-E-A-T.
 */
import { z } from "zod";

import { imageSchema, slugSchema } from "@/lib/validation/common";

export const medicalReviewerCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  slug: slugSchema,
  credentials: z.string().max(120).optional(),
  title: z.string().max(160).optional(),
  bio: z.string().optional(),
  photo: imageSchema.optional(),
  sameAs: z.array(z.string().max(500)).default([]),
  isActive: z.boolean().default(true),
});

export const medicalReviewerUpdateSchema =
  medicalReviewerCreateSchema.partial();

export type MedicalReviewerInput = z.infer<typeof medicalReviewerCreateSchema>;
