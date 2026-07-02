/**
 * Content freshness — YMYL content should be re-reviewed on a cadence so medical
 * claims don't silently go stale. An approved page is "review due" once its last
 * medical review is older than {@link STALE_AFTER_DAYS} (or was never stamped).
 *
 * Pure + dependency-free so it runs in server components, read layers, and the
 * CMS list badges.
 */

/** Re-review cadence for approved YMYL content (12 months). */
export const STALE_AFTER_DAYS = 365;

const DAY_MS = 86_400_000;

/**
 * `true` when approved content is due for medical re-review — its
 * `lastReviewedAt` is missing or older than {@link STALE_AFTER_DAYS}. Non-approved
 * content is never "stale" (it hasn't been published yet).
 */
export function isReviewDue(
  reviewStatus: string,
  lastReviewedAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (reviewStatus !== "approved") return false;
  if (!lastReviewedAt) return true;
  const at =
    lastReviewedAt instanceof Date ? lastReviewedAt : new Date(lastReviewedAt);
  if (Number.isNaN(at.getTime())) return true;
  return (now.getTime() - at.getTime()) / DAY_MS > STALE_AFTER_DAYS;
}
