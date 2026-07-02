/**
 * MatrixPage data-access layer (server-only) — public reads for the combination
 * routes/sitemap and dashboard reads for the /seoteam CMS. Returns plain,
 * serializable view models (no Mongoose docs cross the boundary).
 *
 * Public combination pages are authored-into-existence: only `approved` records
 * are ever read for rendering or the sitemap. Completeness (index vs noindex) is
 * decided by `isMatrixIndexable` (lib/seo-indexation.ts) from the same fields.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import {
  getConditions,
  getCountries,
  getTreatments,
  loadReviewerByline,
} from "@/lib/public-data";
import { matrixPagePath } from "@/lib/matrix";
import { isMatrixIndexable } from "@/lib/seo-indexation";
import { isReviewDue } from "@/lib/freshness";
import type { EditorialArticleData } from "@/components/content/editorial-article";
import { MatrixPage, type IMatrixPage } from "@/models";
import type { MatrixKind } from "@/lib/enums";

const id = (v: unknown): string => String(v);
const iso = (d?: Date | null): string | undefined =>
  d ? new Date(d).toISOString() : undefined;

// ── Public view model (combination route) ────────────────────────────────────

export interface MatrixPageView {
  id: string;
  kind: MatrixKind;
  slugA: string;
  slugB: string;
  path: string;
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  seo?: IMatrixPage["seo"] | null;
  intro?: string;
  /** Ready-to-render editorial payload (body/faqs/keyFacts/byline). */
  editorial: EditorialArticleData;
  /** Whether this approved page clears the completeness bar for indexing. */
  indexable: boolean;
}

