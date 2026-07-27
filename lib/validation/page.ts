/**
 * Page validation — the block-composed page authored in /seoteam.
 *
 * Mirrors the MatrixPage convention: a `create` schema plus a `.partial()`
 * `update`. `contentFlags` is computed server-side by the review gate and is
 * never accepted as input.
 */
import { z } from "zod";

import { CONTENT_REVIEW_STATUSES } from "@/lib/enums";
import { blocksSchema } from "@/lib/validation/block";
import {
  objectIdSchema,
  pathSlugSchema,
  schemaOverrideSchema,
  seoSchema,
} from "@/lib/validation/common";

export const pageCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: pathSlugSchema,
  intro: z.string().max(1000).optional(),
  blocks: blocksSchema,
  seo: seoSchema.optional(),
  schemaOverrides: schemaOverrideSchema.optional(),
  reviewStatus: z.enum(CONTENT_REVIEW_STATUSES).default("draft"),
  reviewedBy: objectIdSchema.nullish(),
  lastReviewedAt: z.coerce.date().nullish(),
  flagsAcknowledged: z.boolean().default(false),
});

/** Update may change the slug (a redirect should be recorded when it does). */
export const pageUpdateSchema = pageCreateSchema.partial();

export type PageInput = z.infer<typeof pageCreateSchema>;
