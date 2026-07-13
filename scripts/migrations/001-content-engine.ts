/**
 * Migration 001 — structured-data engine + modular content/SEO layer.
 *
 * Usage:
 *   npm run migrate           # apply (up)
 *   npm run migrate -- --down # roll back (down)
 *   npm run migrate -- --dry  # report what would change, touch nothing
 *
 * ── What `up` does ─────────────────────────────────────────────────────────
 * Almost nothing, deliberately. Every field this feature adds is **optional**,
 * and MongoDB is schemaless — an existing document that simply lacks
 * `seo.ogTitle` or `schemaOverrides` already reads correctly (the code falls
 * back to the derived/global value). So there is no backfill to run and no
 * document to rewrite: the risky part of a migration doesn't exist here.
 *
 * What it *does* do is create the indexes the two new collections need, and
 * (optionally) seed `SiteSetting.structuredData` from the existing constants so
 * the admin Settings screen opens pre-filled rather than blank.
 *
 * ── What `down` does ───────────────────────────────────────────────────────
 * Drops the two new collections (`pages`, `redirects`) and `$unset`s every field
 * this feature introduced, returning each document to its pre-migration shape.
 * No pre-existing field is renamed, moved, or removed by `up`, so `down` is a
 * genuine inverse rather than a best-effort cleanup.
 *
 * `down` DOES destroy editor-authored content (composed pages, redirects) —
 * that content did not exist before this migration. It prompts unless `--force`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { CONTENT_ENGINE } from "@/config/content-engine";
import {
  Clinic,
  Condition,
  Accreditation,
  BlogPost,
  CellSource,
  GLOBAL_SETTINGS_KEY,
  Location,
  MatrixPage,
  Page,
  Redirect,
  SiteSetting,
  Treatment,
} from "@/models";

const DOWN = process.argv.includes("--down");
const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");

/** Every model that gained an optional `schemaOverrides` sub-document. */
const SCHEMA_OVERRIDE_MODELS = [
  Clinic,
  BlogPost,
  MatrixPage,
  Treatment,
  Condition,
  CellSource,
  Accreditation,
  Location,
];

/** Every model whose embedded `seo` gained the extended fields. */
const EXTENDED_SEO_MODELS = [
  Clinic,
  BlogPost,
  MatrixPage,
  Treatment,
  Condition,
  CellSource,
  Accreditation,
  Location,
];

/** The keys `up` introduces inside an embedded `seo` sub-document. */
const NEW_SEO_KEYS = [
  "seo.ogTitle",
  "seo.ogDescription",
  "seo.twitterCard",
  "seo.focusKeyword",
  "seo.robots",
];

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

/** Load env from .env.local / .env (mirrors `scripts/seed.ts`). */
async function loadEnv(): Promise<void> {
  try {
    const mod = await import("@next/env");
    const ns = mod as unknown as {
      default?: { loadEnvConfig?: typeof mod.loadEnvConfig };
      loadEnvConfig?: typeof mod.loadEnvConfig;
    };
    const loadEnvConfig = ns.default?.loadEnvConfig ?? ns.loadEnvConfig;
    if (typeof loadEnvConfig === "function") {
      loadEnvConfig(process.cwd());
      if (process.env.MONGODB_URI) return;
    }
  } catch {
    // Fall back to a minimal parser if @next/env isn't resolvable.
  }
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
        if (!m) continue;
        const key = m[1]!;
        let val = m[2]!.trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      // file not present — ignore
    }
  }
}

// ── up ──────────────────────────────────────────────────────────────────────