async function toView(p: IMatrixPage): Promise<MatrixPageView> {
  const reviewer = await loadReviewerByline(p.reviewedBy);
  const editorial: EditorialArticleData = {
    body: p.body || undefined,
    keyFacts: (p.keyFacts ?? []).map((k) => ({
      label: k.label,
      value: k.value,
      sourceUrl: k.sourceUrl,
    })),
    sections: [],
    faqs: (p.faqs ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    reviewer,
    lastReviewedAt: iso(p.lastReviewedAt ?? null) ?? null,
    updatedAt: iso(p.updatedAt) ?? null,
  };
  return {
    id: id(p._id),
    kind: p.kind,
    slugA: p.slugA,
    slugB: p.slugB,
    path: matrixPagePath(p.kind, p.slugA, p.slugB),
    title: p.title,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    seo: p.seo ?? null,
    intro: p.intro,
    editorial,
    indexable: isMatrixIndexable(p),
  };
}

/** The approved combination record for a (kind, slugA, slugB), or null. */
export async function getApprovedMatrixPage(
  kind: MatrixKind,
  slugA: string,
  slugB: string,
): Promise<MatrixPageView | null> {
  await dbConnect();
  const p = await MatrixPage.findOne({
    kind,
    slugA,
    slugB,
    reviewStatus: "approved",
  }).lean<IMatrixPage>();
  return p ? toView(p) : null;
}

/** Approved (slugA, slugB) pairs of a kind — for `generateStaticParams`. */
export async function getApprovedMatrixParams(
  kind: MatrixKind,
): Promise<{ slugA: string; slugB: string }[]> {
  await dbConnect();
  const docs = await MatrixPage.find({ kind, reviewStatus: "approved" })
    .select("slugA slugB")
    .lean();
  return docs.map((d) => ({ slugA: d.slugA, slugB: d.slugB }));
}

/** Approved T×C combos for a given treatment/condition — for parent-page spokes. */
export async function getApprovedComboLinks(
  match: { kind: MatrixKind } & ({ slugA: string } | { slugB: string }),
  limit = 12,
): Promise<{ slugA: string; slugB: string; title: string; path: string }[]> {
  await dbConnect();
  const docs = await MatrixPage.find({ ...match, reviewStatus: "approved" })
    .select("kind slugA slugB title")
    .limit(limit)
    .lean();
  return docs.map((d) => ({
    slugA: d.slugA,
    slugB: d.slugB,
    title: d.title,
    path: matrixPagePath(d.kind, d.slugA, d.slugB),
  }));
}

export interface SitemapEntry {
  path: string;
  lastModified?: Date;
}

/** Sitemap entries for every indexable approved combination page. */
export async function getMatrixSitemapEntries(): Promise<SitemapEntry[]> {
  await dbConnect();
  const docs = await MatrixPage.find({ reviewStatus: "approved" })
    .select(
      "kind slugA slugB intro body faqs keyFacts reviewedBy reviewStatus updatedAt",
    )
    .lean<IMatrixPage[]>();
  return docs
    .filter((d) => isMatrixIndexable(d))
    .map((d) => ({
      path: matrixPagePath(d.kind, d.slugA, d.slugB),
      lastModified: d.updatedAt ?? undefined,
    }));
}

// ── Dashboard reads (/seoteam CMS) ───────────────────────────────────────────

export interface MatrixAdminRow {
  id: string;
  kind: MatrixKind;
  slugA: string;
  slugB: string;
  path: string;
  title: string;
  reviewStatus: IMatrixPage["reviewStatus"];
  flagCount: number;
  hasReviewer: boolean;
  /** Approved page whose last medical review is stale (freshness cadence). */
  reviewDue: boolean;
  updatedAt?: string;
}

export async function getAdminMatrixPages(
  opts: { q?: string; status?: string; kind?: string } = {},
): Promise<MatrixAdminRow[]> {
  await dbConnect();
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.reviewStatus = opts.status;
  if (opts.kind) filter.kind = opts.kind;
  if (opts.q?.trim()) {
    filter.title = { $regex: escapeRegex(opts.q.trim()), $options: "i" };
  }
  const docs = await MatrixPage.find(filter)
    .sort({ updatedAt: -1 })
    .lean<IMatrixPage[]>();
  return docs.map((d) => ({
    id: id(d._id),
    kind: d.kind,
    slugA: d.slugA,
    slugB: d.slugB,
    path: matrixPagePath(d.kind, d.slugA, d.slugB),
    title: d.title,
    reviewStatus: d.reviewStatus,
    flagCount: d.contentFlags?.length ?? 0,
    hasReviewer: Boolean(d.reviewedBy),
    reviewDue: isReviewDue(d.reviewStatus, d.lastReviewedAt ?? null),
    updatedAt: iso(d.updatedAt),
  }));
}

export interface MatrixEditView {
  id: string;
  kind: MatrixKind;
  slugA: string;
  slugB: string;
  path: string;
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  intro?: string;
  body: string;
  faqs: { question: string; answer: string }[];
  keyFacts: { label: string; value: string; sourceUrl?: string }[];
  reviewStatus: IMatrixPage["reviewStatus"];
  reviewedBy?: string;
  flagsAcknowledged: boolean;
  contentFlags: { phrase: string; context: string }[];
  lastReviewedAt?: string;
}

export async function getMatrixPageForEdit(
  pageId: string,
): Promise<MatrixEditView | null> {
  await dbConnect();
  if (!/^[a-f\d]{24}$/i.test(pageId)) return null;
  const d = await MatrixPage.findById(pageId).lean<IMatrixPage>();
  if (!d) return null;
  return {
    id: id(d._id),
    kind: d.kind,
    slugA: d.slugA,
    slugB: d.slugB,
    path: matrixPagePath(d.kind, d.slugA, d.slugB),
    title: d.title,
    metaTitle: d.metaTitle,
    metaDescription: d.metaDescription,
    intro: d.intro,
    body: d.body ?? "",
    faqs: (d.faqs ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    keyFacts: (d.keyFacts ?? []).map((k) => ({
      label: k.label,
      value: k.value,
      sourceUrl: k.sourceUrl,
    })),
    reviewStatus: d.reviewStatus,
    reviewedBy: d.reviewedBy ? id(d.reviewedBy) : undefined,
    flagsAcknowledged: d.flagsAcknowledged ?? false,
    contentFlags: (d.contentFlags ?? []).map((c) => ({
      phrase: c.phrase,
      context: c.context,
    })),
    lastReviewedAt: iso(d.lastReviewedAt ?? null),
  };
}

/** Taxonomy slug/name options for the combination picker (create form). */
export async function getMatrixTaxonomyOptions(): Promise<{
  treatments: { slug: string; name: string }[];
  conditions: { slug: string; name: string }[];
  countries: { slug: string; name: string }[];
}> {
  const [treatments, conditions, countries] = await Promise.all([
    getTreatments(),
    getConditions(),
    getCountries(),
  ]);
  const opt = (t: { slug: string; name: string }) => ({
    slug: t.slug,
    name: t.name,
  });
  return {
    treatments: treatments.map(opt),
    conditions: conditions.map(opt),
    countries: countries.map(opt),
  };
}

export { getReviewerOptions } from "@/lib/seoteam/reviewer-data";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
