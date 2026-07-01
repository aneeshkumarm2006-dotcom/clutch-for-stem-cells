/**
 * Ranking — `sortScore` computation & listing order (Stage 3.1 / PRD §9).
 *
 * Two layers:
 *  - **Pure scoring** (`computeSortScore` + the `*Score`/`*Boost` helpers) — no
 *    DB, fully unit-testable, deterministic given its input.
 *  - **Orchestration** (`recomputeSortScore`, `recomputeAllSortScores`) — load a
 *    clinic + the admin-tunable weights from `SiteSetting`, compute, persist.
 *    Idempotent (PRD §13/Stage 9.7): re-running yields the same value.
 *
 * Directory ordering (PRD §9) is a *separate* concern from the score:
 *   1) tier === 'featured'   (pinned top)
 *   2) verification.isVerified
 *   3) sortScore descending
 * Use {@link listingRankAddFields} + {@link LISTING_SORT} in an aggregation, or
 * {@link compareClinicsForListing} for in-memory sorting. `/lib/search.ts`
 * reuses the aggregation helpers so the order is defined in exactly one place.
 *
 * Called on review change (via `/lib/ratings.ts`) and nightly (Stage 9.1 cron).
 */
import { dbConnect } from "@/lib/db";
import type { ClinicTier } from "@/lib/enums";
import { Clinic, Review, SiteSetting, toPlainObject } from "@/models";
import type { IClinic, IRankingWeights } from "@/models";

// ── Tunables (saturation points / decay) ────────────────────────────────────
// Each scoring term is normalized to roughly 0..1 so the weighted sum lands in
// ~0..1 when the weights sum to 1.0 (the SiteSetting defaults do).

/** Review count at which the volume term effectively saturates (≈1.0). */
export const REVIEW_VOLUME_SATURATION = 100;
/** Half-life (days) of the recency boost from the most recent approved review. */
export const RECENCY_HALF_LIFE_DAYS = 180;
/** Accreditation count at which the accreditation term saturates (≈1.0). */
export const ACCREDITATION_SATURATION = 4;

/**
 * Fallback weights — mirror the `rankingWeights` schema defaults so scoring
 * still works if the settings doc is missing or partial. Sum = 1.0.
 */
export const DEFAULT_RANKING_WEIGHTS: IRankingWeights = {
  rating: 0.4,
  reviewVolume: 0.15,
  recency: 0.1,
  completeness: 0.15,
  accreditation: 0.1,
  tier: 0.1,
};

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

// ── Per-term scores (each 0..1) ─────────────────────────────────────────────

/** Review quality, `ratingAvg` (0..5) mapped to 0..1. */
export function normalizedRating(ratingAvg: number): number {
  return clamp01((ratingAvg || 0) / 5);
}

/** Review volume — `log(1+n)` saturating toward 1 at {@link REVIEW_VOLUME_SATURATION}. */
export function reviewVolumeScore(reviewCount: number): number {
  if (reviewCount <= 0) return 0;
  return clamp01(
    Math.log1p(reviewCount) / Math.log1p(REVIEW_VOLUME_SATURATION),
  );
}

/** Exponential recency decay from the latest approved review (0 if none). */
export function recencyBoost(
  latestReviewAt: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!latestReviewAt) return 0;
  const ageDays = (now.getTime() - latestReviewAt.getTime()) / 86_400_000;
  if (ageDays <= 0) return 1;
  return clamp01(Math.exp((-Math.LN2 * ageDays) / RECENCY_HALF_LIFE_DAYS));
}

/**
 * Accreditation strength — count saturating toward 1, with a small floor bump
 * once the clinic is verified (PRD §9 "number/strength of verified accreditations").
 */
export function accreditationScore(
  accreditationCount: number,
  isVerified = false,
): number {
  const byCount = clamp01(accreditationCount / ACCREDITATION_SATURATION);
  return clamp01(isVerified ? Math.max(byCount, 0.5) + byCount * 0.5 : byCount);
}

/** Tier boost — featured > verified > basic (0..1). */
export function tierBoost(tier: ClinicTier): number {
  switch (tier) {
    case "featured":
      return 1;
    case "verified":
      return 0.6;
    default:
      return 0.2;
  }
}

