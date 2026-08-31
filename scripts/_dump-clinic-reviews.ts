/**
 * Ad-hoc: dump every published clinic with its published reviews so the
 * "What patients say" summaries can be written from the real review text.
 * Usage: npx tsx scripts/_dump-clinic-reviews.ts > ../_ai_context/reviews-dump.json
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import { dbConnect } from "@/lib/db";
import { Clinic, Review, Condition, Treatment } from "@/models";

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  await dbConnect();

  const clinics = await Clinic.find({ isDeleted: { $ne: true } })
    .select("name slug status reviewCount ratingAvg externalReviews reviewsPage locations")
    .sort({ name: 1 })
    .lean();

  const conds = new Map(
    (await Condition.find().select("name").lean()).map((c: any) => [String(c._id), c.name]),
  );
  const treats = new Map(
    (await Treatment.find().select("name").lean()).map((t: any) => [String(t._id), t.name]),
  );

  const out: unknown[] = [];
  for (const c of clinics as any[]) {
    const reviews = await Review.find({
      clinicId: c._id,
      status: "approved",
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .lean();

    out.push({
      name: c.name,
      slug: c.slug,
      status: c.status,
      reviewCount: c.reviewCount,
      ratingAvg: c.ratingAvg,
      hasSummaryAlready: Boolean(c.reviewsPage?.summary),
      google: c.externalReviews?.google
        ? {
            rating: c.externalReviews.google.rating ?? null,
            reviewCount: c.externalReviews.google.reviewCount ?? null,
            summary: c.externalReviews.google.summary ?? null,
            themes: c.externalReviews.google.themes ?? [],
          }
        : null,
      reviews: reviews.map((r: any) => ({
        rating: r.ratingOverall,
        headline: r.headline ?? null,
        condition: r.conditionId ? conds.get(String(r.conditionId)) ?? null : null,
        treatment: r.treatmentId ? treats.get(String(r.treatmentId)) ?? null : null,
        treatmentDate: r.treatmentDate ?? null,
        createdAt: r.createdAt,
        wouldRecommend: r.wouldRecommend ?? null,
        body: r.body ?? {},
      })),
    });
  }

  process.stdout.write(JSON.stringify(out, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
