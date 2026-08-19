/**
 * Editorial-copy importer for clinic pages.
 *
 * Writes long-form Markdown onto the three URLs a clinic owns, through the SAME
 * validated path the admin edit form uses: `clinicUpdateSchema` → `findOne` →
 * `clinic.set()` → `save()` → `recomputeSortScore` → a `clinic.update` audit
 * entry attributed to a real admin.
 *
 *   npm run import-clinic-content -- scripts/clinic-page-content-2026-08-20.json --dry
 *   npm run import-clinic-content -- scripts/clinic-page-content-2026-08-20.json
 *
 * A record is `{ slug, bodyMarkdown?, reviewsPage?, costPage? }`, where the two
 * child-page objects carry only the copy fields you want to change:
 *
 *   { "slug": "biote",
 *     "bodyMarkdown": "## What to know…",       → /clinic/biote
 *     "costPage": { "bodyMarkdown": "## Biote…" } }  → /clinic/biote/cost
 *
 * **Merge, not replace** — this is the difference from `import-clinic-costs.ts`,
 * which deliberately swaps `costPage` wholesale because a price table is one
 * editorial unit. Here the payload is prose landing beside data somebody else
 * authored, so each field is written at its own dotted path
 * (`costPage.bodyMarkdown`) and everything the record does not mention is left
 * exactly as it was. Sending a `costPage` here can never drop a price row.
 *
 * Batch-resilient: an unknown slug, a flagged phrase or a validation failure is
 * reported and skipped; the rest still import. Nothing is written in --dry mode.
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

/** Copy fields a record may set directly on the clinic. */
const CLINIC_FIELDS = ["bodyMarkdown"] as const;

/**
 * Copy fields a record may set inside a child page's sub-document.
 *
 * Deliberately excludes `costPage.items`/`faqs`/`sources` and the `seo` blocks:
 * those are data and meta, they belong to `import-clinic-costs.ts` and the admin
 * form, and merging half of an array at a dotted path is how you end up with
 * rows nobody authored.
 */
const CHILD_FIELDS: Record<string, readonly string[]> = {
  reviewsPage: [
    "heading",
    "intro",
    "introEmpty",
    "bodyMarkdown",
    "ctaHeading",
    "ctaBody",
  ],
  costPage: [
    "heading",
    "intro",
    "introEmpty",
    "bodyMarkdown",
    "insuranceNote",
    "financingNote",
    "ctaHeading",
    "ctaBody",
  ],
};

type ContentRecord = Record<string, unknown> & { slug?: string };

/** `{ "costPage.bodyMarkdown": "## …" }` — one entry per field the record sets. */
function flatten(record: ContentRecord): {
  paths: Record<string, string>;
  unknown: string[];
} {
  const paths: Record<string, string> = {};
  const unknown: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (key === "slug") continue;

    if ((CLINIC_FIELDS as readonly string[]).includes(key)) {
      if (typeof value === "string") paths[key] = value;
      else unknown.push(`${key} (not a string)`);
      continue;
    }

    const allowed = CHILD_FIELDS[key];
    if (!allowed) {
      unknown.push(key);
      continue;
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      unknown.push(`${key} (not an object)`);
      continue;
    }
    for (const [sub, subValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (!allowed.includes(sub)) unknown.push(`${key}.${sub}`);
      else if (typeof subValue === "string") paths[`${key}.${sub}`] = subValue;
      else unknown.push(`${key}.${sub} (not a string)`);
    }
  }

  return { paths, unknown };
}

/** The flat paths rebuilt into the nested shape `clinicUpdateSchema` expects. */
function nest(paths: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(paths)) {
    const [head, tail] = path.split(".");
    if (!tail) {
      out[head] = value;
      continue;
    }
    const branch = (out[head] ??= {}) as Record<string, unknown>;
    branch[tail] = value;
  }
  return out;
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

  const file = resolve(process.cwd(), fileArg ?? "scripts/clinic-content.json");
  let rows: ContentRecord[];
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
    `\n${dry ? "DRY RUN — " : ""}Importing page copy for ${rows.length} clinic(s) from ${file}\n`,
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

    const { paths, unknown } = flatten(raw);
    if (unknown.length) {
      console.log(`✗ ${label}: unsupported field(s) → ${unknown.join(", ")}`);
      failed++;
      continue;
    }
    if (!Object.keys(paths).length) {
      console.log(`✗ ${label}: nothing to write`);
      failed++;
      continue;
    }

    // Compliance gate (PRD §8): the same cure/guarantee scan the admin panel
    // runs, applied here because a machine-authored batch never sees that UI.
    const flags = findFlaggedPhrases(Object.values(paths));
    if (flags.length) {
      const terms = [...new Set(flags)].join(", ");
      console.log(`✗ ${label}: content flags → ${terms}`);
      failed++;
      continue;
    }

    const parsed = clinicUpdateSchema.safeParse(nest(paths));
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

    const summary = Object.entries(paths)
      .map(([path, value]) => `${path} (${value.length} chars)`)
      .join(", ");

    if (dry) {
      console.log(`✓ ${label}: valid → ${summary} — not written`);
      updated++;
      continue;
    }

    const sizeOf = () => ({
      bodyMarkdown: clinic.bodyMarkdown?.length ?? 0,
      reviewsBody: clinic.reviewsPage?.bodyMarkdown?.length ?? 0,
      costBody: clinic.costPage?.bodyMarkdown?.length ?? 0,
      costRows: clinic.costPage?.items?.length ?? 0,
    });
    const before = sizeOf();

    // Path-by-path rather than `set(object)`: setting a whole sub-document would
    // replace it, and these records carry only prose.
    for (const [path, value] of Object.entries(paths)) {
      clinic.set(path, value);
    }
    await clinic.save();
    await recomputeSortScore(clinic._id);
    await recordAudit({
      actorUserId: actor?._id ?? null,
      action: "clinic.update",
      entityType: "Clinic",
      entityId: clinic._id,
      before,
      after: sizeOf(),
    });

    console.log(`✓ ${label}: saved → ${summary}`);
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