/**
 * Profile completeness (0..1) — fraction of meaningful fields/media filled.
 * Structural (not Mongoose-bound) so it works on lean objects and in tests.
 */
type CompletenessInput = Pick<
  IClinic,
  | "tagline"
  | "description"
  | "logo"
  | "coverImage"
  | "gallery"
  | "treatmentTypes"
  | "conditionsTreated"
  | "cellSources"
  | "accreditations"
  | "priceModel"
  | "priceMin"
  | "priceMax"
  | "languages"
  | "team"
  | "medicalDirector"
  | "locations"
  | "caseStudies"
  | "faqs"
  | "website"
>;

export function profileCompleteness(
  clinic: Partial<CompletenessInput>,
): number {
  const hasLen = (a?: unknown[]): boolean => Array.isArray(a) && a.length > 0;
  const signals: boolean[] = [
    Boolean(clinic.logo?.url),
    Boolean(clinic.coverImage?.url) || hasLen(clinic.gallery),
    Boolean(clinic.description && clinic.description.trim().length >= 120),
    Boolean(clinic.tagline?.trim()),
    hasLen(clinic.treatmentTypes),
    hasLen(clinic.conditionsTreated),
    hasLen(clinic.cellSources),
    hasLen(clinic.accreditations),
    Boolean(
      clinic.priceModel || clinic.priceMin != null || clinic.priceMax != null,
    ),
    hasLen(clinic.languages),
    hasLen(clinic.team) || Boolean(clinic.medicalDirector?.name),
    Boolean(clinic.locations?.some((l) => l?.city || l?.country)),
    hasLen(clinic.caseStudies),
    hasLen(clinic.faqs),
    Boolean(clinic.website?.trim()),
  ];
  return signals.filter(Boolean).length / signals.length;
}

// ── Composite score ─────────────────────────────────────────────────────────

export interface SortScoreInput {
  ratingAvg: number;
  reviewCount: number;
  latestReviewAt?: Date | null;
  /** Precomputed 0..1 (see {@link profileCompleteness}). */
  completeness: number;
  accreditationCount: number;
  isVerified: boolean;
  tier: ClinicTier;
}

/**
 * The PRD §9 weighted sum. Pure — given the same input and weights it always
 * returns the same number, so the nightly job and the on-write recompute agree.
 */
export function computeSortScore(
  input: SortScoreInput,
  weights: IRankingWeights = DEFAULT_RANKING_WEIGHTS,
  now: Date = new Date(),
): number {
  const score =
    weights.rating * normalizedRating(input.ratingAvg) +
    weights.reviewVolume * reviewVolumeScore(input.reviewCount) +
    weights.recency * recencyBoost(input.latestReviewAt, now) +
    weights.completeness * clamp01(input.completeness) +
    weights.accreditation *
      accreditationScore(input.accreditationCount, input.isVerified) +
    weights.tier * tierBoost(input.tier);
  // Round to keep stored values stable across recomputes (avoids fp jitter).
  return Math.round(score * 1e6) / 1e6;
}

// ── Listing order (featured → verified → sortScore desc) ─────────────────────

/**
 * `$addFields` stage that materializes the two ordering ranks so an aggregation
 * can `$sort` by {@link LISTING_SORT}. Reused by `/lib/search.ts`.
 */
export function listingRankAddFields(): Record<string, unknown> {
  return {
    _featuredRank: { $cond: [{ $eq: ["$tier", "featured"] }, 1, 0] },
    _verifiedRank: {
      $cond: [{ $eq: ["$verification.isVerified", true] }, 1, 0],
    },
  };
}

/** Canonical directory sort (PRD §9). Pairs with {@link listingRankAddFields}. */
export const LISTING_SORT = {
  _featuredRank: -1,
  _verifiedRank: -1,
  sortScore: -1,
} as const;

/** In-memory comparator with the same precedence (for already-loaded arrays). */
export function compareClinicsForListing(
  a: Pick<IClinic, "tier" | "verification" | "sortScore">,
  b: Pick<IClinic, "tier" | "verification" | "sortScore">,
): number {
  const featured =
    Number(b.tier === "featured") - Number(a.tier === "featured");
  if (featured) return featured;
  const verified =
    Number(Boolean(b.verification?.isVerified)) -
    Number(Boolean(a.verification?.isVerified));
  if (verified) return verified;
  return (b.sortScore ?? 0) - (a.sortScore ?? 0);
}

