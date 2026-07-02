/**
 * MatrixPage validation — the combination-content record authored in /seoteam.
 * Reuses the editorial faq/keyFact input schemas from the taxonomy validation.
 * `contentFlags` is computed server-side (scanner) and never accepted as input.
 */
import { z } from "zod";

import { CONTENT_REVIEW_STATUSES, MATRIX_KINDS } from "@/lib/enums";
import { objectIdSchema, seoSchema, slugSchema } from "@/lib/validation/common";
import { faqInputSchema, keyFactInputSchema } from "@/lib/validation/taxonomy";

export const matrixPageCreateSchema = z.object({
  kind: z.enum(MATRIX_KINDS),
  slugA: slugSchema,
  slugB: slugSchema,
  title: z.string().min(1, "Title is required").max(200),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(320).optional(),
  seo: seoSchema.optional(),
  intro: z.string().max(1000).optional(),
  body: z.string().default(""),
  faqs: z.array(faqInputSchema).default([]),
  keyFacts: z.array(keyFactInputSchema).default([]),
  reviewStatus: z.enum(CONTENT_REVIEW_STATUSES).default("draft"),
  reviewedBy: objectIdSchema.nullish(),
  lastReviewedAt: z.coerce.date().nullish(),
  flagsAcknowledged: z.boolean().default(false),
});

/** Update leaves the combination identity (kind/slugA/slugB) immutable. */
export const matrixPageUpdateSchema = matrixPageCreateSchema
  .omit({ kind: true, slugA: true, slugB: true })
  .partial();

export type MatrixPageInput = z.infer<typeof matrixPageCreateSchema>;
