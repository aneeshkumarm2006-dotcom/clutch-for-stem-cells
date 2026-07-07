/**
 * Blog data-access layer (server-only) — read helpers for the public /blog
 * pages and the /seoteam dashboard. Returns plain, serializable view models so
 * no Mongoose docs cross the server/client boundary (mirrors lib/public-data.ts).
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { estimateReadingTime } from "@/lib/reading-time";
import { htmlToText, runSeoChecks, seoReadiness } from "@/lib/seoteam/seo-checks";
import { loadReviewerByline } from "@/lib/public-data";
import { DEFAULT_BLOG_AUTHOR } from "@/lib/seoteam/blog-constants";
import { BlogPost, type IBlogPost } from "@/models";
import type { ReviewerByline } from "@/components/content/reviewed-by-byline";
import type { KeywordRel } from "@/lib/enums";

const id = (v: unknown): string => String(v);
const iso = (d?: Date | null): string | undefined =>
  d ? new Date(d).toISOString() : undefined;

export const BLOG_PAGE_SIZE = 9;

/**
 * Public-visibility gate — shared by EVERY public blog read (index, single,
 * generateStaticParams, sitemap, view beacon). A post is public only when it is
 * `published` AND its `publishedAt` is in the past. A future `publishedAt`
 * therefore models a *scheduled* post: invisible until its time, then it appears
 * automatically on the next ISR revalidation (no cron). Built per-call so `now`
 * is fresh; `$lte:<Date>` also excludes null/missing via BSON type-bracketing,
 * so the `$ne:null` is belt-and-braces for legacy rows.
 */
function publishedFilter() {
  return {
    status: "published",
    publishedAt: { $ne: null, $lte: new Date() },
  } as const;
}

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
  /** Credentialed medical reviewer (null until one is assigned in the CMS). */
  reviewer: ReviewerByline | null;
  /** ISO date the reviewer last signed off (drives the "Last reviewed" byline). */
  lastReviewedAt?: string;
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
    // Posts with no explicit human author show the site's editorial team.
    author: p.author?.trim() || DEFAULT_BLOG_AUTHOR,
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
  const filter = publishedFilter();
  const [docs, total] = await Promise.all([
    BlogPost.find(filter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * BLOG_PAGE_SIZE)
      .limit(BLOG_PAGE_SIZE)
      .lean<IBlogPost[]>(),
    BlogPost.countDocuments(filter),
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
  const p = await BlogPost.findOne({
    slug,
    ...publishedFilter(),
  }).lean<IBlogPost>();
  if (!p) return null;
  return toPostView(p);
}

/**
 * Shared BlogPostView mapping (used by the public slug read + preview read).
 * Async because it resolves the (active) medical reviewer for the byline/schema;
 * `loadReviewerByline` returns null for an unset or deactivated reviewer, so the
 * attribution stays hidden until a real one is assigned.
 */
async function toPostView(p: IBlogPost): Promise<BlogPostView> {
  return {
    ...toCard(p),
    body: p.body ?? "",
    metaTitle: p.metaTitle,
    updatedAt: iso(p.updatedAt),
    linkFirstOnly: p.linkFirstOnly ?? true,
    reviewer: await loadReviewerByline(p.reviewedBy),
    lastReviewedAt: iso(p.lastReviewedAt ?? null),
    keywords: (p.keywords ?? []).map((k) => ({
      keyword: k.keyword,
      url: k.url,
      rel: k.rel,
    })),
  };
}

/**
 * Preview read for /seoteam/preview/[id] — fetches a post by id **regardless of
 * status or publish date** (drafts + scheduled included). Access is gated by the
 * /seoteam auth guard, NOT by this query, so it deliberately skips
 * `publishedFilter()`. Returns the same shape as the public slug read.
 */
export async function getBlogPostForPreview(
  postId: string,
): Promise<BlogPostView | null> {
  await dbConnect();
  if (!/^[a-f\d]{24}$/i.test(postId)) return null;
  const p = await BlogPost.findById(postId).lean<IBlogPost>();
  if (!p) return null;
  return toPostView(p);
}

/** Active reviewers as picker options for the blog editor (id/name/credentials). */
export { getReviewerOptions } from "@/lib/seoteam/reviewer-data";

export async function getPublishedBlogSlugs(): Promise<string[]> {
  await dbConnect();
  const docs = await BlogPost.find(publishedFilter()).select("slug").lean();
  return docs.map((d) => d.slug);
}

export interface BlogSitemapEntry {
  path: string;
  lastModified?: Date;
}

export async function getBlogSitemapEntries(): Promise<BlogSitemapEntry[]> {
  await dbConnect();
  const docs = await BlogPost.find(publishedFilter())
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
  await BlogPost.updateOne(
    { slug, ...publishedFilter() },
    { $inc: { views: 1 } },
  );
}

// ── Dashboard reads ──────────────────────────────────────────────────────────

export interface BlogAdminRow {
  id: string;
  title: string;
  slug: string;
  status: IBlogPost["status"];
  /** `published` with a future `publishedAt` — hidden on /blog until its time. */
  scheduled: boolean;
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

  const now = Date.now();
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
      scheduled:
        p.status === "published" &&
        !!p.publishedAt &&
        new Date(p.publishedAt).getTime() > now,
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
  /** Raw reviewer id (empty when none) for the editor's picker. */
  reviewedBy?: string;
  /** ISO date the reviewer last signed off. */
  lastReviewedAt?: string;
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
    reviewedBy: p.reviewedBy ? id(p.reviewedBy) : undefined,
    lastReviewedAt: iso(p.lastReviewedAt ?? null),
    views: p.views ?? 0,
    publishedAt: iso(p.publishedAt ?? null),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
