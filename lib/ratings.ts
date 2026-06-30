/**
 * Ratings — recompute a clinic's denormalized review aggregates (Stage 3.2 / PRD §8.3).
 *
 * Recomputes `ratingAvg`, `ratingBreakdown`, `reviewCount`, and `topMentions`
 * from the clinic's **approved, non-deleted** reviews, then persists them and
 * refreshes `sortScore` (ratings feed ranking — PRD §9). Call this whenever a
 * review's contribution changes: approve, edit, reject/spam, soft-delete,
 * restore. Idempotent (Stage 9.7) — safe to re-run.
 *
 * Denormalizing here keeps the directory/profile pages fast (PRD §13): they read
 * the stored fields instead of aggregating reviews on every request.
 */
import { Types } from "mongoose";

import { dbConnect } from "@/lib/db";
import { SUB_RATING_KEYS } from "@/lib/enums";
import { recomputeSortScore } from "@/lib/ranking";
import { Clinic, Review } from "@/models";
import type { IRatingBreakdown, ITopMention } from "@/models";

/** Max review themes stored on `Clinic.topMentions` (Clutch-style "Timely (30)"). */
export const TOP_MENTIONS_LIMIT = 12;

export interface ClinicRatingAggregate {
  ratingAvg: number;
  ratingBreakdown: IRatingBreakdown;
  reviewCount: number;
  topMentions: ITopMention[];
}

const EMPTY_BREAKDOWN: IRatingBreakdown = {
  outcome: 0,
  communication: 0,
  facility: 0,
  value: 0,
  refer: 0,
};

const round2 = (n: number | null | undefined): number =>
  n == null ? 0 : Math.round(n * 100) / 100;

interface SummaryRow {
  reviewCount: number;
  ratingAvg: number | null;
  outcome: number | null;
  communication: number | null;
  facility: number | null;
  value: number | null;
  refer: number | null;
}

/**
 * Compute the aggregates for a clinic from its approved reviews — read-only,
 * no persistence. Exposed for callers that want the numbers without a write
 * (e.g. previews). `$avg` ignores missing sub-ratings, so partially-rated
 * reviews don't drag an axis toward zero.
 */
export async function computeClinicRatings(
  clinicId: Types.ObjectId | string,
): Promise<ClinicRatingAggregate> {
  await dbConnect();
  const _id = new Types.ObjectId(String(clinicId));

  const [result] = await Review.aggregate<{
    summary: SummaryRow[];
    mentions: { _id: string; count: number }[];
  }>([
    { $match: { clinicId: _id, status: "approved", isDeleted: false } },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              reviewCount: { $sum: 1 },
              ratingAvg: { $avg: "$ratingOverall" },
              outcome: { $avg: "$ratings.outcome" },
              communication: { $avg: "$ratings.communication" },
              facility: { $avg: "$ratings.facility" },
              value: { $avg: "$ratings.value" },
              refer: { $avg: "$ratings.refer" },
            },
          },
        ],
        mentions: [
          { $unwind: "$whyChosenTags" },
          { $group: { _id: "$whyChosenTags", count: { $sum: 1 } } },
          // Most-mentioned first; tie-break by tag for a stable order.
          { $sort: { count: -1, _id: 1 } },
          { $limit: TOP_MENTIONS_LIMIT },
        ],
      },
    },
  ]);

  const summary = result?.summary?.[0];
  if (!summary || summary.reviewCount === 0) {
    return {
      ratingAvg: 0,
      ratingBreakdown: { ...EMPTY_BREAKDOWN },
      reviewCount: 0,
      topMentions: [],
    };
  }

  const ratingBreakdown = SUB_RATING_KEYS.reduce((acc, key) => {
    acc[key] = round2(summary[key]);
    return acc;
  }, {} as IRatingBreakdown);

  return {
    ratingAvg: round2(summary.ratingAvg),
    ratingBreakdown,
    reviewCount: summary.reviewCount,
    topMentions: (result?.mentions ?? []).map((m) => ({
      tag: m._id,
      count: m.count,
    })),
  };
}