// ── Orchestration (DB-bound) ────────────────────────────────────────────────

/** Admin-tunable weights from `SiteSetting`, merged over {@link DEFAULT_RANKING_WEIGHTS}. */
export async function getRankingWeights(): Promise<IRankingWeights> {
  const settings = await SiteSetting.getGlobal();
  return { ...DEFAULT_RANKING_WEIGHTS, ...toPlainObject(settings.rankingWeights) };
}

/** Most recent approved, non-deleted review timestamp for a clinic (or null). */
async function latestApprovedReviewAt(
  clinicId: IClinic["_id"],
): Promise<Date | null> {
  const latest = await Review.findOne({
    clinicId,
    status: "approved",
    isDeleted: false,
  })
    .select("createdAt")
    .sort({ createdAt: -1 })
    .lean();
  return latest?.createdAt ?? null;
}

/**
 * Recompute and persist one clinic's `sortScore`. Returns the new value.
 * Pass `weights` to reuse one settings read across a batch.
 */
export async function recomputeSortScore(
  clinicId: IClinic["_id"] | string,
  weights?: IRankingWeights,
): Promise<number> {
  await dbConnect();
  const clinic = await Clinic.findById(clinicId)
    .select(
      "tier verification ratingAvg reviewCount accreditations tagline description logo coverImage gallery treatmentTypes conditionsTreated cellSources priceModel priceMin priceMax languages team medicalDirector locations caseStudies faqs website",
    )
    .lean();
  if (!clinic) return 0;

  const resolvedWeights = weights ?? (await getRankingWeights());
  const sortScore = computeSortScore(
    {
      ratingAvg: clinic.ratingAvg,
      reviewCount: clinic.reviewCount,
      latestReviewAt: await latestApprovedReviewAt(clinic._id),
      completeness: profileCompleteness(clinic),
      accreditationCount: clinic.accreditations?.length ?? 0,
      isVerified: Boolean(clinic.verification?.isVerified),
      tier: clinic.tier,
    },
    resolvedWeights,
  );

  await Clinic.updateOne({ _id: clinic._id }, { $set: { sortScore } });
  return sortScore;
}

/**
 * Nightly batch recompute for every non-deleted clinic (Stage 9.1 cron).
 * Reads weights + latest-review timestamps once, then bulk-writes. Returns the
 * number of clinics updated.
 */
export async function recomputeAllSortScores(): Promise<number> {
  await dbConnect();
  const weights = await getRankingWeights();
  const now = new Date();

  // One pass to get the latest approved review per clinic.
  const latestByClinic = new Map<string, Date>();
  const agg = await Review.aggregate<{ _id: IClinic["_id"]; latest: Date }>([
    { $match: { status: "approved", isDeleted: false } },
    { $group: { _id: "$clinicId", latest: { $max: "$createdAt" } } },
  ]);
  for (const row of agg) latestByClinic.set(String(row._id), row.latest);

  const clinics = await Clinic.find({ isDeleted: false })
    .select(
      "tier verification ratingAvg reviewCount accreditations tagline description logo coverImage gallery treatmentTypes conditionsTreated cellSources priceModel priceMin priceMax languages team medicalDirector locations caseStudies faqs website",
    )
    .lean();

  const ops = clinics.map((clinic) => ({
    updateOne: {
      filter: { _id: clinic._id },
      update: {
        $set: {
          sortScore: computeSortScore(
            {
              ratingAvg: clinic.ratingAvg,
              reviewCount: clinic.reviewCount,
              latestReviewAt: latestByClinic.get(String(clinic._id)) ?? null,
              completeness: profileCompleteness(clinic),
              accreditationCount: clinic.accreditations?.length ?? 0,
              isVerified: Boolean(clinic.verification?.isVerified),
              tier: clinic.tier,
            },
            weights,
            now,
          ),
        },
      },
    },
  }));

  if (ops.length) await Clinic.bulkWrite(ops);
  return ops.length;
}
