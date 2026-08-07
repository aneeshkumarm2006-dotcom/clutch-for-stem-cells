/**
 * Page-content overlay — the write contract for `/api/admin/page-content`.
 *
 * Every field is optional: the form posts what it holds, and an absent key is
 * left untouched. Blank strings are kept rather than stripped, because a blank
 * is how an editor says "go back to the shipped copy" — the resolver
 * (`lib/page-content.ts`) is what turns that into the default, not this schema.
 */
import { z } from "zod";

import { blocksSchema } from "@/lib/validation/block";

export const pageContentUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  /** Inline HTML so a lead can carry a link. Sanitized server-side on save. */
  lead: z.string().max(2_000).optional(),
  updated: z.string().max(120).optional(),
  legalReview: z.boolean().nullable().optional(),
  blocks: blocksSchema.optional(),
  blocksAfter: blocksSchema.optional(),
  extras: z.record(z.string().max(4_000)).optional(),
});

export type PageContentUpdateInput = z.infer<typeof pageContentUpdateSchema>;
