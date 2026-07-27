/**
 * One-off: update a clinic's `seo.metaTitle` / `seo.metaDescription` in place.
 *
 * Mirrors the admin write path in `app/api/admin/clinics/[id]/route.ts` —
 * validates through the same Zod seo schema, writes the field, and records a
 * `clinic.update` audit entry attributed to a real admin.
 *
 * Usage:
 *   npx tsx scripts/_update-clinic-seo.ts <slug> --dry    # read + preview only
 *   npx tsx scripts/_update-clinic-seo.ts <slug>          # write
 *
 * Disposable — delete once the edit has landed.
 */
import dns from "node:dns";
// Same guard import-clinics.ts uses: c-ares refuses SRV here, so point Node at
// public DNS when SCRIPT_DNS is set.
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { Clinic, User } from "@/models";

const NEW_META_TITLE =
  "Regenerate Panama | Stem Cell Therapy Cost in Panama City";

const NEW_META_DESCRIPTION =
  "Regenerate Panama (Regeneration Clinic of Panama) offers umbilical-cord " +
  "stem cell therapy from its own Panama City lab. 3 to 7 day IV protocols " +
  "from $5,000.";

async function main(): Promise<void> {
  const mod = await import("@next/env");
  (mod.loadEnvConfig ?? (mod as any).default?.loadEnvConfig)?.(process.cwd());

  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const slug = args.find((a) => !a.startsWith("--"));
  if (!slug) {
    console.error("Usage: tsx scripts/_update-clinic-seo.ts <slug> [--dry]");
    process.exit(1);
  }

  await dbConnect();

  const clinic = await Clinic.findOne({ slug });
  if (!clinic) {
    console.error(`No clinic with slug "${slug}"`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const before = {
    metaTitle: clinic.seo?.metaTitle ?? null,
    metaDescription: clinic.seo?.metaDescription ?? null,
  };

  const len = (s: string | null) => (s == null ? "—" : `${s.length} chars`);

  console.log(`\n${clinic.name}  (/clinic/${clinic.slug})`);
  console.log(`status=${clinic.status}  reviews=${clinic.reviewCount ?? 0}  rating=${clinic.ratingAvg ?? 0}`);
  console.log(`\n── BEFORE ──`);
  console.log(`title       [${len(before.metaTitle)}] ${before.metaTitle}`);
  console.log(`description [${len(before.metaDescription)}] ${before.metaDescription}`);
  console.log(`\n── AFTER ──`);
  console.log(`title       [${len(NEW_META_TITLE)}] ${NEW_META_TITLE}`);
  console.log(`description [${len(NEW_META_DESCRIPTION)}] ${NEW_META_DESCRIPTION}`);

  if (dry) {
    console.log(`\nDRY RUN — nothing written.`);
    await mongoose.disconnect();
    return;
  }

  clinic.set("seo.metaTitle", NEW_META_TITLE);
  clinic.set("seo.metaDescription", NEW_META_DESCRIPTION);
  await clinic.save();

  const actor = await User.findOne(
    { role: { $in: ["superadmin", "admin", "editor"] } },
    { _id: 1, email: 1, role: 1 },
  )
    .sort({ role: 1 })
    .lean();

  await recordAudit({
    actorUserId: actor?._id ?? null,
    action: "clinic.update",
    entityType: "Clinic",
    entityId: clinic._id,
    before: { seo: before },
    after: {
      seo: {
        metaTitle: NEW_META_TITLE,
        metaDescription: NEW_META_DESCRIPTION,
      },
    },
  });

  console.log(
    `\n✓ Written${actor ? ` · audited as ${actor.email}` : ""}` +
      `\n  /admin/clinics/${clinic._id}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
