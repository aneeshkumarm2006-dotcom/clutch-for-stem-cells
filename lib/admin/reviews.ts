/**
 * Reviews moderation read-layer (PRD §8.3 / Stage 6.5).
 *
 * The queue surfaces email-confirmed reviews (unconfirmed pending submissions
 * aren't real yet). Resolves clinic/condition/treatment names and exposes the
 * private reviewer email (admin-only) for moderation.
 */
import "server-only";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import { id, iso } from "@/lib/admin/serialize";
import { Clinic, Condition, Review, Treatment } from "@/models";
import type { IReview } from "@/models";
import type { ReviewStatus } from "@/lib/enums";

export interface AdminReviewRow {
  id: string;
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  reviewerName: string;
  reviewerEmail?: string;
  isAnonymous: boolean;
  country?: string;
  status: ReviewStatus;
  isVerified: boolean;
  emailConfirmed: boolean;
  ratingOverall: number;
  ratings: {
    outcome?: number;
    communication?: number;
    facility?: number;
    value?: number;
    refer?: number;
  };
  headline?: string;
  snippet: string;
  body: {
    condition?: string;
    whyChosen?: string;
    treatmentDescription?: string;
    outcome?: string;
    experience?: string;
    improvement?: string;
  };
  conditionName?: string;
  treatmentName?: string;
  cost?: { range?: string; currency?: string };
  whyChosenTags: string[];
  wouldRecommend?: boolean;
  providerResponse?: { body: string; respondedAt?: string };
  rejectionReason?: string;
  submittedAt?: string;
}

export interface ReviewsQuery {
  status?: string;
  clinicId?: string;
  rating?: number;
  verified?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ReviewsResult {
  rows: AdminReviewRow[];
  total: number;
  counts: Record<"pending" | "approved" | "rejected" | "spam" | "all", number>;
}

/** Real reviews only: confirmed email, or any non-pending status. */
function baseFilter(): FilterQuery<IReview> {
  return {
    isDeleted: false,
    $or: [
      { status: { $ne: "pending" } },
      { status: "pending", emailVerifiedAt: { $ne: null } },
    ],
  };
}

function snippetOf(r: IReview): string {
  const text =
    r.headline ||
    r.body?.outcome ||
    r.body?.experience ||
    r.body?.whyChosen ||
    "";
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export async function getAdminReviews(
  query: ReviewsQuery = {},
): Promise<ReviewsResult> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;

  const filter: FilterQuery<IReview> = baseFilter();
  if (query.status && query.status !== "all") {
    filter.status = query.status as ReviewStatus;
  }
  if (query.clinicId) filter.clinicId = query.clinicId;
  if (query.rating) filter.ratingOverall = query.rating;
  if (query.verified) filter.isVerified = true;

  const [docs, total, countsAgg] = await Promise.all([
    Review.find(filter)
      .select("+reviewer.email")
      // Pending first (oldest first within), otherwise newest first.
      .sort({ status: 1, createdAt: query.status === "pending" ? 1 : -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate<{ _id: ReviewStatus; count: number }>([
      { $match: baseFilter() },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Resolve referenced names in batch.
  const clinicIds = [...new Set(docs.map((d) => String(d.clinicId)))];
  const conditionIds = [
    ...new Set(docs.map((d) => d.conditionId && String(d.conditionId)).filter(Boolean)),
  ] as string[];
  const treatmentIds = [
    ...new Set(docs.map((d) => d.treatmentId && String(d.treatmentId)).filter(Boolean)),
  ] as string[];

  const [clinics, conditions, treatments] = await Promise.all([
    Clinic.find({ _id: { $in: clinicIds } }).select("name slug").lean(),
    Condition.find({ _id: { $in: conditionIds } }).select("name").lean(),
    Treatment.find({ _id: { $in: treatmentIds } }).select("name").lean(),
  ]);
  const clinicMap = new Map(clinics.map((c) => [id(c._id), c]));
  const conditionMap = new Map(conditions.map((c) => [id(c._id), c.name]));
  const treatmentMap = new Map(treatments.map((t) => [id(t._id), t.name]));

  const rows: AdminReviewRow[] = docs.map((r) => {
    const clinic = clinicMap.get(String(r.clinicId));
    return {
      id: id(r._id),
      clinicId: String(r.clinicId),
      clinicName: clinic?.name ?? "Unknown clinic",
      clinicSlug: clinic?.slug ?? "",
      reviewerName: r.reviewer?.isAnonymous
        ? "Verified Patient"
        : r.reviewer?.displayName || "Anonymous",
      reviewerEmail: r.reviewer?.email,
      isAnonymous: Boolean(r.reviewer?.isAnonymous),
      country: r.reviewer?.country,
      status: r.status,
      isVerified: r.isVerified,
      emailConfirmed: r.emailVerifiedAt != null,
      ratingOverall: r.ratingOverall,
      ratings: {
        outcome: r.ratings?.outcome,
        communication: r.ratings?.communication,
        facility: r.ratings?.facility,
        value: r.ratings?.value,
        refer: r.ratings?.refer,
      },
      headline: r.headline,
      snippet: snippetOf(r as IReview),
      body: {
        condition: r.body?.condition,
        whyChosen: r.body?.whyChosen,
        treatmentDescription: r.body?.treatmentDescription,
        outcome: r.body?.outcome,
        experience: r.body?.experience,
        improvement: r.body?.improvement,
      },
      conditionName: r.conditionId
        ? conditionMap.get(String(r.conditionId))
        : undefined,
      treatmentName: r.treatmentId
        ? treatmentMap.get(String(r.treatmentId))
        : undefined,
      cost: r.cost
        ? { range: r.cost.range, currency: r.cost.currency }
        : undefined,
      whyChosenTags: r.whyChosenTags ?? [],
      wouldRecommend: r.wouldRecommend,
      providerResponse: r.providerResponse
        ? {
            body: r.providerResponse.body,
            respondedAt: iso(r.providerResponse.respondedAt),
          }
        : undefined,
      rejectionReason: r.moderation?.rejectionReason,
      submittedAt: iso(r.createdAt),
    };
  });

  const counts = { pending: 0, approved: 0, rejected: 0, spam: 0, all: 0 };
  for (const row of countsAgg) {
    if (row._id in counts) counts[row._id as keyof typeof counts] = row.count;
    counts.all += row.count;
  }

  return { rows, total, counts };
}
