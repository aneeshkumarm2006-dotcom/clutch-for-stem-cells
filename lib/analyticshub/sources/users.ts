/**
 * Users source — the one internal source, reading the host `User` collection.
 * Server-only (touches Mongoose), so the route adapter injects this into the
 * handler context rather than the pure handler importing it.
 *
 * Counts organic signups (`role: "member"`, not soft-deleted), the daily
 * (zero-filled) signup series, and the 10 most recent members — mirroring the
 * existing admin dashboard's `dailySeries` aggregate.
 */
import "server-only";

import { daysBetween } from "@/lib/analyticshub/dates";
import type {
  DateRange,
  DetailTable,
  SeriesPoint,
  SourceResult,
} from "@/lib/analyticshub/types";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";

const MEMBER_FILTER = { role: "member", isDeleted: false } as const;

export async function fetchUsersSource(range: DateRange): Promise<SourceResult> {
  await dbConnect();
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T23:59:59.999Z`);

  const [rows, total, recent] = await Promise.all([
    User.aggregate<{ _id: string; count: number }>([
      { $match: { ...MEMBER_FILTER, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    User.countDocuments(MEMBER_FILTER),
    User.find(MEMBER_FILTER)
      .select("name email provider createdAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const counts = new Map(rows.map((r) => [r._id, r.count]));
  const series: SeriesPoint[] = daysBetween(range.from, range.to).map(
    (date) => ({
      source: "users",
      metric: "signups",
      date,
      value: counts.get(date) ?? 0,
    }),
  );
  const signups = series.reduce((sum, p) => sum + p.value, 0);

  const recentTable: DetailTable = {
    id: "recent",
    title: "Recent signups",
    columns: ["Name", "Email", "Source", "Joined"],
    rows: recent.map((u) => [
      u.name ?? "—",
      u.email,
      u.provider ?? "credentials",
      u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "—",
    ]),
  };

  return {
    source: "users",
    status: "ok",
    series,
    totals: { total, signups },
    detail: [recentTable],
  };
}
