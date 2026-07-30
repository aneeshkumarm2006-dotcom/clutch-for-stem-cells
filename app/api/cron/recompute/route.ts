/**
 * Nightly recompute cron `/api/cron/recompute` (Stage 9.1 / PRD §9, §12).
 *
 * Idempotent batch job (Stage 9.7): recomputes every clinic's denormalized
 * rating aggregates from approved reviews, then re-derives `sortScore` once over
 * the fresh ratings, then refreshes taxonomy `clinicCount`. Re-running yields the
 * same result. Triggered by Vercel Cron (see `vercel.json`); gated by
 * `CRON_SECRET`. Safe to invoke by hand in dev.
 *
 * The `clinicCount` pass is an indexation dependency, not just a cosmetic badge:
 * `lib/seo-indexation.ts::isThinDirectoryTerm` reads it to decide whether a
 * taxonomy term page is indexed and listed in `sitemap.xml`. Nothing else keeps
 * it current (the admin routes and the importer don't maintain it), so a term
 * left at a stale 0 would stay out of the index after clinics were attached.
 */
import { recomputeAllClinicRatings } from "@/lib/ratings";
import { recomputeAllSortScores } from "@/lib/ranking";
import { recomputeAllClinicCounts } from "@/lib/taxonomy-counts";
import { verifyCronRequest } from "@/lib/cron";

export const dynamic = "force-dynamic";
// Recompute can run longer than the default Hobby limit on large datasets.
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  try {
    // Ratings first (they feed ranking), then a single ranking pass, then the
    // taxonomy counts the indexation gate reads.
    const clinicsRated = await recomputeAllClinicRatings();
    const clinicsRanked = await recomputeAllSortScores();
    const counts = await recomputeAllClinicCounts();

    return Response.json({
      ok: true,
      clinicsRated,
      clinicsRanked,
      termsRecounted: counts.changed,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Cron recompute failed:", err);
    return Response.json({ error: "Recompute failed." }, { status: 500 });
  }
}
