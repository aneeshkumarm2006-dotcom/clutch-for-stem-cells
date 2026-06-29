/**
 * Articles (blog/education CMS) read-layer (PRD §8.6 / Stage 6.8).
 */
import "server-only";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import {
  id,
  iso,
  paginate,
  serializeImage,
  type Paginated,
} from "@/lib/admin/serialize";
import { Article } from "@/models";
import type { IArticle } from "@/models";
import type { ArticleStatus } from "@/lib/enums";

export interface AdminArticleRow {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  category?: string;
  author?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface ArticlesQuery {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getAdminArticles(
  query: ArticlesQuery = {},
): Promise<Paginated<AdminArticleRow> & { counts: Record<string, number> }> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const filter: FilterQuery<IArticle> = { isDeleted: false };
  if (query.status && query.status !== "all") {
    filter.status = query.status as ArticleStatus;
  }
  if (query.q) filter.title = new RegExp(escapeRegex(query.q), "i");

  const [docs, total, countsAgg] = await Promise.all([
    Article.find(filter)
      .select("title slug status categories author updatedAt publishedAt")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Article.countDocuments(filter),
    Article.aggregate<{ _id: ArticleStatus; count: number }>([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const rows: AdminArticleRow[] = docs.map((a) => ({
    id: id(a._id),
    title: a.title,
    slug: a.slug,
    status: a.status,
    category: a.categories?.[0],
    author: a.author?.name,
    updatedAt: iso(a.updatedAt),
    publishedAt: iso(a.publishedAt),
  }));

  const counts: Record<string, number> = { all: 0 };
  for (const row of countsAgg) {
    counts[row._id] = row.count;
    counts.all += row.count;
  }

  return { ...paginate(rows, total, page, pageSize), counts };
}

export interface ArticleFormData {
  id: string;
  values: Record<string, unknown>;
}

export async function getAdminArticleFormData(
  articleId: string,
): Promise<ArticleFormData | null> {
  await dbConnect();
  const a = await Article.findById(articleId).lean();
  if (!a) return null;

  return {
    id: id(a._id),
    values: {
      title: a.title,
      slug: a.slug,
      status: a.status,
      excerpt: a.excerpt ?? "",
      body: a.body ?? "",
      coverImage: serializeImage(a.coverImage),
      author: {
        name: a.author?.name ?? "",
        bio: a.author?.bio ?? "",
        avatar: serializeImage(a.author?.avatar),
      },
      categories: a.categories ?? [],
      tags: a.tags ?? [],
      relatedConditionIds: (a.relatedConditionIds ?? []).map(id),
      relatedTreatmentIds: (a.relatedTreatmentIds ?? []).map(id),
      readingTime: a.readingTime,
      publishedAt: iso(a.publishedAt),
      seo: a.seo
        ? {
            metaTitle: a.seo.metaTitle ?? "",
            metaDescription: a.seo.metaDescription ?? "",
            ogImage: a.seo.ogImage ?? "",
            canonicalUrl: a.seo.canonicalUrl ?? "",
            noindex: a.seo.noindex ?? false,
          }
        : undefined,
    },
  };
}
