/**
 * Page-content overlay — the write contract for `/api/admin/page-content`.
 *
 * Every field is optional: the form posts what it holds, and an absent key is
 * left untouched. Blank strings are kept rather than stripped, because a blank
 * is how an editor says "go back to the shipped copy" — the resolver
 * (`lib/page-content.ts`) is what turns that into the default, not this schema.
 *
 * `seo` is the exception to the storage rule: it does not live on the
 * `PageContent` document at all. The route writes it into the row for this path
 * in `SiteSetting.pageSeo`, the same store `/admin/seo` owns, so a fixed page
 * has one title tag no matter which screen edits it. Its blanks *are* stripped
 * (the shared `seoSchema` preprocesses them to `undefined`), because a cleared
 * meta field is a deleted override rather than an empty string to store.
 */
import { z } from "zod";

import { blocksSchema } from "@/lib/validation/block";
import { seoSchema } from "@/lib/validation/common";

export const pageContentUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  /** Inline HTML so a lead can carry a link. Sanitized server-side on save. */
  lead: z.string().max(2_000).optional(),
  updated: z.string().max(120).optional(),
  legalReview: z.boolean().nullable().optional(),
  blocks: blocksSchema.optional(),
  blocksAfter: blocksSchema.optional(),
  extras: z.record(z.string().max(4_000)).optional(),
  /** Meta for this route, merged into `SiteSetting.pageSeo` — not `PageContent`. */
  seo: seoSchema.optional(),
});

export type PageContentUpdateInput = z.infer<typeof pageContentUpdateSchema>;
