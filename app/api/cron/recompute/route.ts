/**
 * Nightly recompute cron `/api/cron/recompute` (Stage 9.1 / PRD §9, §12).
 *
 * Idempotent batch job (Stage 9.7): recomputes every clinic's denormalized
 * rating aggregates from approved reviews, then re-derives `sortScore` once over
 * the fresh ratings. Re-running yields the same result. Triggered by Vercel Cron
 * (see `vercel.json`); gated by `CRON_SECRET`. Safe to invoke by hand in dev.
 */
import { recomputeAllClinicRatings } from "@/lib/ratings";
import { recomputeAllSortScores } from "@/lib/ranking";
import { verifyCronRequest } from "@/lib/cron";

export const dynamic = "force-dynamic";
// Recompute can run longer than the default Hobby limit on large datasets.
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  try {
    // Ratings first (they feed ranking), then a single ranking pass.
    const clinicsRated = await recomputeAllClinicRatings();
    const clinicsRanked = await recomputeAllSortScores();

    return Response.json({
      ok: true,
      clinicsRated,
      clinicsRanked,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Cron recompute failed:", err);
    return Response.json({ error: "Recompute failed." }, { status: 500 });
  }
}
