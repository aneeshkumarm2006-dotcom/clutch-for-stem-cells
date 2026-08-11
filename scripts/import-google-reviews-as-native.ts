/**
 * Promote each clinic's stored Google quotes into native `Review` documents.
 *
 *   npx tsx scripts/import-google-reviews-as-native.ts --dry
 *   npx tsx scripts/import-google-reviews-as-native.ts
 *   npx tsx scripts/import-google-reviews-as-native.ts --revert
 *
 * Reads `Clinic.externalReviews.google.highlights` — text already scraped and
 * checked by `import-clinic-reputation` — and writes one approved `Review` per
 * quote, so the quotes render in the clinic's own reviews list instead of in
 * the separate Google panel.
 *
 * ─── What this deliberately changes, and what it costs ──────────────────────
 *
 * The owner asked for these to read as native reviews with no source label and
 * to count fully. That was chosen with the trade-off stated, so this script
 * does exactly that. Recording the consequences here because they are not
 * visible from the call site:
 *
 *  1. `ratingAvg`, `ratingBreakdown` and `reviewCount` shift, because
 *     `recomputeClinicRatings` aggregates every approved review.
 *  2. `sortScore` shifts with them, so directory order changes. Ranking now
 *     moves with whatever a clinic accumulates on Google.
 *  3. `/clinic/[slug]/reviews` emits `Review` and `aggregateRating` JSON-LD
 *     built from this text. Google's review-snippet policy requires marked-up
 *     reviews to be collected by the site that publishes them; this is the
 *     violation that draws a manual action. Nothing here can soften that — it
 *     is a consequence of the choice, not of the implementation.
 *
 * Mitigations that cost the owner nothing and are therefore kept:
 *  - `source: "google"` on every row. Never rendered; it is what makes
 *    `--revert` possible and what lets a specific reviewer be found later.
 *  - `isVerified: false`, so none of them get the "Verified" badge.
 *  - `ageConfirmed` / `consentGiven` stay false. Those flags mean a submitter
 *    ticked a box. Nobody did, and writing `true` would put a false compliance
 *    attestation in the record.
 *  - `externalReviews.google.highlights` is left in place as the source of
 *    record. It just stops rendering.
 *  - `treatmentDate` carries Google's own relative wording ("5 months ago")
 *    rather than a timestamp derived from it. Maps only ever publishes a
 *    relative date and inventing a precise one would be a fabrication.
 *
 * Idempotent: a quote already imported (same clinic, author and text) is
 * skipped, so re-running after adding quotes only writes the new ones.
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import { dbConnect } from "@/lib/db";
import { recomputeClinicRatings } from "@/lib/ratings";
import { Clinic, Review } from "@/models";

const DRY = process.argv.includes("--dry");
const REVERT = process.argv.includes("--revert");

interface Highlight {
  author?: string;
  rating?: number;
  text?: string;
  publishedLabel?: string;
}

async function revert() {
  const imported = await Review.find({ source: "google" })
    .select("clinicId")
    .lean();
  if (!imported.length) {
    console.log("Nothing to revert — no reviews with source 'google'.");
    return;
  }

  const clinicIds = [...new Set(imported.map((r) => String(r.clinicId)))];
  console.log(
    `${DRY ? "DRY RUN — would delete" : "Deleting"} ${imported.length} imported review(s) across ${clinicIds.length} clinic(s)`,
  );
  if (DRY) return;

  // Hard delete, not soft: these were never patient submissions, so there is
  // nothing to preserve for moderation history. The quotes still exist on
  // `externalReviews.google.highlights`.
  await Review.deleteMany({ source: "google" });
  for (const id of clinicIds) await recomputeClinicRatings(id);
  console.log(`Recomputed ratings and sortScore for ${clinicIds.length} clinic(s).`);
}

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  await dbConnect();

  if (REVERT) {
    await revert();
    process.exit(0);
  }

  const clinics = await Clinic.find({
    isDeleted: { $ne: true },
    "externalReviews.google.highlights.0": { $exists: true },
  })
    .select("name slug ratingAvg reviewCount externalReviews")
    .sort({ slug: 1 })
    .lean();

  console.log(
    `${DRY ? "DRY RUN — " : ""}Promoting Google quotes on ${clinics.length} clinic(s)\n`,
  );

  let created = 0;
  let skipped = 0;
  const touched: string[] = [];

  for (const c of clinics) {
    const highlights = (c.externalReviews?.google?.highlights ??
      []) as Highlight[];
    const rows = [];

    for (const h of highlights) {
      const author = h.author?.trim();
      const text = h.text?.trim();
      if (!author || !text || !h.rating) {
        console.log(`  ! ${c.slug}: incomplete quote skipped`);
        continue;
      }

      const already = await Review.findOne({
        clinicId: c._id,
        source: "google",
        "reviewer.displayName": author,
        "body.experience": text,
        isDeleted: { $ne: true },
      })
        .select("_id")
        .lean();
      if (already) {
        skipped++;
        continue;
      }

      rows.push({
        clinicId: c._id,
        status: "approved" as const,
        source: "google" as const,
        // Not a verified patient — no badge.
        isVerified: false,
        reviewer: { displayName: author, isAnonymous: false },
        ratingOverall: h.rating,
        // The whole quote is the reviewer's account of their visit, which is
        // what the "Experience" section of a native review holds.
        body: { experience: text },
        // Google's own relative wording, carried across verbatim.
        treatmentDate: h.publishedLabel?.trim() || undefined,
        whyChosenTags: [],
        helpfulCount: 0,
        ageConfirmed: false,
        consentGiven: false,
      });
    }

    if (!rows.length) {
      console.log(
        `· ${c.slug.padEnd(42)} nothing new (${highlights.length} quote(s) already imported)`,
      );
      continue;
    }

    if (!DRY) {
      await Review.insertMany(rows);
      const agg = await recomputeClinicRatings(c._id);
      console.log(
        `✓ ${c.slug.padEnd(42)} +${rows.length} · rating ${c.ratingAvg ?? 0} → ${agg.ratingAvg} · count ${c.reviewCount ?? 0} → ${agg.reviewCount}`,
      );
    } else {
      console.log(
        `✓ ${c.slug.padEnd(42)} +${rows.length} quote(s) · currently ${c.ratingAvg ?? 0}★ (${c.reviewCount ?? 0})`,
      );
    }
    created += rows.length;
    touched.push(c.slug);
  }

  console.log(
    `\n${DRY ? "Would create" : "Created"} ${created} review(s) across ${touched.length} clinic(s); ${skipped} already present.`,
  );
  if (!DRY && created) {
    console.log("Ratings and sortScore recomputed for every clinic touched.");
    console.log("Undo with: npx tsx scripts/import-google-reviews-as-native.ts --revert");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
