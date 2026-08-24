/**
 * Blocked-submission admin read-layer.
 *
 * The bin behind every hard reject (`models/blocked-submission`). Rejected
 * payloads never reach `Lead`/`Review`/`Report`, so this view is the only place
 * a false positive can be found — which is the whole reason rejecting is
 * allowed at all.
 */
import "server-only";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import { id, iso } from "@/lib/admin/serialize";
import { BlockedSubmission } from "@/models";
import type { IBlockedSubmission } from "@/models";

export interface AdminBlockedRow {
  id: string;
  form: string;
  score: number;
  category: string | null;
  reasons: { code: string; detail: string; weight: number }[];
  /** The submitted body, verbatim. Rendered escaped, never as HTML. */
  payload: Record<string, unknown>;
  ip?: string;
  subnet?: string | null;
  userAgent?: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface BlockedResult {
  rows: AdminBlockedRow[];
  total: number;
  counts: Record<"lead" | "review" | "report" | "all", number>;
}

export async function getBlockedSubmissions(
  query: { form?: string; page?: number; pageSize?: number } = {},
): Promise<BlockedResult> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;

  const filter: FilterQuery<IBlockedSubmission> = {};
  if (query.form && query.form !== "all") filter.form = query.form as never;

  const [docs, total, countsAgg] = await Promise.all([
    BlockedSubmission.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    BlockedSubmission.countDocuments(filter),
    BlockedSubmission.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$form", count: { $sum: 1 } } },
    ]),
  ]);

  const counts = { lead: 0, review: 0, report: 0, all: 0 };
  for (const row of countsAgg) {
    if (row._id in counts) counts[row._id as keyof typeof counts] = row.count;
    counts.all += row.count;
  }

  return {
    rows: docs.map((d) => ({
      id: id(d._id),
      form: d.form,
      score: d.score,
      category: d.category ?? null,
      reasons: (d.reasons ?? []).map((r) => ({
        code: r.code,
        detail: r.detail,
        weight: r.weight,
      })),
      payload: (d.payload ?? {}) as Record<string, unknown>,
      ip: d.ip,
      subnet: d.subnet,
      userAgent: d.userAgent,
      createdAt: iso(d.createdAt),
      expiresAt: iso(d.expiresAt),
    })),
    total,
    counts,
  };
}
