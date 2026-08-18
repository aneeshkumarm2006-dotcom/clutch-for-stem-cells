/**
 * Composed-page importer.
 *
 * Creates or updates block-composed `Page` records through the SAME validated
 * path the /seoteam CMS uses:
 *
 *   Zod (pageCreateSchema / pageUpdateSchema) -> sanitize block HTML -> the YMYL
 *   review gate (`reviewEditorialWrite`, which rescans every block for
 *   cure/guarantee language and refuses a flagged approval) -> write -> audit.
 *
 * Nothing here bypasses a check the CMS enforces, so an imported page is
 * indistinguishable from one composed by hand and stays fully editable at
 * /seoteam afterwards.
 *
 *   npm run import-pages -- scripts/pages-locations.json
 *   npm run import-pages -- scripts/pages-locations.json --dry
 *
 * `--dry` validates, runs the gate, and reports what WOULD change without
 * writing anything. Run it before committing to a file.
 *
 * -- File shape --------------------------------------------------------------
 *   {
 *     "pages": [
 *       {
 *         "slug": "stem-cell-therapy-ohio",   // the key; upserted on
 *         "title": "Stem Cell Therapy in Ohio",
 *         "intro": "...",                     // answer-first summary
 *         "blocks": [ { "type": "richText", "data": { "html": "..." } } ],
 *         "seo": { "metaTitle": "...", "metaDescription": "..." },
 *         "reviewerSlug": "jane-doe",         // optional -> reviewedBy
 *         "reviewStatus": "approved"          // default: draft
 *       }
 *     ]
 *   }
 *
 * An existing page is patched with exactly the keys present in its entry, so a
 * file carrying only `blocks` leaves title/seo/status alone. A slug rename is
 * deliberately not supported here: rename in the CMS, where the 301 is recorded.
 *
 * Notes:
 *  - The npm script runs tsx with `--conditions=react-server` so the
 *    `server-only` marker resolves to its empty build, which is what lets this
 *    reuse the real CMS modules (validation, sanitizer, review gate) instead of
 *    reimplementing and drifting from them.
 *  - If your Node cannot resolve the MongoDB SRV record, set
 *    SCRIPT_DNS=8.8.8.8,1.1.1.1 before running. Otherwise leave it unset.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";

import { recordAudit } from "@/lib/audit";
import {
  blocksFaqs,
  blocksScanText,
  sanitizeBlocks,
} from "@/lib/blocks/server";
import { reviewEditorialWrite } from "@/lib/content-review";
import { dbConnect } from "@/lib/db";
import { isReservedSlug } from "@/lib/seoteam/page-slug";
import { pageCreateSchema, pageUpdateSchema } from "@/lib/validation/page";
import { MedicalReviewer, Page } from "@/models";

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes("--dry");
const FILE = ARGS.find((a) => !a.startsWith("--")) ?? "scripts/pages.json";

function log(msg = ""): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

interface PageEntry extends Record<string, unknown> {
  slug: string;
  /** Resolved to `reviewedBy` before validation. */
  reviewerSlug?: string;
}

interface PagesFile {
  pages: PageEntry[];
}