async function up(): Promise<void> {
  log("→ Migration 001 (up): structured-data engine + modular content\n");

  log("  All added fields are optional; no document backfill is required.");
  log("  Existing records already resolve correctly without them.\n");

  if (DRY) {
    log("  [dry] would create indexes for: pages, redirects");
    log("  [dry] would seed SiteSetting.structuredData defaults");
    return;
  }

  // 1. Indexes for the two new collections.
  await Page.createIndexes();
  await Redirect.createIndexes();
  log("  ✓ Indexes created (pages, redirects)");

  // 2. Pre-fill the structured-data settings so the admin screen isn't blank.
  //    `$setOnInsert`-style semantics: only fill what the admin hasn't set.
  const settings = await SiteSetting.getGlobal();
  const sd = settings.structuredData ?? {};
  const patch: Record<string, unknown> = {};

  if (!sd.organizationName?.trim()) {
    patch["structuredData.organizationName"] = CONTENT_ENGINE.siteIdentity.name;
  }
  if (!sd.organizationType?.trim()) {
    patch["structuredData.organizationType"] =
      CONTENT_ENGINE.siteIdentity.organizationType;
  }

  if (Object.keys(patch).length) {
    await SiteSetting.updateOne(
      { key: GLOBAL_SETTINGS_KEY },
      { $set: patch },
      { upsert: true },
    );
    log(`  ✓ Seeded SiteSetting.structuredData (${Object.keys(patch).length} field(s))`);
  } else {
    log("  · SiteSetting.structuredData already set — left untouched");
  }

  log("\n✓ Migration 001 applied.");
}

// ── down ────────────────────────────────────────────────────────────────────

async function down(): Promise<void> {
  log("→ Migration 001 (down): reverting structured-data engine\n");

  const pageCount = await Page.estimatedDocumentCount();
  const redirectCount = await Redirect.estimatedDocumentCount();

  if ((pageCount > 0 || redirectCount > 0) && !FORCE && !DRY) {
    log(
      `  ✗ Refusing to drop ${pageCount} composed page(s) and ${redirectCount} redirect(s).\n` +
        "    This content was created after the migration and will be lost.\n" +
        "    Re-run with --force if that is what you intend.",
    );
    process.exitCode = 1;
    return;
  }

  if (DRY) {
    log(`  [dry] would drop collections: pages (${pageCount}), redirects (${redirectCount})`);
    log("  [dry] would $unset schemaOverrides on 8 collections");
    log(`  [dry] would $unset ${NEW_SEO_KEYS.join(", ")} on 8 collections`);
    log("  [dry] would $unset SiteSetting.structuredData");
    return;
  }

  // 1. Drop the collections this feature introduced.
  //    `.drop()` throws NamespaceNotFound (26) when the collection was never
  //    created — that is a successful no-op, not an error.
  for (const model of [Page, Redirect]) {
    try {
      await model.collection.drop();
      log(`  ✓ Dropped ${model.collection.name}`);
    } catch (err) {
      if ((err as { code?: number }).code === 26) {
        log(`  · ${model.collection.name} did not exist`);
      } else {
        throw err;
      }
    }
  }

  // 2. Remove the optional sub-documents added to existing collections.
  for (const model of SCHEMA_OVERRIDE_MODELS) {
    const res = await model.updateMany(
      { schemaOverrides: { $exists: true } },
      { $unset: { schemaOverrides: "" } },
    );
    if (res.modifiedCount) {
      log(`  ✓ ${model.modelName}: unset schemaOverrides on ${res.modifiedCount}`);
    }
  }

  // 3. Remove the SEO fields added to the shared embedded `seo` sub-document.
  const unsetSeo = Object.fromEntries(NEW_SEO_KEYS.map((k) => [k, ""]));
  for (const model of EXTENDED_SEO_MODELS) {
    const res = await model.updateMany({}, { $unset: unsetSeo });
    if (res.modifiedCount) {
      log(`  ✓ ${model.modelName}: unset extended seo fields on ${res.modifiedCount}`);
    }
  }

  // 4. BlogPost additionally gained a whole `seo` sub-document (it had none).
  const blogSeo = await BlogPost.updateMany(
    { seo: { $exists: true } },
    { $unset: { seo: "" } },
  );
  if (blogSeo.modifiedCount) {
    log(`  ✓ BlogPost: unset seo on ${blogSeo.modifiedCount}`);
  }

  // 5. Settings.
  await SiteSetting.updateOne(
    { key: GLOBAL_SETTINGS_KEY },
    { $unset: { structuredData: "" } },
  );
  log("  ✓ SiteSetting: unset structuredData");

  log("\n✓ Migration 001 reverted.");
}

// ── entry ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await loadEnv();

  if (!process.env.MONGODB_URI) {
    log("✗ MONGODB_URI is not set. Add it to .env.local.");
    process.exitCode = 1;
    return;
  }

  await dbConnect();
  if (DOWN) await down();
  else await up();
  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
