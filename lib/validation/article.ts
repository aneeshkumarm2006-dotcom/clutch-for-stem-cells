/**
 * Article validation (PRD §5.5 / Stage 1.10) — blog/education hub CMS (§8.6).
 */
import { z } from "zod";
import { ARTICLE_STATUSES } from "@/lib/enums";
import {
  imageSchema,
  objectIdSchema,
  seoSchema,
  slugSchema,
} from "@/lib/validation/common";

const articleAuthorSchema = z.object({
  name: z.string().min(1).max(160),
  avatar: imageSchema.optional(),
  bio: z.string().max(2000).optional(),
});

export const articleCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: slugSchema,
  status: z.enum(ARTICLE_STATUSES).default("draft"),
  excerpt: z.string().max(500).optional(),
  body: z.string().optional(),
  coverImage: imageSchema.optional(),
  author: articleAuthorSchema.optional(),
  categories: z.array(z.string().max(80)).default([]),
  tags: z.array(z.string().max(80)).default([]),
  relatedConditionIds: z.array(objectIdSchema).default([]),
  relatedTreatmentIds: z.array(objectIdSchema).default([]),
  readingTime: z.number().int().min(0).optional(),
  publishedAt: z.coerce.date().nullish(),
  seo: seoSchema.optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export type ArticleInput = z.infer<typeof articleCreateSchema>;
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;
