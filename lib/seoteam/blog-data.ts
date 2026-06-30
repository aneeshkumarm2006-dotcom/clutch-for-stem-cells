/**
 * Blog data-access layer (server-only) — read helpers for the public /blog
 * pages and the /seoteam dashboard. Returns plain, serializable view models so
 * no Mongoose docs cross the server/client boundary (mirrors lib/public-data.ts).
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { estimateReadingTime } from "@/lib/reading-time";
import { htmlToText, runSeoChecks, seoReadiness } from "@/lib/seoteam/seo-checks";
import { BlogPost, type IBlogPost } from "@/models";
import type { KeywordRel } from "@/lib/enums";

const id = (v: unknown): string => String(v);
const iso = (d?: Date | null): string | undefined =>
  d ? new Date(d).toISOString() : undefined;

export const BLOG_PAGE_SIZE = 9;

const publishedFilter = {
  status: "published",
  publishedAt: { $ne: null },
} as const;

// ── View models ──────────────────────────────────────────────────────────────

export interface BlogCardView {
  slug: string;
  title: string;
  excerpt?: string;
  coverUrl?: string;
  coverAlt?: string;
  author?: string;
  publishedAt?: string;
  readingTime?: number;
}

export interface BlogKeywordView {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

export interface BlogPostView extends BlogCardView {
  body: string;
  metaTitle?: string;
  updatedAt?: string;
  keywords: BlogKeywordView[];
  linkFirstOnly: boolean;
}

function readingTimeOf(p: IBlogPost): number {
  return p.readingTime ?? estimateReadingTime(htmlToText(p.body ?? ""));
}

function toCard(p: IBlogPost): BlogCardView {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverUrl: p.coverImage?.url,
    coverAlt: p.coverImage?.alt,
    author: p.author,
    publishedAt: iso(p.publishedAt ?? null),
    readingTime: readingTimeOf(p),
  };
}

// ── Public reads ─────────────────────────────────────────────────────────────

export interface BlogIndexPage {
  posts: BlogCardView[];
  total: number;
  page: number;
  pageCount: number;
}

export async function getPublishedBlogPosts(
  opts: { page?: number } = {},
): Promise<BlogIndexPage> {
  await dbConnect();
  const page = Math.max(1, opts.page ?? 1);
  const [docs, total] = await Promise.all([
    BlogPost.find(publishedFilter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * BLOG_PAGE_SIZE)
      .limit(BLOG_PAGE_SIZE)
      .lean<IBlogPost[]>(),
    BlogPost.countDocuments(publishedFilter),
  ]);
  return {
    posts: docs.map(toCard),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)),
  };
}

export async function getBlogPostBySlug(
  slug: string,
): Promise<BlogPostView | null> {
  await dbConnect();
  const p = await BlogPost.findOne({ slug, ...publishedFilter }).lean<IBlogPost>();
  if (!p) return null;
  return {
    ...toCard(p),
    body: p.body ?? "",
    metaTitle: p.metaTitle,
    updatedAt: iso(p.updatedAt),
    linkFirstOnly: p.linkFirstOnly ?? true,
    keywords: (p.keywords ?? []).map((k) => ({
      keyword: k.keyword,
      url: k.url,
      rel: k.rel,
    })),
  };
}

export async function getPublishedBlogSlugs(): Promise<string[]> {
  await dbConnect();
  const docs = await BlogPost.find(publishedFilter).select("slug").lean();
  return docs.map((d) => d.slug);
}

export interface BlogSitemapEntry {
  path: string;
  lastModified?: Date;
}

export async function getBlogSitemapEntries(): Promise<BlogSitemapEntry[]> {
  await dbConnect();
  const docs = await BlogPost.find(publishedFilter)
    .select("slug updatedAt publishedAt")
    .lean();
  return docs.map((d) => ({
    path: `/blog/${d.slug}`,
    lastModified: d.updatedAt ?? d.publishedAt ?? undefined,
  }));
}

/** Fire-and-forget view increment (called by the public beacon route). */
export async function incrementBlogViews(slug: string): Promise<void> {
  await dbConnect();
  await BlogPost.updateOne({ slug, ...publishedFilter }, { $inc: { views: 1 } });
}

// ── Dashboard reads ──────────────────────────────────────────────────────────

export interface BlogAdminRow {
  id: string;
  title: string;
  slug: string;
  status: IBlogPost["status"];
  publishedAt?: string;
  updatedAt?: string;
  views: number;
  readingTime: number;
  seo: { ready: boolean; pass: number; warn: number; fail: number };
}

export async function getAdminBlogPosts(opts: {
  q?: string;
  status?: "draft" | "published";
} = {}): Promise<BlogAdminRow[]> {
  await dbConnect();
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.q?.trim()) filter.title = { $regex: escapeRegex(opts.q.trim()), $options: "i" };

  const docs = await BlogPost.find(filter)
    .sort({ updatedAt: -1 })
    .lean<IBlogPost[]>();

  return docs.map((p) => {
    const checks = runSeoChecks({
      title: p.title,
      metaTitle: p.metaTitle,
      excerpt: p.excerpt,
      body: p.body ?? "",
      keywords: p.keywords ?? [],
      coverImage: p.coverImage,
    });
    return {
      id: id(p._id),
      title: p.title,
      slug: p.slug,
      status: p.status,
      publishedAt: iso(p.publishedAt ?? null),
      updatedAt: iso(p.updatedAt),
      views: p.views ?? 0,
      readingTime: readingTimeOf(p),
      seo: seoReadiness(checks),
    };
  });
}

export interface BlogEditView {
  id: string;
  title: string;
  slug: string;
  template: IBlogPost["template"];
  status: IBlogPost["status"];
  body: string;
  excerpt?: string;
  metaTitle?: string;
  coverImage?: { url: string; alt?: string };
  keywords: BlogKeywordView[];
  linkFirstOnly: boolean;
  author?: string;
  views: number;
  publishedAt?: string;
}

export async function getBlogPostForEdit(
  postId: string,
): Promise<BlogEditView | null> {
  await dbConnect();
  if (!/^[a-f\d]{24}$/i.test(postId)) return null;
  const p = await BlogPost.findById(postId).lean<IBlogPost>();
  if (!p) return null;
  return {
    id: id(p._id),
    title: p.title,
    slug: p.slug,
    template: p.template,
    status: p.status,
    body: p.body ?? "",
    excerpt: p.excerpt,
    metaTitle: p.metaTitle,
    coverImage: p.coverImage?.url
      ? { url: p.coverImage.url, alt: p.coverImage.alt }
      : undefined,
    keywords: (p.keywords ?? []).map((k) => ({
      keyword: k.keyword,
      url: k.url,
      rel: k.rel,
    })),
    linkFirstOnly: p.linkFirstOnly ?? true,
    author: p.author,
    views: p.views ?? 0,
    publishedAt: iso(p.publishedAt ?? null),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
