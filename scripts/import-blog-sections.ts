/**
 * Blog body importer — writes long-form section additions onto EXISTING posts
 * through the same path `PATCH /api/seoteam/posts/[id]` uses:
 *
 *   sanitizeBlogHtml(body) → estimateReadingTime(htmlToText(body)) → save
 *
 * Nothing here bypasses a check the /seoteam editor enforces, so imported copy
 * is indistinguishable from copy typed into the editor and stays editable there.
 *
 *   npm run import-blog-sections -- scripts/<file>.json [--dry]
 *
 * `--dry` reports what would change and writes nothing.
 *
 * ── File shape ──────────────────────────────────────────────────────────────
 *   { "<slug>": { "_id": "<objectid>", "body": "<full sanitized-ready HTML>" } }
 *
 * `body` is the COMPLETE new body, not a patch: build it from the stored body
 * so an insertion can be verified before it is written.
 *
 * The public pages pick the change up on the next ISR pass (`revalidate = 60`)
 * — a script has no `revalidatePath`.
 *
 * Set SCRIPT_DNS=8.8.8.8,1.1.1.1 if the Atlas SRV lookup fails.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { estimateReadingTime } from "@/lib/reading-time";
import { sanitizeBlogHtml } from "@/lib/seoteam/sanitize";
import { htmlToText } from "@/lib/seoteam/seo-checks";
import { scanContentFlags } from "@/lib/content-flags";
import { BlogPost } from "@/models";

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes("--dry");
const FILE =
  ARGS.find((a) => !a.startsWith("--")) ?? "scripts/blog-sections.json";

function log(msg = ""): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

interface Entry {
  _id?: string;
  body: string;
}

async function main(): Promise<void> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());

  if (!process.env.MONGODB_URI) {
    log("✗ MONGODB_URI is not set. Add it to .env.local.");
    process.exitCode = 1;
    return;
  }

  const file = JSON.parse(
    readFileSync(resolve(process.cwd(), FILE), "utf8"),
  ) as Record<string, Entry>;
  const slugs = Object.keys(file);

  log(`→ ${FILE}: ${slugs.length} posts${DRY ? "  [dry run]" : ""}\n`);

  await dbConnect();

  let updated = 0;
  let failed = 0;

  for (const slug of slugs) {
    const entry = file[slug]!;
    const post = await BlogPost.findOne({ slug });
    if (!post) {
      log(`  ✗ ${slug}: no such post.`);
      failed++;
      continue;
    }
    if (entry._id && String(post._id) !== entry._id) {
      log(
        `  ✗ ${slug}: id mismatch (file ${entry._id}, db ${String(post._id)}).`,
      );
      failed++;
      continue;
    }

    const body = sanitizeBlogHtml(entry.body);
    const text = htmlToText(body);
    const readingTime = estimateReadingTime(text);
    const before = post.body.length;

    // Advisory only, exactly as in the admin: report, never block.
    const flags = scanContentFlags(text);
    if (flags.length) {
      log(
        `    ! ${slug}: flagged phrases — ${flags.map((f) => f.phrase).join(", ")}`,
      );
    }

    if (DRY) {
      log(
        `  · ${slug}: would set body ${before} → ${body.length} chars, readingTime ${post.readingTime ?? "?"} → ${readingTime}`,
      );
      updated++;
      continue;
    }

    post.body = body;
    post.readingTime = readingTime;
    await post.save();

    log(
      `  ✓ ${slug}: body ${before} → ${body.length} chars, readingTime ${readingTime} min`,
    );
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
