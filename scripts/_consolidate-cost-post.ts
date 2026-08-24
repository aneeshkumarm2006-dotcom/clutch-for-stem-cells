/**
 * One-off: consolidate the duplicate stem-cell-cost blog posts.
 *
 * `/blog/stem-cell-shot-cost-what-determines-the-price-of-regenerative-therapy`
 * and `/blog/how-much-do-stem-cell-injections-cost` target the same query, so
 * the first is retired into the second (SEO brief, 2026-08-22):
 *
 *   1. A 301 Redirect row  old → new  (same validation the admin API uses).
 *   2. The old post is UNPUBLISHED, not deleted. Redirect resolution runs in
 *      the not-found boundary (`lib/redirects.ts`), and a URL that still
 *      resolves to a live page deliberately wins over a redirect — so the old
 *      post has to stop resolving for the 301 to fire. Draft keeps the copy in
 *      /seoteam, so nothing is lost and it is reversible.
 *
 * Run:  SCRIPT_DNS=8.8.8.8,1.1.1.1 npx tsx --conditions=react-server \
 *         scripts/_consolidate-cost-post.ts [--dry]
 */
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { redirectCreateSchema } from "@/lib/validation/redirect";
import { BlogPost, Redirect } from "@/models";

const DRY = process.argv.includes("--dry");

const OLD_SLUG =
  "stem-cell-shot-cost-what-determines-the-price-of-regenerative-therapy";
const NEW_SLUG = "how-much-do-stem-cell-injections-cost";

function log(msg = ""): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

async function main(): Promise<void> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());

  if (!process.env.MONGODB_URI) {
    log("✗ MONGODB_URI is not set.");
    process.exitCode = 1;
    return;
  }

  await dbConnect();

  // The destination must be live, or the 301 lands on a 404.
  const target = await BlogPost.findOne({ slug: NEW_SLUG })
    .select("slug status publishedAt")
    .lean<{ slug: string; status: string; publishedAt?: Date | null }>();
  if (!target || target.status !== "published") {
    log(`✗ /blog/${NEW_SLUG} is not published. Aborting.`);
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }
  log(`✓ destination /blog/${NEW_SLUG} is published`);

  const parsed = redirectCreateSchema.safeParse({
    from: `/blog/${OLD_SLUG}`,
    to: `/blog/${NEW_SLUG}`,
    statusCode: 301,
  });
  if (!parsed.success) {
    log(`✗ redirect failed validation: ${parsed.error.issues[0]?.message}`);
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }
  const data = parsed.data;

  const exists = await Redirect.findOne({ from: data.from }).lean<{
    to: string;
  }>();
  const source = await BlogPost.findOne({ slug: OLD_SLUG });
  if (!source) {
    log(`✗ /blog/${OLD_SLUG} not found.`);
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  if (DRY) {
    log(
      exists
        ? `· redirect already exists: ${data.from} → ${exists.to}`
        : `· would create 301  ${data.from} → ${data.to}`,
    );
    log(`· would set /blog/${OLD_SLUG} to draft (currently ${source.status})`);
    log("\n[dry] nothing was written.");
    await mongoose.disconnect();
    return;
  }

  if (exists) {
    log(`· redirect already exists: ${data.from} → ${exists.to}`);
  } else {
    const doc = await Redirect.create(data);
    await recordAudit({
      action: "redirect.create",
      entityType: "Redirect",
      entityId: doc._id,
      after: { from: doc.from, to: doc.to, statusCode: doc.statusCode },
    });
    log(`✓ created 301  ${doc.from} → ${doc.to}`);
  }

  if (source.status === "published") {
    source.status = "draft";
    source.publishedAt = null;
    await source.save();
    await recordAudit({
      action: "blogPost.update",
      entityType: "BlogPost",
      entityId: source._id,
      after: {
        slug: OLD_SLUG,
        status: "draft",
        reason: `consolidated into /blog/${NEW_SLUG}`,
      },
    });
    log(`✓ /blog/${OLD_SLUG} unpublished (draft) so the 301 can fire`);
  } else {
    log(`· /blog/${OLD_SLUG} already ${source.status}`);
  }

  log(
    "\nNote: the redirect map is cached for 5 minutes (unstable_cache) and blog\n" +
      "pages revalidate every 60s, so the 301 goes live within a few minutes.",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
