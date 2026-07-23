/**
 * One-off rebrand utility — replace a stale brand string across the database.
 *
 * The brand name is *not* hard-coded anywhere in the app (everything reads
 * `SITE_NAME` from config/site.ts). The only place an old name survives is
 * runtime data stored in MongoDB — chiefly the `SiteSetting` singleton
 * (`seoDefaults.titleTemplate`, `structuredData.organizationName`, …) plus any
 * authored content that typed it literally.
 *
 * Usage:
 *   tsx scripts/rebrand.ts            # DRY: scan every collection, report only
 *   tsx scripts/rebrand.ts --apply    # rewrite OLD -> NEW in every string field
 *
 * OLD/NEW are set below. Safe to re-run (idempotent).
 */
import dns from "node:dns";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";

// Atlas SRV lookups fail on some networks/resolvers; allow an override, e.g.
//   SCRIPT_DNS=8.8.8.8,1.1.1.1 tsx scripts/rebrand.ts
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

const OLD = "StemConnect";
const NEW = "My Stem Cell Guide";
const APPLY = process.argv.includes("--apply");

/** Load env from .env.local / .env (Next-style) so MONGODB_URI is available. */
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
    /* fall through to minimal parser */
  }
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
        if (!m) continue;
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        )
          val = val.slice(1, -1);
        if (process.env[m[1]] === undefined) process.env[m[1]] = val;
      }
    } catch {
      /* file absent — ignore */
    }
  }
}

/** True for BSON leaf types we must never recurse into or clone. */
function isLeaf(v: unknown): boolean {
  return (
    v instanceof mongoose.Types.ObjectId ||
    v instanceof Date ||
    Buffer.isBuffer(v) ||
    v instanceof mongoose.Types.Decimal128
  );
}

/**
 * Recursively rewrite OLD -> NEW inside string values. Returns the number of
 * replacements made and mutates `node` in place for plain objects/arrays.
 */
function rewrite(node: unknown, path: string, hits: string[]): unknown {
  if (typeof node === "string") {
    if (node.includes(OLD)) {
      hits.push(`${path}: ${JSON.stringify(node)}`);
      return node.split(OLD).join(NEW);
    }
    return node;
  }
  if (node == null || isLeaf(node) || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++)
      node[i] = rewrite(node[i], `${path}[${i}]`, hits);
    return node;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj))
    obj[key] = rewrite(obj[key], path ? `${path}.${key}` : key, hits);
  return obj;
}

async function main(): Promise<void> {
  await loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error("✗ MONGODB_URI is not set (site/.env.local).");
    process.exit(1);
  }

  const conn = await dbConnect();
  const db = conn.connection.db;
  if (!db) throw new Error("No database handle after connect.");

  console.log(
    `\n🔎 Scanning for "${OLD}" -> "${NEW}"  [${APPLY ? "APPLY" : "DRY RUN"}]\n`,
  );

  const collections = await db.listCollections().toArray();
  let totalDocs = 0;
  let totalFields = 0;

  for (const { name } of collections) {
    const col = db.collection(name);
    const docs = await col.find({}).toArray();
    let colDocs = 0;
    let colFields = 0;
    for (const doc of docs) {
      const hits: string[] = [];
      const updated = rewrite(doc, "", hits) as Record<string, unknown>;
      if (hits.length === 0) continue;
      colDocs++;
      colFields += hits.length;
      console.log(`  • ${name}/${String(doc._id)}`);
      for (const h of hits) console.log(`      ${h}`);
      if (APPLY) {
        const { _id, ...rest } = updated;
        await col.replaceOne({ _id: _id as mongoose.Types.ObjectId }, rest);
      }
    }
    if (colDocs)
      console.log(
        `    → ${name}: ${colFields} field(s) in ${colDocs} doc(s)${APPLY ? " updated" : ""}\n`,
      );
    totalDocs += colDocs;
    totalFields += colFields;
  }

  console.log(
    `\n${APPLY ? "✅ Applied" : "📋 Would change"}: ${totalFields} field(s) across ${totalDocs} doc(s).` +
      (APPLY ? "" : "\n   Re-run with --apply to write.\n"),
  );

  await conn.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
