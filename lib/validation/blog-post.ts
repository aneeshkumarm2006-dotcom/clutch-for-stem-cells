/**
 * BlogPost validation — /seoteam editor → /api/seoteam/posts.
 *
 * Mongoose-free (ships to the client editor). Composes the shared slug/image
 * primitives and the blog enums so the model, API, and form stay in lockstep.
 */
import { z } from "zod";

import {
  BLOG_POST_STATUSES,
  BLOG_TEMPLATE_KEYS,
  KEYWORD_RELS,
} from "@/lib/enums";
import { imageSchema, mediaUrlSchema, slugSchema } from "@/lib/validation/common";

/** A keyword backlink. `url` accepts absolute http(s) or a root-relative path. */
export const blogKeywordSchema = z.object({
  keyword: z.string().min(1, "Keyword is required").max(120),
  url: mediaUrlSchema,
  rel: z.enum(KEYWORD_RELS).default("dofollow"),
});

export const blogPostCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: slugSchema,
  template: z.enum(BLOG_TEMPLATE_KEYS).default("generic"),
  status: z.enum(BLOG_POST_STATUSES).default("draft"),
  body: z.string().max(200_000).default(""),
  excerpt: z.string().max(500).optional(),
  metaTitle: z.string().max(120).optional(),
  // Nullable so the editor can clear an existing cover (send `null`).
  coverImage: imageSchema.nullish(),
  keywords: z.array(blogKeywordSchema).max(50).default([]),
  linkFirstOnly: z.boolean().default(true),
  author: z.string().max(160).optional(),
});

export const blogPostUpdateSchema = blogPostCreateSchema.partial();

export type BlogPostInput = z.infer<typeof blogPostCreateSchema>;
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdateSchema>;
export type BlogKeywordInput = z.infer<typeof blogKeywordSchema>;
