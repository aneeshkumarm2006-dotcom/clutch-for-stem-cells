/**
 * MedicalReviewer data-access layer (server-only) — the CMS reviewer picker +
 * management dashboard and the public `/reviewers/[slug]` bio pages. Reviewers
 * are the E-E-A-T identities referenced by `reviewedBy` on taxonomy terms and
 * MatrixPages. Returns plain, serializable view models.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { MedicalReviewer, type IMedicalReviewer } from "@/models";

const id = (v: unknown): string => String(v);
const iso = (d?: Date | null): string | undefined =>
  d ? new Date(d).toISOString() : undefined;

/** Active reviewers as picker options (id/name/credentials). */
export async function getReviewerOptions(): Promise<
  { id: string; name: string; credentials?: string }[]
> {
  await dbConnect();
  const docs = await MedicalReviewer.find({ isActive: true })
    .select("name credentials")
    .sort({ name: 1 })
    .lean();
  return docs.map((d) => ({
    id: id(d._id),
    name: d.name,
    credentials: d.credentials,
  }));
}

export interface ReviewerAdminRow {
  id: string;
  name: string;
  slug: string;
  credentials?: string;
  title?: string;
  isActive: boolean;
  updatedAt?: string;
}

export async function getAdminReviewers(): Promise<ReviewerAdminRow[]> {
  await dbConnect();
  const docs = await MedicalReviewer.find({})
    .sort({ name: 1 })
    .lean<IMedicalReviewer[]>();
  return docs.map((d) => ({
    id: id(d._id),
    name: d.name,
    slug: d.slug,
    credentials: d.credentials,
    title: d.title,
    isActive: d.isActive,
    updatedAt: iso(d.updatedAt),
  }));
}

export interface ReviewerEditView {
  id: string;
  name: string;
  slug: string;
  credentials?: string;
  title?: string;
  bio?: string;
  photo?: { url: string; alt?: string };
  sameAs: string[];
  isActive: boolean;
}

export async function getReviewerForEdit(
  reviewerId: string,
): Promise<ReviewerEditView | null> {
  await dbConnect();
  if (!/^[a-f\d]{24}$/i.test(reviewerId)) return null;
  const d = await MedicalReviewer.findById(reviewerId).lean<IMedicalReviewer>();
  if (!d) return null;
  return {
    id: id(d._id),
    name: d.name,
    slug: d.slug,
    credentials: d.credentials,
    title: d.title,
    bio: d.bio,
    photo: d.photo?.url ? { url: d.photo.url, alt: d.photo.alt } : undefined,
    sameAs: d.sameAs ?? [],
    isActive: d.isActive,
  };
}

export interface ReviewerProfile {
  name: string;
  slug: string;
  credentials?: string;
  title?: string;
  bio?: string;
  photoUrl?: string;
  sameAs: string[];
}

/** Public bio for `/reviewers/[slug]` (active reviewers only). */
export async function getReviewerBySlug(
  slug: string,
): Promise<ReviewerProfile | null> {
  await dbConnect();
  const d = await MedicalReviewer.findOne({
    slug,
    isActive: true,
  }).lean<IMedicalReviewer>();
  if (!d) return null;
  return {
    name: d.name,
    slug: d.slug,
    credentials: d.credentials,
    title: d.title,
    bio: d.bio,
    photoUrl: d.photo?.url,
    sameAs: d.sameAs ?? [],
  };
}

export async function getActiveReviewerSlugs(): Promise<string[]> {
  await dbConnect();
  const docs = await MedicalReviewer.find({ isActive: true })
    .select("slug")
    .lean();
  return docs.map((d) => d.slug);
}

export async function getReviewerSitemapEntries(): Promise<
  { path: string; lastModified?: Date }[]
> {
  await dbConnect();
  const docs = await MedicalReviewer.find({ isActive: true })
    .select("slug updatedAt")
    .lean();
  return docs.map((d) => ({
    path: `/reviewers/${d.slug}`,
    lastModified: d.updatedAt ?? undefined,
  }));
}
