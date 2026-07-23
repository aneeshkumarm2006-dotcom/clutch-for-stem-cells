/**
 * Universal clinic importer.
 *
 * Reads a JSON file of clinics and inserts each one through the SAME validated
 * path the admin "New clinic" form uses: taxonomy slugs → ObjectIds, Zod
 * validation (clinicCreateSchema), slug-uniqueness check, create, sortScore
 * recompute, and a `clinic.create` audit entry.
 *
 * Add clinics daily by editing the JSON file — no new scripts needed.
 *
 *   npm run import-clinics                  # imports scripts/clinics.json
 *   npm run import-clinics -- my-file.json  # imports a specific file
 *   npm run import-clinics -- --dry         # validate + resolve, write NOTHING
 *   npm run import-clinics -- --taxonomy    # print every valid taxonomy slug
 *
 * In the JSON, taxonomy is referenced BY SLUG (run --taxonomy to see them):
 *   treatmentTypes, conditionsTreated, cellSources, accreditations  -> string[]
 *   serviceFocus -> [{ "treatment": "<slug>", "percent": 40 }]
 * Everything else matches the admin form fields (see scripts/clinics.example.json).
 *
 * Batch-resilient: a clinic that fails validation or already exists is skipped
 * with a reason; the rest still import. Nothing is written in --dry mode.
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
import { clinicCreateSchema } from "@/lib/validation/clinic";
import { slugify } from "@/lib/slug";
import {
  Clinic,
  Treatment,
  Condition,
  CellSource,
  Accreditation,
  User,
} from "@/models";

// ── Taxonomy slug → ObjectId maps (loaded once) ──────────────────────────────

interface TaxoMaps {
  treatment: Map<string, string>;
  condition: Map<string, string>;
  cellSource: Map<string, string>;
  accreditation: Map<string, string>;
}

async function loadTaxonomy(): Promise<TaxoMaps> {
  const toMap = async <T extends { slug: string }>(
    model: mongoose.Model<T>,
  ) => {
    const docs = await model.find({}, { slug: 1 }).lean();
    return new Map(docs.map((d) => [d.slug, String(d._id)]));
  };
  const [treatment, condition, cellSource, accreditation] = await Promise.all([
    toMap(Treatment),
    toMap(Condition),
    toMap(CellSource),
    toMap(Accreditation),
  ]);
  return { treatment, condition, cellSource, accreditation };
}

/** Map a list of slugs to ids; collect any that don't exist. */
function mapSlugs(
  slugs: string[] | undefined,
  map: Map<string, string>,
  label: string,
  missing: string[],
): string[] {
  return (slugs ?? []).map((s) => {
    const id = map.get(s);
    if (!id) missing.push(`${label}:${s}`);
    return id ?? s; // leave the bad slug in so validation also complains
  });
}

// ── Per-clinic transform: slugs → the shape clinicCreateSchema expects ────────

function toClinicInput(
  raw: Record<string, unknown>,
  taxo: TaxoMaps,
  missing: string[],
): Record<string, unknown> {
  const r = raw as Record<string, any>;
  const input: Record<string, unknown> = { ...r };

  // Auto-slug from name when omitted (mirrors the admin form).
  if (!r.slug && typeof r.name === "string") input.slug = slugify(r.name);

  input.treatmentTypes = mapSlugs(
    r.treatmentTypes,
    taxo.treatment,
    "treatment",
    missing,
  );
  input.conditionsTreated = mapSlugs(
    r.conditionsTreated,
    taxo.condition,
    "condition",
    missing,
  );
  input.cellSources = mapSlugs(
    r.cellSources,
    taxo.cellSource,
    "cellSource",
    missing,
  );
  input.accreditations = mapSlugs(
    r.accreditations,
    taxo.accreditation,
    "accreditation",
    missing,
  );

  // serviceFocus references a treatment by slug too.
  if (Array.isArray(r.serviceFocus)) {
    input.serviceFocus = r.serviceFocus.map((f: any) => {
      const id = taxo.treatment.get(f.treatment);
      if (!id) missing.push(`treatment(serviceFocus):${f.treatment}`);
      return { treatmentId: id ?? f.treatment, percent: f.percent };
    });
  }

  return input;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mod = await import("@next/env");
  (mod.loadEnvConfig ?? (mod as any).default?.loadEnvConfig)?.(process.cwd());

  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const showTaxonomy = args.includes("--taxonomy");
  const fileArg = args.find((a) => !a.startsWith("--"));

  await dbConnect();
  const taxo = await loadTaxonomy();

  if (showTaxonomy) {
    const dump = (label: string, m: Map<string, string>) =>
      console.log(
        `\n${label} (${m.size}):\n  ${[...m.keys()].sort().join("\n  ")}`,
      );
    dump("treatmentTypes", taxo.treatment);
    dump("conditionsTreated", taxo.condition);
    dump("cellSources", taxo.cellSource);
    dump("accreditations", taxo.accreditation);
    await mongoose.disconnect();
    return;
  }

  const file = resolve(process.cwd(), fileArg ?? "scripts/clinics.json");
  let rows: Record<string, unknown>[];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    rows = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`Could not read/parse ${file}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(
    `\n${dry ? "DRY RUN — " : ""}Importing ${rows.length} clinic(s) from ${file}\n`,
  );

  // Attribute creations to a real admin, as if added from the panel.
  const actor = await User.findOne(
    { role: { $in: ["superadmin", "admin", "editor"] } },
    { _id: 1, email: 1, role: 1 },
  )
    .sort({ role: 1 })
    .lean();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, raw] of rows.entries()) {
    const label = (raw as any).name || (raw as any).slug || `row ${i + 1}`;
    const missing: string[] = [];
    const input = toClinicInput(raw, taxo, missing);

    if (missing.length) {
      console.log(`✗ ${label}: unknown taxonomy slug(s) → ${missing.join(", ")}`);
      console.log(`  (run with --taxonomy to see valid slugs)`);
      failed++;
      continue;
    }

    const parsed = clinicCreateSchema.safeParse(input);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`)
        .join("; ");
      console.log(`✗ ${label}: validation failed → ${issues}`);
      failed++;
      continue;
    }

    if (await Clinic.exists({ slug: parsed.data.slug })) {
      console.log(`- skip ${label}: slug "${parsed.data.slug}" already exists`);
      skipped++;
      continue;
    }

    if (dry) {
      console.log(`✓ ${label}: valid (slug "${parsed.data.slug}") — not written`);
      created++;
      continue;
    }

    const clinic = await Clinic.create(parsed.data);
    await recomputeSortScore(clinic._id);
    await recordAudit({
      actorUserId: actor?._id ?? null,
      action: "clinic.create",
      entityType: "Clinic",
      entityId: clinic._id,
      after: { name: clinic.name, slug: clinic.slug, status: clinic.status },
    });
    console.log(
      `✓ ${label}: created (${clinic.status}) → /admin/clinics/${clinic._id}`,
    );
    created++;
  }

  console.log(
    `\nDone. ${dry ? "would create" : "created"}=${created} skipped=${skipped} failed=${failed}` +
      (actor ? `  · audited as ${actor.email}` : ""),
  );
  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