function readFile(): PagesFile {
  const path = resolve(process.cwd(), FILE);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as PagesFile;
  if (!Array.isArray(parsed.pages)) {
    throw new Error(`${FILE}: expected { "pages": [ ... ] }`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());

  if (!process.env.MONGODB_URI) {
    log("x MONGODB_URI is not set. Add it to .env.local.");
    process.exitCode = 1;
    return;
  }

  const file = readFile();
  log(`-> ${FILE}: ${file.pages.length} page(s)${DRY ? "  [dry run]" : ""}\n`);

  await dbConnect();

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const entry of file.pages) {
    const { reviewerSlug, ...rest } = entry;
    const patch: Record<string, unknown> = { ...rest };
    const slug = String(entry.slug ?? "");

    if (!slug) {
      log("  x (entry with no slug) skipped.");
      failed++;
      continue;
    }
    if (isReservedSlug(slug)) {
      log(`  x ${slug}: reserved by an existing route. Pick another slug.`);
      failed++;
      continue;
    }

    // Reviewer is referenced by slug so the file stays free of ObjectIds.
    if (reviewerSlug) {
      const reviewer = await MedicalReviewer.findOne({ slug: reviewerSlug })
        .select("_id isActive")
        .lean<{ _id: unknown; isActive?: boolean } | null>();
      if (!reviewer) {
        log(`  x ${slug}: no medical reviewer with slug "${reviewerSlug}".`);
        failed++;
        continue;
      }
      if (!reviewer.isActive) {
        log(`  x ${slug}: reviewer "${reviewerSlug}" is inactive.`);
        failed++;
        continue;
      }
      patch.reviewedBy = String(reviewer._id);
    }

    const existing = await Page.findOne({ slug });

    // 1. Validate exactly as the API route does: create vs patch semantics.
    const schema = existing ? pageUpdateSchema : pageCreateSchema;
    const parsed = schema.safeParse(patch);
    if (!parsed.success) {
      log(`  x ${slug}: validation failed`);
      for (const issue of parsed.error.issues) {
        log(`      ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      failed++;
      continue;
    }
    const data = parsed.data as Record<string, unknown>;

    // 2. Sanitize block HTML: never trusted, wherever it came from.
    const blocks = data.blocks
      ? sanitizeBlocks(data.blocks as never)
      : ((existing?.blocks ?? []) as never);
    if (data.blocks) data.blocks = blocks;

    // 3. The YMYL gate, on the merged (existing + patch) state. Blocks are
    //    projected into the flat body/faqs shape the scanner understands.
    const gate = reviewEditorialWrite(
      existing
        ? (existing.toObject() as unknown as Record<string, unknown>)
        : null,
      { ...data, body: blocksScanText(blocks), faqs: blocksFaqs(blocks) },
    );
    if (gate.error) {
      log(`  x ${slug}: ${gate.error}`);
      failed++;
      continue;
    }
    if (gate.contentFlags.length) {
      log(
        `    ! ${slug}: flagged phrases: ${gate.contentFlags
          .map((f) => f.phrase)
          .join(", ")}`,
      );
    }

    const fields = Object.keys(data).join(", ");
    const status = (data.reviewStatus ??
      existing?.reviewStatus ??
      "draft") as string;

    if (DRY) {
      const verb = existing ? "update" : "create";
      log(`  . ${slug}: would ${verb} ${fields}  (reviewStatus: ${status})`);
      if (existing) updated++;
      else created++;
      continue;
    }

    const approved = status === "approved";

    if (existing) {
      const wasApproved = existing.reviewStatus === "approved";
      existing.set({ ...data, contentFlags: gate.contentFlags });
      if (approved && !wasApproved) {
        existing.publishedAt ??= new Date();
        existing.lastReviewedAt ??= new Date();
      }
      await existing.save();
      await recordAudit({
        action: "page.update",
        entityType: "Page",
        entityId: existing._id,
        after: { source: FILE, fields: Object.keys(data) },
      });
      log(`  + ${slug}: updated ${fields}  (reviewStatus: ${status})`);
      updated++;
    } else {
      const doc = await Page.create({
        ...data,
        blocks,
        contentFlags: gate.contentFlags,
        publishedAt: approved ? new Date() : null,
        lastReviewedAt: data.lastReviewedAt ?? (approved ? new Date() : null),
      });
      await recordAudit({
        action: "page.create",
        entityType: "Page",
        entityId: doc._id,
        after: { source: FILE, fields: Object.keys(data) },
      });
      log(`  + ${slug}: created  (reviewStatus: ${status})`);
      created++;
    }
  }

  log();
  log(
    `${DRY ? "[dry] " : ""}${created} created, ${updated} updated, ${failed} failed.` +
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
