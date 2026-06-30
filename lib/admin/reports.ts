/**
 * Reports moderation read-layer (PRD §14 / Stage 8.7).
 *
 * Surfaces user-submitted flags on reviews and clinics for the
 * `/admin/reports` queue. Resolves each flag's target (clinic name/slug, and a
 * review snippet for review flags) and exposes the private reporter email
 * (admin-only) for follow-up.
 */
import "server-only";
import { cache } from "react";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import { id, iso } from "@/lib/admin/serialize";
import { Clinic, Report, Review } from "@/models";
import type { IReport } from "@/models";
import type { ReportEntityType, ReportReason, ReportStatus } from "@/lib/enums";

export interface AdminReportRow {
  id: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  details?: string;
  reporterEmail?: string;
  status: ReportStatus;
  resolutionNote?: string;
  submittedAt?: string;
  resolvedAt?: string;
  /** Resolved target display. */
  clinicId?: string;
  clinicName?: string;
  clinicSlug?: string;
  /** Snippet of the flagged review (review flags only). */
  reviewSnippet?: string;
  reviewStatus?: string;
  /** Best link to inspect the target in context. */
  targetHref?: string;
}

export interface ReportsResult {
  rows: AdminReportRow[];
  total: number;
  counts: Record<"open" | "reviewing" | "resolved" | "dismissed" | "all", number>;
}

/** Open flags awaiting triage — drives the sidebar badge. */
export const getOpenReportCount = cache(async (): Promise<number> => {
  await dbConnect();
  return Report.countDocuments({ status: "open" });
});

export async function getAdminReports(
  query: { status?: string; page?: number; pageSize?: number } = {},
): Promise<ReportsResult> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;

  const filter: FilterQuery<IReport> = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status as ReportStatus;
  }

  const [docs, total, countsAgg] = await Promise.all([
    Report.find(filter)
      .select("+reporterEmail")
      .sort({ status: 1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Report.countDocuments(filter),
    Report.aggregate<{ _id: ReportStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Batch-resolve targets.
  const clinicIds = [
    ...new Set(docs.map((d) => d.clinicId && String(d.clinicId)).filter(Boolean)),
  ] as string[];
  const reviewIds = [
    ...new Set(
      docs
        .filter((d) => d.entityType === "review")
        .map((d) => String(d.entityId)),
    ),
  ];

  const [clinics, reviews] = await Promise.all([
    clinicIds.length
      ? Clinic.find({ _id: { $in: clinicIds } }).select("name slug").lean()
      : [],
    reviewIds.length
      ? Review.find({ _id: { $in: reviewIds } })
          .select("headline body status")
          .lean()
      : [],
  ]);
  const clinicMap = new Map(clinics.map((c) => [id(c._id), c]));
  const reviewMap = new Map(reviews.map((r) => [id(r._id), r]));

  const rows: AdminReportRow[] = docs.map((d) => {
    const clinic = d.clinicId ? clinicMap.get(String(d.clinicId)) : undefined;
    const review =
      d.entityType === "review" ? reviewMap.get(String(d.entityId)) : undefined;

    const reviewSnippet = review
      ? (review.headline ||
          review.body?.outcome ||
          review.body?.experience ||
          review.body?.whyChosen ||
          "")?.slice(0, 200)
      : undefined;

    const targetHref = clinic?.slug
      ? d.entityType === "review"
        ? `/clinic/${clinic.slug}#reviews`
        : `/clinic/${clinic.slug}`
      : undefined;

    return {
      id: id(d._id),
      entityType: d.entityType,
      entityId: String(d.entityId),
      reason: d.reason,
      details: d.details,
      reporterEmail: d.reporterEmail,
      status: d.status,
      resolutionNote: d.resolutionNote,
      submittedAt: iso(d.createdAt),
      resolvedAt: iso(d.resolvedAt),
      clinicId: d.clinicId ? String(d.clinicId) : undefined,
      clinicName: clinic?.name,
      clinicSlug: clinic?.slug,
      reviewSnippet: reviewSnippet || undefined,
      reviewStatus: review?.status,
      targetHref,
    };
  });

  const counts = { open: 0, reviewing: 0, resolved: 0, dismissed: 0, all: 0 };
  for (const row of countsAgg) {
    if (row._id in counts) counts[row._id as keyof typeof counts] = row.count;
    counts.all += row.count;
  }

  return { rows, total, counts };
}
