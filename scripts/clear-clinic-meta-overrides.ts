/**
 * Hand the clinic meta tags back to the route formula.
 *
 * `buildMetadata` treats a per-entity `seo.metaTitle`/`seo.metaDescription` as
 * verbatim SERP copy and uses it in place of anything the route computes. Every
 * clinic in the directory carried one — bulk-written boilerplate, not authored
 * editorial — so the shared formula in `lib/clinic-meta.ts` could never reach a
 * single live page. This unsets those four fields (profile + reviews page) so
 * the formula governs, and leaves every other `seo` field alone
 * (`focusKeyword`, `canonicalUrl`, `ogImage`, `noindex`, …).
 *
 * Editors keep the override: anything typed into the admin panel's "Meta title"
 * / "Meta description" afterwards wins again, exactly as before.
 *
 *   npx tsx scripts/clear-clinic-meta-overrides.ts --dry   # preview only
 *   npx tsx scripts/clear-clinic-meta-overrides.ts         # write
 *
 * Set SCRIPT_DNS=8.8.8.8,1.1.1.1 if Node cannot resolve the MongoDB SRV record.
 */
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  clinicMetaDescription,
  clinicMetaTitle,
  clinicReviewsMetaDescription,
  clinicReviewsMetaTitle,
} from "@/lib/clinic-meta";
import { Clinic, User } from "@/models";
import { SITE_NAME } from "@/config/site";

/** The four fields the route now owns. */
const OWNED_PATHS = [
  "seo.metaTitle",
  "seo.metaDescription",
  "reviewsPage.seo.metaTitle",
  "reviewsPage.seo.metaDescription",
] as const;

async function main(): Promise<void> {
  const mod = await import("@next/env");
  (mod.loadEnvConfig ?? (mod as any).default?.loadEnvConfig)?.(process.cwd());

  const dry = process.argv.slice(2).includes("--dry");

  await dbConnect();

  const clinics = await Clinic.find({ isDeleted: { $ne: true } })
    .populate("conditionsTreated", "name")
    .select("name slug status locations conditionsTreated seo reviewsPage");

  const actor = await User.findOne(
    { role: { $in: ["superadmin", "admin", "editor"] } },
    { _id: 1, email: 1, role: 1 },
  )
    .sort({ role: 1 })
    .lean();

  let changed = 0;

  for (const clinic of clinics) {
    const doc = clinic as any;
    const input = {
      name: doc.name,
      locations: doc.locations ?? [],
      conditions: (doc.conditionsTreated ?? []) as { name: string }[],
    };

    const before: Record<string, string | null> = {};
    for (const path of OWNED_PATHS) before[path] = doc.get(path) ?? null;
    const hadOverride = Object.values(before).some(Boolean);

    console.log(`\n── ${doc.name}  [${doc.status}]  /clinic/${doc.slug}`);
    if (hadOverride) {
      for (const path of OWNED_PATHS) {
        if (before[path]) console.log(`   was  ${path}: ${before[path]}`);
      }
    } else {
      console.log(`   no override on file`);
    }
    console.log(`   now  profile title:  ${clinicMetaTitle(input)}`);
    console.log(`   now  profile desc:   ${clinicMetaDescription(input)}`);
    console.log(
      `   now  reviews title: ${clinicReviewsMetaTitle(input)} | ${SITE_NAME}`,
    );
    console.log(`   now  reviews desc:  ${clinicReviewsMetaDescription(input)}`);

    if (!hadOverride || dry) continue;

    for (const path of OWNED_PATHS) clinic.set(path, undefined);
    await clinic.save();
    await recordAudit({
      actorUserId: actor?._id ?? null,
      action: "clinic.update",
      entityType: "Clinic",
      entityId: clinic._id,
      before,
      after: Object.fromEntries(OWNED_PATHS.map((p) => [p, null])),
    });
    changed++;
  }

  console.log(
    `\n${dry ? "DRY RUN — nothing written. " : ""}clinics=${clinics.length} cleared=${dry ? 0 : changed}` +
      (actor && !dry ? `  · audited as ${actor.email}` : ""),
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
