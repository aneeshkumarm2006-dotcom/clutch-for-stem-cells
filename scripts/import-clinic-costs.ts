/**
 * Cost-page content importer.
 *
 * Reads a JSON file of `{ slug, costPage, priceMin?, priceMax?, priceModel?,
 * priceNote? }` records and writes each one onto an existing clinic through the
 * SAME validated path the admin edit form uses: `clinicUpdateSchema` → `findOne`
 * → `clinic.set()` → `save()` → `recomputeSortScore` → a `clinic.update` audit
 * entry attributed to a real admin.
 *
 *   npm run import-clinic-costs -- scripts/clinic-costs.json --dry
 *   npm run import-clinic-costs -- scripts/clinic-costs.json
 *
 * Only the keys present on a record are written, so a file carrying just
 * `costPage` never disturbs the clinic's own pricing fields. `costPage` itself
 * is replaced wholesale (it is one editorial unit, and merging half a price
 * table would leave rows nobody authored).
 *
 * Batch-resilient: an unknown slug or a validation failure is reported and
 * skipped; the rest still import. Nothing is written in --dry mode.
 *
 * Note: if your Node can't resolve the MongoDB SRV record, set
 *   SCRIPT_DNS=8.8.8.8,1.1.1.1   before running. Otherwise leave it unset.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { recomputeSortScore } from "@/lib/ranking";
import { recordAudit } from "@/lib/audit";
import { clinicUpdateSchema } from "@/lib/validation/clinic";
import { findFlaggedPhrases } from "@/lib/content-flags";
import { Clinic, User } from "@/models";

/** The clinic-level fields a cost record is allowed to touch, beyond `costPage`. */
const CLINIC_FIELDS = [
  "priceMin",
  "priceMax",
  "currency",
  "priceModel",
  "priceNote",
] as const;

/** A record as it comes off the JSON file, before Zod has looked at it. */
type CostRecord = Record<string, unknown> & {
  slug?: string;
  costPage?: Record<string, unknown>;
};

/** Every value in `obj` under `keys`, flattened one level, as strings. */
function pick(obj: Record<string, unknown>, keys: string[]): unknown[] {
  return keys.flatMap((key) => {
    const value = obj[key];
    return Array.isArray(value) ? value : [value];
  });
}

/**
 * Every string a record renders as prose, for the compliance scan. Labels and
 * units are included: "guaranteed results package" would be a claim wherever it
 * appeared, and the price table is the one place copy skips the admin form's
 * own `ContentFlagWarning`.
 */
function proseOf(record: CostRecord): string[] {
  const cost = record.costPage ?? {};
  const rows = (key: string, fields: string[]): unknown[] => {
    const value = cost[key];
    if (!Array.isArray(value)) return [];
    return value.flatMap((row) =>
      row && typeof row === "object"
        ? pick(row as Record<string, unknown>, fields)
        : [],
    );
  };

  return [
    record.priceNote,
    ...pick(cost, [
      "heading",
      "intro",
      "introEmpty",
      "bodyMarkdown",
      "insuranceNote",
      "financingNote",
      "ctaHeading",
      "ctaBody",
      "includes",
      "excludes",
    ]),
    ...rows("items", ["label", "unit", "note"]),
    ...rows("faqs", ["question", "answer"]),
    ...rows("sources", ["label"]),
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

async function main() {
  const mod = await import("@next/env");
  const envNs = mod as unknown as {
    default?: { loadEnvConfig?: typeof mod.loadEnvConfig };
    loadEnvConfig?: typeof mod.loadEnvConfig;
  };
  (envNs.loadEnvConfig ?? envNs.default?.loadEnvConfig)?.(process.cwd());

  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const fileArg = args.find((a) => !a.startsWith("--"));

  const file = resolve(process.cwd(), fileArg ?? "scripts/clinic-costs.json");
  let rows: CostRecord[];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    rows = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`Could not read/parse ${file}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  await dbConnect();

  console.log(
    `\n${dry ? "DRY RUN — " : ""}Importing cost pages for ${rows.length} clinic(s) from ${file}\n`,
  );

  const actor = await User.findOne(
    { role: { $in: ["superadmin", "admin", "editor"] } },
    { _id: 1, email: 1, role: 1 },
  )
    .sort({ role: 1 })
    .lean();

  let updated = 0;
  let failed = 0;

  for (const [i, raw] of rows.entries()) {
    const label = raw.slug || `row ${i + 1}`;

    if (!raw.slug) {
      console.log(`✗ ${label}: no slug`);
      failed++;
      continue;
    }

    // Compliance gate (PRD §8): the same cure/guarantee scan the admin panel
    // runs, applied here because a machine-authored batch never sees that UI.
    const flags = findFlaggedPhrases(proseOf(raw));
    if (flags.length) {
      const terms = [...new Set(flags)].join(", ");
      console.log(`✗ ${label}: content flags → ${terms}`);
      failed++;
      continue;
    }

    // Only the keys the record actually carries, so a cost-only file leaves the
    // clinic's own pricing fields exactly as they were.
    const patch: Record<string, unknown> = {};
    for (const key of CLINIC_FIELDS) {
      if (raw[key] !== undefined) patch[key] = raw[key];
    }
    if (raw.costPage !== undefined) patch.costPage = raw.costPage;

    if (!Object.keys(patch).length) {
      console.log(`✗ ${label}: nothing to write`);
      failed++;
      continue;
    }

    const parsed = clinicUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`)
        .join("; ");
      console.log(`✗ ${label}: validation failed → ${issues}`);
      failed++;
      continue;
    }

    const clinic = await Clinic.findOne({ slug: raw.slug, isDeleted: false });
    if (!clinic) {
      console.log(`✗ ${label}: no clinic with that slug`);
      failed++;
      continue;
    }

    const rows_ = (parsed.data.costPage?.items ?? []).length;
    const pricedRows = (parsed.data.costPage?.items ?? []).filter(
      (r) => r.priceMin != null || r.priceMax != null,
    ).length;

    if (dry) {
      console.log(
        `✓ ${label}: valid (${rows_} price row(s), ${pricedRows} priced) — not written`,
      );
      updated++;
      continue;
    }

    const before = {
      priceMin: clinic.priceMin,
      priceMax: clinic.priceMax,
      costRows: clinic.costPage?.items?.length ?? 0,
    };

    // `set()` replaces any array passed, which is what we want for `costPage`.
    clinic.set(parsed.data);
    await clinic.save();
    await recomputeSortScore(clinic._id);
    await recordAudit({
      actorUserId: actor?._id ?? null,
      action: "clinic.update",
      entityType: "Clinic",
      entityId: clinic._id,
      before,
      after: {
        priceMin: clinic.priceMin,
        priceMax: clinic.priceMax,
        costRows: clinic.costPage?.items?.length ?? 0,
      },
    });

    console.log(
      `✓ ${label}: cost page saved (${rows_} price row(s), ${pricedRows} priced) → /clinic/${clinic.slug}/cost`,
    );
    updated++;
  }

  console.log(
    `\nDone. ${dry ? "would update" : "updated"}=${updated} failed=${failed}` +
      (actor ? `  · audited as ${actor.email}` : ""),
  );
  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
