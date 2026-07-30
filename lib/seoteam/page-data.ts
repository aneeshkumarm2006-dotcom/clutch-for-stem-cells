/**
 * Page read layer — the composed (block) pages, for both the public route and
 * the /seoteam CMS.
 *
 * Mirrors `lib/seoteam/matrix-data.ts`: server-only, returns plain serializable
 * views (never hydrated Mongoose docs), and gates the public read on the shared
 * editorial approval status.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { parseBlocks } from "@/components/blocks/block-renderer";
import { isMatrixIndexable } from "@/lib/seo-indexation";
import type { ContentReviewStatus } from "@/lib/enums";
import type { BlockInput } from "@/lib/validation/block";
import { MedicalReviewer, Page, type IPage } from "@/models";
import type { SitemapEntry } from "@/lib/public-data";
import type { ISchemaOverrides, ISeo } from "@/models";

/**
 * Slugs a composed Page may never claim, because a real route already owns that
 * first path segment. Next.js would give the static route precedence anyway, so
 * a colliding page would simply be unreachable — this turns that silent dead end
 * into a save-time error the editor can act on.
 */
export const RESERVED_SLUGS = new Set([
  "about",
  "account",
  "admin",
  "analyticshub",
  "api",
  "auth",
  "blog",
  "clinic",
  "clinics",
  "conditions",
  "contact",
  "editorial-policy",
  "faq",
  "find-a-clinic",
  "for-clinics",
  "locations",
  "medical-disclaimer",
  "methodology",
  "privacy",
  "r",
  "reviews",
  "reviewers",
  "robots.txt",
  "search",
  "seoteam",
  "shortlist",
  "sitemap.xml",
  "terms",
  "treatments",
]);

/**
 * Route prefixes a composed page *may* nest under, because that route explicitly
 * falls back to a composed page when its own record lookup misses.
 *
 * `/treatments/[slug]` does this: an editorial page like
 * `treatments/prp-vs-stem-cell-therapy` is a comparison guide, not a treatment
 * the directory can filter clinics by, so it must not become a taxonomy term —
 * but it still belongs at that URL. Adding a prefix here without teaching the
 * matching route to look for the page would create a saveable, unreachable URL.
 */
export const NESTABLE_SLUG_PREFIXES = new Set(["treatments"]);

/** `["treatments", "prp-vs-x"]` → the two parts, or a single-element array. */
function slugSegments(slug: string): string[] {
  return slug.toLowerCase().split("/").filter(Boolean);
}

export function isReservedSlug(slug: string): boolean {
  const segments = slugSegments(slug);
  const [first] = segments;
  if (!first) return true;

  // A nested slug is legal only under a route that opts in; the deeper segment
  // lives inside that route's namespace, so it can't collide with anything.
  if (segments.length > 1) {
    return segments.length > 2 || !NESTABLE_SLUG_PREFIXES.has(first);
  }
  return RESERVED_SLUGS.has(first);
}

/** The public view of a composed page. */
export interface PageView {
  id: string;
  title: string;
  slug: string;
  path: string;
  intro?: string;
  blocks: BlockInput[];
  seo?: ISeo | null;
  schemaOverrides?: ISchemaOverrides | null;
  publishedAt?: Date | null;
  updatedAt: Date;
  lastReviewedAt?: Date | null;
  reviewer?: { name: string; credentials?: string; sameAs?: string[] } | null;
  /** `false` for a thin page — it renders but stays `noindex, follow`. */
  indexable: boolean;
}

type LeanPage = IPage & { _id: { toString(): string } };

async function toView(doc: LeanPage): Promise<PageView> {
  let reviewer: PageView["reviewer"] = null;
  if (doc.reviewedBy) {
    const r = await MedicalReviewer.findById(doc.reviewedBy)
      .select("name credentials sameAs")
      .lean<{ name: string; credentials?: string; sameAs?: string[] } | null>();
    if (r) {
      reviewer = { name: r.name, credentials: r.credentials, sameAs: r.sameAs };
    }
  }

  const blocks = parseBlocks(doc.blocks);

  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    path: `/${doc.slug}`,
    intro: doc.intro ?? undefined,
    blocks,
    seo: doc.seo ?? null,
    schemaOverrides: doc.schemaOverrides ?? null,
    publishedAt: doc.publishedAt ?? null,
    updatedAt: doc.updatedAt,
    lastReviewedAt: doc.lastReviewedAt ?? null,
    reviewer,
    // Same bar as the combination pages: approval, not content depth. A thin
    // published page is still indexable — see `lib/seo-indexation.ts`.
    indexable: isMatrixIndexable({ reviewStatus: doc.reviewStatus }),
  };
}

