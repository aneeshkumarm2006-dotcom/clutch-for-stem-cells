/**
 * Recompute taxonomy `clinicCount` from live published clinics.
 *
 * The admin create/update routes and the clinic importer do NOT maintain the
 * denormalized `clinicCount` on taxonomy terms — only the seed sets it. So after
 * adding/publishing/archiving clinics the badges drift. This recomputes them for
 * every collection the same way `seed.ts:setRefCounts` does (published, not
 * soft-deleted), plus Location country/city counts (matched by countryCode/name).
 *
 *   npm run recompute-counts            # write corrected counts
 *   npm run recompute-counts -- --dry   # report drift, write nothing
 *
 * DNS note (same as import-clinics): if Node can't resolve the MongoDB SRV
 * record, prefix with  SCRIPT_DNS=8.8.8.8,1.1.1.1
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import {
  Clinic,
  Treatment,
  Condition,
  CellSource,
  Accreditation,
  Location,
} from "@/models";
import type { IClinic } from "@/models";

async function loadEnv(): Promise<void> {
  const mod = await import("@next/env");
  (mod.loadEnvConfig ?? (mod as unknown as { default?: { loadEnvConfig?: typeof mod.loadEnvConfig } }).default?.loadEnvConfig)?.(
    process.cwd(),
  );
}

async function main() {
  await loadEnv();
  const dry = process.argv.includes("--dry");
  await dbConnect();

  // One read of every public clinic; all counts are computed in memory from it.
  const clinics = (await Clinic.find(
    { status: "published", isDeleted: false },
    { treatmentTypes: 1, conditionsTreated: 1, cellSources: 1, accreditations: 1, locations: 1 },
  ).lean()) as unknown as IClinic[];

  const has = (arr: unknown[], id: unknown) =>
    (arr as { toString(): string }[]).some((x) => String(x) === String(id));

  let changed = 0;
  let unchanged = 0;

  async function apply(
    label: string,
    slug: string,
    id: unknown,
    current: number,
    next: number,
  ) {
    if (current === next) {
      unchanged++;
      return;
    }
    changed++;
    console.log(`${label} ${slug}: ${current} -> ${next}`);
    return next;
  }

  // ── Ref-based taxonomies (treatment/condition/cellSource/accreditation) ──
  const refGroups: [string, typeof Treatment, keyof IClinic][] = [
    ["Treatment", Treatment, "treatmentTypes"],
    ["Condition", Condition, "conditionsTreated"],
    ["CellSource", CellSource, "cellSources"],
    ["Accreditation", Accreditation, "accreditations"],
  ];
  for (const [label, Model, field] of refGroups) {
    const terms = await Model.find({}, { slug: 1, clinicCount: 1 }).lean();
    for (const term of terms) {
      const next = clinics.filter((c) => has(c[field] as unknown[], term._id)).length;
      const write = await apply(label, term.slug, term._id, term.clinicCount ?? 0, next);
      if (write !== undefined && !dry) {
        await Model.updateOne({ _id: term._id }, { $set: { clinicCount: next } });
      }
    }
  }

  // ── Location taxonomy: country by countryCode, city by name (seed parity) ──
  const locs = await Location.find({}, { slug: 1, name: 1, kind: 1, countryCode: 1, clinicCount: 1 }).lean();
  for (const loc of locs) {
    const next = clinics.filter((c) =>
      (c.locations ?? []).some((l) =>
        loc.kind === "country"
          ? l.countryCode === loc.countryCode
          : l.city === loc.name,
      ),
    ).length;
    const write = await apply("Location", loc.slug, loc._id, loc.clinicCount ?? 0, next);
    if (write !== undefined && !dry) {
      await Location.updateOne({ _id: loc._id }, { $set: { clinicCount: next } });
    }
  }

  console.log(
    `\n${dry ? "DRY RUN — " : ""}Done. ${dry ? "would change" : "changed"}=${changed} unchanged=${unchanged} (from ${clinics.length} published clinics)`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
