/**
 * Dashboard read-layer (PRD §8.1 / Stage 6.2).
 *
 * KPI counts, 14-day lead/review trend series, and the recent-activity feed
 * (from the audit log). Serializable view models only.
 */
import "server-only";
import { cache } from "react";

import { dbConnect } from "@/lib/db";
import { id, iso } from "@/lib/admin/serialize";
import {
  AuditLog,
  Clinic,
  Lead,
  Review,
  User,
} from "@/models";
import type { ClinicStatus, ClinicTier } from "@/lib/enums";

/** Pending reviews awaiting moderation = pending + not deleted. */
export const getPendingReviewCount = cache(async (): Promise<number> => {
  await dbConnect();
  return Review.countDocuments({
    status: "pending",
    isDeleted: false,
  });
});

export interface DashboardData {
  clinics: {
    total: number;
    byStatus: Record<ClinicStatus, number>;
    byTier: Record<ClinicTier, number>;
  };
  pendingReviews: number;
  leads: { last7d: number; prev7d: number; last30d: number; trendPct: number };
  leadsSeries: { label: string; count: number }[];
  reviewsSeries: { label: string; count: number }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    actorName: string;
    at?: string;
  }[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Daily counts over the last `days` from a `createdAt`-bearing collection. */
async function dailySeries(
  model: typeof Lead | typeof Review,
  days: number,
  extraMatch: Record<string, unknown> = {},
): Promise<{ label: string; count: number }[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = await model.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: since }, ...extraMatch } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
  ]);
  const counts = new Map(rows.map((r) => [r._id, r.count]));

  const series: { label: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = dayKey(d);
    series.push({
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: counts.get(key) ?? 0,
    });
  }
  return series;
}

export const getDashboardData = cache(async (): Promise<DashboardData> => {
  await dbConnect();

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const d14 = new Date(now.getTime() - 14 * 86_400_000);
  const d30 = new Date(now.getTime() - 30 * 86_400_000);

  const [
    statusAgg,
    tierAgg,
    pendingReviews,
    last7d,
    prev7d,
    last30d,
    leadsSeries,
    reviewsSeries,
    activity,
  ] = await Promise.all([
    Clinic.aggregate<{ _id: ClinicStatus; count: number }>([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Clinic.aggregate<{ _id: ClinicTier; count: number }>([
      { $match: { isDeleted: false } },
      { $group: { _id: "$tier", count: { $sum: 1 } } },
    ]),
    getPendingReviewCount(),
    Lead.countDocuments({ createdAt: { $gte: d7 } }),
    Lead.countDocuments({ createdAt: { $gte: d14, $lt: d7 } }),
    Lead.countDocuments({ createdAt: { $gte: d30 } }),
    dailySeries(Lead, 14),
    dailySeries(Review, 14),
    AuditLog.find({}).sort({ at: -1 }).limit(8).lean(),
  ]);

  const byStatus: Record<ClinicStatus, number> = {
    draft: 0,
    published: 0,
    pending: 0,
    archived: 0,
  };
  for (const row of statusAgg) byStatus[row._id] = row.count;

  const byTier: Record<ClinicTier, number> = {
    basic: 0,
    verified: 0,
    featured: 0,
  };
  for (const row of tierAgg) byTier[row._id] = row.count;

  // Resolve actor names for the activity feed in one query.
  const actorIds = [
    ...new Set(activity.map((a) => a.actorUserId).filter(Boolean).map(String)),
  ];
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } })
        .select("name email")
        .lean()
    : [];
  const actorName = new Map(
    actors.map((u) => [id(u._id), u.name || u.email]),
  );

  const trendPct =
    prev7d === 0 ? (last7d > 0 ? 100 : 0) : Math.round(((last7d - prev7d) / prev7d) * 100);

  return {
    clinics: {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      byTier,
    },
    pendingReviews,
    leads: { last7d, prev7d, last30d, trendPct },
    leadsSeries,
    reviewsSeries,
    recentActivity: activity.map((a) => ({
      id: id(a._id),
      action: a.action,
      entityType: a.entityType,
      actorName: a.actorUserId
        ? (actorName.get(id(a.actorUserId)) ?? "Admin")
        : "System",
      at: iso(a.at),
    })),
  };
});