/** The approved page at `/{slug}`, or `null`. Public route + preview use this. */
export async function getApprovedPage(slug: string): Promise<PageView | null> {
  if (isReservedSlug(slug)) return null;
  await dbConnect();
  const doc = await Page.findOne({
    slug: slug.toLowerCase(),
    reviewStatus: "approved",
  }).lean<LeanPage | null>();
  if (!doc) return null;
  return toView(doc);
}

/** Every approved page slug — powers `generateStaticParams`. */
export async function getApprovedPageSlugs(): Promise<string[]> {
  await dbConnect();
  const rows = await Page.find({ reviewStatus: "approved" })
    .select("slug")
    .lean<{ slug: string }[]>();
  return rows.map((r) => r.slug);
}

/** Sitemap entries — approved pages only. */
export async function getPageSitemapEntries(): Promise<SitemapEntry[]> {
  await dbConnect();
  const rows = await Page.find({ reviewStatus: "approved" })
    .select("slug updatedAt")
    .lean<{ slug: string; updatedAt: Date }[]>();
  return rows.map((r) => ({
    path: `/${r.slug}`,
    lastModified: r.updatedAt,
  }));
}

// ── CMS reads ───────────────────────────────────────────────────────────────

/** A row in the CMS pages list. */
export interface AdminPageRow {
  id: string;
  title: string;
  slug: string;
  path: string;
  reviewStatus: ContentReviewStatus;
  blockCount: number;
  flagCount: number;
  updatedAt: string;
}

export async function getAdminPages(
  opts: {
    q?: string;
    status?: string;
  } = {},
): Promise<AdminPageRow[]> {
  await dbConnect();

  const filter: Record<string, unknown> = {};
  if (opts.status && opts.status !== "all") filter.reviewStatus = opts.status;
  if (opts.q?.trim()) filter.$text = { $search: opts.q.trim() };

  const rows = await Page.find(filter)
    .sort({ updatedAt: -1 })
    .limit(200)
    .select("title slug reviewStatus blocks contentFlags updatedAt")
    .lean<
      {
        _id: { toString(): string };
        title: string;
        slug: string;
        reviewStatus: ContentReviewStatus;
        blocks?: unknown[];
        contentFlags?: unknown[];
        updatedAt: Date;
      }[]
    >();

  return rows.map((r) => ({
    id: r._id.toString(),
    title: r.title,
    slug: r.slug,
    path: `/${r.slug}`,
    reviewStatus: r.reviewStatus,
    blockCount: r.blocks?.length ?? 0,
    flagCount: r.contentFlags?.length ?? 0,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** The full record for the editor (any status — drafts are editable). */
export interface EditablePage {
  id: string;
  title: string;
  slug: string;
  path: string;
  intro: string;
  blocks: BlockInput[];
  seo: ISeo;
  schemaOverrides: ISchemaOverrides;
  reviewStatus: ContentReviewStatus;
  reviewedBy: string;
  flagsAcknowledged: boolean;
}

export async function getPageForEdit(id: string): Promise<EditablePage | null> {
  await dbConnect();
  const doc = await Page.findById(id).lean<LeanPage | null>();
  if (!doc) return null;

  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    path: `/${doc.slug}`,
    intro: doc.intro ?? "",
    blocks: parseBlocks(doc.blocks),
    seo: doc.seo ?? {},
    schemaOverrides: doc.schemaOverrides ?? {},
    reviewStatus: doc.reviewStatus,
    reviewedBy: doc.reviewedBy ? String(doc.reviewedBy) : "",
    flagsAcknowledged: doc.flagsAcknowledged,
  };
}

/** `true` when the slug is free (and not reserved). Powers the editor's check. */
export async function isPageSlugAvailable(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  if (isReservedSlug(slug)) return false;
  await dbConnect();
  const filter: Record<string, unknown> = { slug: slug.toLowerCase() };
  if (excludeId) filter._id = { $ne: excludeId };
  return !(await Page.exists(filter));
}
