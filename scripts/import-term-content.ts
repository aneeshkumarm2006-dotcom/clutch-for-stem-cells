/**
 * Taxonomy editorial-content importer.
 *
 * Writes long-form content onto EXISTING taxonomy terms (treatments,
 * conditions, cell sources, accreditations, locations) through the SAME
 * validated path the admin editorial panel uses:
 *
 *   Zod (the kind's updateSchema) → sanitize block HTML → the YMYL review gate
 *   (`reviewEditorialWrite`, which rescans for cure/guarantee language and
 *   refuses an unreviewed approval) → update → audit entry.
 *
 * Nothing here bypasses a check the admin form enforces, so content imported
 * this way is indistinguishable from content typed in by an editor, and the
 * editor can keep editing it afterwards.
 *
 *   npm run import-term-content -- scripts/svf-treatment.json
 *   npm run import-term-content -- scripts/svf-treatment.json --dry
 *
 * `--dry` validates, runs the gate, and reports what WOULD change. It writes
 * nothing, which makes it the right way to check a file before committing to it.
 *
 * ── File shape ──────────────────────────────────────────────────────────────
 *   {
 *     "segment": "treatments",          // /admin/taxonomy/<segment>
 *     "terms": [
 *       {
 *         "slug": "svf",                // the term to update (must exist)
 *         "reviewerSlug": "jane-doe",   // optional → resolved to reviewedBy
 *         "description": "...",         // any field the admin form can set
 *         "blocks": [ ... ],            // the modular section builder
 *         "faqs": [ ... ],
 *         "reviewStatus": "approved"
 *       }
 *     ]
 *   }
 *
 * A term is patched with exactly the keys present in its entry, so a file that
 * only carries `blocks` leaves every other field alone. Pass `"body": ""` to
 * clear a field explicitly.
 *
 * Notes:
 *  • The npm script runs tsx with `--conditions=react-server`. That resolves the
 *    `server-only` marker package to its empty build, which is what lets this
 *    script reuse the real admin modules (taxonomy config, the review gate, the
 *    block sanitizer) instead of reimplementing them and drifting from them.
 *  • If your Node can't resolve the MongoDB SRV record, set
 *    SCRIPT_DNS=8.8.8.8,1.1.1.1 before running. Otherwise leave it unset.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getTaxonomyConfig, TAXONOMY_SEGMENTS } from "@/lib/admin/taxonomy-config";
import { sanitizeBlocks } from "@/lib/blocks/server";
import { reviewEditorialWrite } from "@/lib/content-review";
import { blocksSchema } from "@/lib/validation/block";
import { MedicalReviewer } from "@/models";

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes("--dry");
const FILE = ARGS.find((a) => !a.startsWith("--")) ?? "scripts/term-content.json";

function log(msg = ""): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

interface TermEntry extends Record<string, unknown> {
  slug: string;
  /** Resolved to `reviewedBy` before validation. Approval requires one. */
  reviewerSlug?: string;
}

interface ContentFile {
  segment: string;
  terms: TermEntry[];
}

function readFile(): ContentFile {
  const path = resolve(process.cwd(), FILE);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ContentFile;
  if (!parsed.segment || !Array.isArray(parsed.terms)) {
    throw new Error(`${FILE}: expected { "segment": "...", "terms": [ ... ] }`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());

  if (!process.env.MONGODB_URI) {
    log("✗ MONGODB_URI is not set. Add it to .env.local.");
    process.exitCode = 1;
    return;
  }

  const file = readFile();
  const config = getTaxonomyConfig(file.segment);
  if (!config) {
    log(
      `✗ Unknown segment "${file.segment}". Expected one of: ${TAXONOMY_SEGMENTS.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  log(`→ ${FILE}: ${file.terms.length} ${config.label.toLowerCase()}${DRY ? "  [dry run]" : ""}\n`);

  await dbConnect();

  let updated = 0;
  let failed = 0;

  for (const entry of file.terms) {
    const { slug, reviewerSlug, ...rest } = entry;
    const patch: Record<string, unknown> = { ...rest };

    const doc = await config.model.findOne({ slug }).lean();
    if (!doc) {
      log(`  ✗ ${slug}: no such ${config.singular}. Create it first.`);
      failed++;
      continue;
    }

    // Reviewer is referenced by slug so the file stays free of ObjectIds.
    if (reviewerSlug) {
      const reviewer = await MedicalReviewer.findOne({ slug: reviewerSlug })
        .select("_id isActive")
        .lean();
      if (!reviewer) {
        log(`  ✗ ${slug}: no medical reviewer with slug "${reviewerSlug}".`);
        failed++;
        continue;
      }
      if (!reviewer.isActive) {
        log(`  ✗ ${slug}: reviewer "${reviewerSlug}" is inactive.`);
        failed++;
        continue;
      }
      patch.reviewedBy = String(reviewer._id);
    }

    // 1. Validate exactly as the API route does.
    const parsed = config.updateSchema.safeParse(patch);
    if (!parsed.success) {
      log(`  ✗ ${slug}: validation failed`);
      for (const issue of parsed.error.issues) {
        log(`      ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      failed++;
      continue;
    }
    const data = parsed.data as Record<string, unknown>;

    // 2. Sanitize block HTML — never trusted, wherever it came from.
    if (data.blocks !== undefined) {
      data.blocks = sanitizeBlocks(blocksSchema.parse(data.blocks));
    }

    // 3. The YMYL gate, on the merged (existing + patch) state.
    const existing = doc as unknown as Record<string, unknown>;
    const gate = reviewEditorialWrite(existing, data);
    if (gate.error) {
      log(`  ✗ ${slug}: ${gate.error}`);
      failed++;
      continue;
    }
    if (gate.contentFlags.length) {
      log(
        `    ! ${slug}: flagged phrases — ${gate.contentFlags
          .map((f) => f.phrase)
          .join(", ")}`,
      );
    }

    const fields = Object.keys(data).join(", ");
    const status = (data.reviewStatus ?? existing.reviewStatus) as string;

    if (DRY) {
      log(`  · ${slug}: would set ${fields}  (reviewStatus: ${status})`);
      updated++;
      continue;
    }

    const isApproved = status === "approved";
    await config.model.updateOne(
      { _id: doc._id },
      {
        $set: {
          ...data,
          contentFlags: gate.contentFlags,
          ...(isApproved && data.lastReviewedAt == null
            ? { lastReviewedAt: new Date() }
            : {}),
        },
      },
    );

    await recordAudit({
      action: `${config.kind}.update`,
      entityType: config.kind.charAt(0).toUpperCase() + config.kind.slice(1),
      entityId: doc._id,
      after: { source: FILE, fields: Object.keys(data) },
    });

    log(`  ✓ ${slug}: ${fields}  (reviewStatus: ${status})`);
    updated++;
  }

  log();
  log(
    `${DRY ? "[dry] " : ""}${updated} updated, ${failed} failed.` +
      (DRY ? "  Nothing was written." : ""),
  );
  if (failed) process.exitCode = 1;

  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