/**
 * Recompute, persist, and re-rank. Returns the fresh aggregate.
 *
 * `skipRanking` lets a batch caller defer `sortScore` recompute (e.g. a job that
 * re-ranks everything at the end); the default keeps a single review approval
 * fully consistent in one call.
 */
export async function recomputeClinicRatings(
  clinicId: Types.ObjectId | string,
  opts: { skipRanking?: boolean } = {},
): Promise<ClinicRatingAggregate> {
  const aggregate = await computeClinicRatings(clinicId);

  await Clinic.updateOne(
    { _id: new Types.ObjectId(String(clinicId)) },
    {
      $set: {
        ratingAvg: aggregate.ratingAvg,
        ratingBreakdown: aggregate.ratingBreakdown,
        reviewCount: aggregate.reviewCount,
        topMentions: aggregate.topMentions,
      },
    },
  );

  // Ratings are inputs to the ranking score — keep them in lockstep.
  if (!opts.skipRanking) await recomputeSortScore(clinicId);

  return aggregate;
}

/**
 * Batch recompute of every clinic's rating aggregates (Stage 9.1 nightly cron).
 *
 * One aggregation pass for the per-clinic summary + one for top mentions, then a
 * single `bulkWrite`. Crucially this also **resets** clinics whose approved
 * reviews dropped to zero (e.g. all reviews removed), so the job is idempotent
 * and self-correcting (Stage 9.7). Does *not* touch `sortScore` — the cron calls
 * `recomputeAllSortScores()` afterwards so ranking is computed once over fresh
 * ratings. Returns the number of clinics written.
 */
export async function recomputeAllClinicRatings(): Promise<number> {
  await dbConnect();

  const summaries = await Review.aggregate<SummaryRow & { _id: Types.ObjectId }>([
    { $match: { status: "approved", isDeleted: false } },
    {
      $group: {
        _id: "$clinicId",
        reviewCount: { $sum: 1 },
        ratingAvg: { $avg: "$ratingOverall" },
        outcome: { $avg: "$ratings.outcome" },
        communication: { $avg: "$ratings.communication" },
        facility: { $avg: "$ratings.facility" },
        value: { $avg: "$ratings.value" },
        refer: { $avg: "$ratings.refer" },
      },
    },
  ]);
  const summaryByClinic = new Map(summaries.map((s) => [String(s._id), s]));

  const mentionsAgg = await Review.aggregate<{
    _id: Types.ObjectId;
    mentions: ITopMention[];
  }>([
    { $match: { status: "approved", isDeleted: false } },
    { $unwind: "$whyChosenTags" },
    {
      $group: {
        _id: { clinicId: "$clinicId", tag: "$whyChosenTags" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, "_id.tag": 1 } },
    {
      $group: {
        _id: "$_id.clinicId",
        mentions: { $push: { tag: "$_id.tag", count: "$count" } },
      },
    },
  ]);
  const mentionsByClinic = new Map(
    mentionsAgg.map((m) => [String(m._id), m.mentions.slice(0, TOP_MENTIONS_LIMIT)]),
  );

  // Write every non-deleted clinic so zero-review clinics are reset to defaults.
  const clinics = await Clinic.find({ isDeleted: false }).select("_id").lean();
  const ops = clinics.map((clinic) => {
    const key = String(clinic._id);
    const summary = summaryByClinic.get(key);
    const ratingBreakdown = summary
      ? SUB_RATING_KEYS.reduce((acc, k) => {
          acc[k] = round2(summary[k]);
          return acc;
        }, {} as IRatingBreakdown)
      : { ...EMPTY_BREAKDOWN };
    return {
      updateOne: {
        filter: { _id: clinic._id },
        update: {
          $set: {
            ratingAvg: round2(summary?.ratingAvg),
            ratingBreakdown,
            reviewCount: summary?.reviewCount ?? 0,
            topMentions: mentionsByClinic.get(key) ?? [],
          },
        },
      },
    };
  });

  if (ops.length) await Clinic.bulkWrite(ops);
  return ops.length;
}
