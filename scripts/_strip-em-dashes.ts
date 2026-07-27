/**
 * One-off: find (and optionally rewrite) em dashes in stored CMS content.
 *
 * The repo-side sweep on 2026-07-27 removed every em dash from copy that ships
 * in the codebase. Real content lives in MongoDB, so this is the other half:
 * it walks every string in every document of the content collections and
 * reports, or rewrites, anything carrying `—`.
 *
 * `buildMetadata` already strips em dashes out of meta on the way to the
 * `<head>` (see `lib/meta-text.ts`), so this exists for **body copy**, which is
 * never normalized at render time.
 *
 * Usage:
 *   npx tsx scripts/_strip-em-dashes.ts              # scan, print every hit
 *   npx tsx scripts/_strip-em-dashes.ts --apply      # write the rewrites
 *   npx tsx scripts/_strip-em-dashes.ts --json out.json
 *
 * Prefix with SCRIPT_DNS=8.8.8.8,1.1.1.1 if Atlas SRV lookup fails.
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import { writeFileSync } from "node:fs";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";

const EM = /[—―‒–]/; // em, horizontal bar, figure dash, en dash
const EM_ONLY = /—/;

/**
 * Collections this script is allowed to rewrite. Everything else in the
 * database is either a historical record, a private submission, or machinery.
 */
const CONTENT_COLLECTIONS = [
  "clinics",
  "cliniclandings",
  "treatments",
  "conditions",
  "cellsources",
  "accreditations",
  "locations",
  "pages",
  "blogposts",
  "matricespage",
  "medicalreviewers",
  "sitesettings",
];

/**
 * `reviews` is a special case. `body` is the patient's own words and is never
 * touched; `providerResponse.body` is the clinic's public reply, which is
 * business-authored copy like any other listing field. Only the latter is
 * eligible, enforced by this prefix.
 */
const REVIEW_EDITABLE_PREFIX = "providerResponse.";

/**
 * Never rewritten, and why:
 *  - auditlogs      an audit trail; rewriting history corrupts the record
 *  - leads/reports  private submissions, never rendered publicly
 *  - users/sessions/analyticsevents/media  machinery, no prose
 */
const EXCLUDED = new Set([
  "auditlogs",
  "leads",
  "reports",
  "users",
  "sessions",
  "accounts",
  "analyticsevents",
  "redirects",
  "media",
  "analyticshubconfigs",
]);

/**
 * Hand-written rewrites, one per em dash. Each `from` must appear verbatim in
 * the stored string or the run aborts before writing anything — a silent skip
 * would leave an em dash behind and report success.
 *
 * The windows deliberately avoid apostrophes, which appear as both `'` and `’`
 * in stored copy. These mirror the repo-side rewrites for the same sentences.
 */
const REWRITES: { from: string; to: string }[] = [
  // clinics
  { from: "Yes — an initial", to: "Yes. An initial" },
  { from: "Yes — we coordinate", to: "Yes. We coordinate" },
  { from: "own cells — PRP", to: "own cells (PRP" },
  { from: "concentrate — delivered", to: "concentrate) delivered" },
  { from: "outpatient basis — most", to: "outpatient basis, and most" },
  {
    from: "or exosomes — no embryonic or fetal cells.",
    to: "or exosomes. No embryonic or fetal cells are used.",
  },
  { from: "claim cures — the aim", to: "claim cures. The aim" },
  { from: "Not right now — US", to: "Not right now. US" },
  { from: "Opened in 2013 — one of", to: "Opened in 2013, one of" },
  {
    from: "umbilical-cord cells — no embryonic",
    to: "umbilical-cord cells, never embryonic",
  },
  // clinic landings
  { from: "patients use — it is a short drive", to: "patients use, a short drive" },
  { from: "options here — and read", to: "options here, and read" },
  // pages
  { from: "actually shows — a clinic", to: "actually shows. A clinic" },
  {
    from: "Which is appropriate — if either is — depends",
    to: "Which is appropriate, if either is, depends",
  },
  {
    from: "harvesting step — liposuction or a bone-marrow aspiration — plus",
    to: "harvesting step (liposuction or a bone-marrow aspiration) plus",
  },
  { from: "advanced degeneration — and evidence", to: "advanced degeneration, and evidence" },
  // blog post (unspaced em dash)
  { from: "therapy—an umbrella term", to: "therapy, an umbrella term" },
  // site settings (homepage overlay)
  { from: "The cell source — your own cells", to: "The cell source: your own cells" },
  { from: "country you travel to — a single knee", to: "country you travel to. A single knee" },
  { from: "fat or marrow — bone-marrow-derived", to: "fat or marrow, and bone-marrow-derived" },
  // review provider response
  { from: "Thank you, James — we", to: "Thank you, James. We" },
];

/** `faqs[0].answer` → `faqs.0.answer` for `$set`. */
const toDotted = (path: string): string => path.replace(/\[(\d+)\]/g, ".$1");

/** Apply every rule that matches. Returns null when the result still has one. */
function rewrite(value: string): string | null {
  let out = value;
  for (const r of REWRITES) {
    if (out.includes(r.from)) out = out.split(r.from).join(r.to);
  }
  return out.includes("—") ? null : out;
}

/** Keys whose values are identifiers or URLs, never prose. */
const SKIP_KEYS = new Set([
  "_id",
  "slug",
  "url",
  "href",
  "src",
  "publicId",
  "public_id",
  "email",
  "phone",
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "canonicalUrl",
  "image",
  "imageUrl",
  "ogImage",
  "logo",
  "favicon",
  "icon",
  "provider",
  "providerAccountId",
  "__v",
]);

const isUrlish = (s: string): boolean => /^(https?:\/\/|\/|data:)/.test(s.trim());

export interface Hit {
  collection: string;
  id: string;
  label: string;
  path: string;
  value: string;
}

/** Recursively collect every em-dash-bearing string, with its dotted path. */
function collect(
  node: unknown,
  path: string,
  out: { path: string; value: string }[],
): void {
  if (typeof node === "string") {
    if (EM_ONLY.test(node) && !isUrlish(node)) out.push({ path, value: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => collect(v, `${path}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    if (node instanceof Date || node instanceof mongoose.Types.ObjectId) return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (SKIP_KEYS.has(k)) continue;
      collect(v, path ? `${path}.${k}` : k, out);
    }
  }
}

const labelOf = (doc: Record<string, unknown>): string =>
  (doc.name as string) ||
  (doc.title as string) ||
  (doc.heading as string) ||
  (doc.slug as string) ||
  String(doc._id);

async function main(): Promise<void> {
  const mod = await import("@next/env");
  (mod.loadEnvConfig ?? (mod as any).default?.loadEnvConfig)?.(process.cwd());

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const jsonAt = args.indexOf("--json");
  const jsonPath = jsonAt >= 0 ? args[jsonAt + 1] : null;

  await dbConnect();
  const db = mongoose.connection.db!;

  const present = (await db.listCollections().toArray()).map((c) => c.name);
  const scanned = new Set([...CONTENT_COLLECTIONS, "reviews"]);
  const unknown = present.filter((c) => !scanned.has(c) && !EXCLUDED.has(c));

  const hits: Hit[] = [];

  for (const collection of [...CONTENT_COLLECTIONS, "reviews"]) {
    if (!present.includes(collection)) continue;
    const docs = await db.collection(collection).find({}).toArray();
    for (const doc of docs) {
      const found: { path: string; value: string }[] = [];
      collect(doc, "", found);
      for (const f of found) {
        // Patient-written review copy is off limits; only the clinic's reply.
        if (collection === "reviews" && !f.path.startsWith(REVIEW_EDITABLE_PREFIX)) {
          console.log(
            `SKIP  reviews/${doc._id} [${f.path}] — patient-written, not ours to edit`,
          );
          continue;
        }
        hits.push({
          collection,
          id: String(doc._id),
          label: labelOf(doc as Record<string, unknown>),
          path: f.path,
          value: f.value,
        });
      }
    }
  }

  // ── report ────────────────────────────────────────────────────────────────
  const byCollection = new Map<string, Hit[]>();
  for (const h of hits) {
    const g = byCollection.get(h.collection) ?? [];
    g.push(h);
    byCollection.set(h.collection, g);
  }

  console.log(`\nEm dashes in stored content\n${"═".repeat(60)}`);
  if (!hits.length) console.log("None. Nothing to do.");
  for (const [collection, group] of byCollection) {
    const docs = new Set(group.map((h) => h.id)).size;
    console.log(
      `\n${collection}  ${group.length} field(s) across ${docs} document(s)`,
    );
    for (const h of group) {
      const count = (h.value.match(/—/g) ?? []).length;
      console.log(`  · ${h.label}  [${h.path}]  ×${count}`);
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`TOTAL: ${hits.length} field(s), ${hits.reduce((n, h) => n + (h.value.match(/—/g) ?? []).length, 0)} em dash(es)`);
  if (unknown.length) {
    console.log(
      `\nNot scanned (not in the content list, not excluded): ${unknown.join(", ")}`,
    );
  }
  console.log(
    `Excluded by policy: ${[...EXCLUDED].filter((c) => present.includes(c)).join(", ") || "none present"}`,
  );

  if (jsonPath) {
    writeFileSync(jsonPath, JSON.stringify(hits, null, 2));
    console.log(`\nFull values written to ${jsonPath}`);
  }

  // ── plan the rewrites, and refuse to write a partial fix ───────────────────
  const planned: (Hit & { next: string })[] = [];
  const unresolved: Hit[] = [];
  for (const h of hits) {
    const next = rewrite(h.value);
    if (next === null || next === h.value) unresolved.push(h);
    else planned.push({ ...h, next });
  }

  if (unresolved.length) {
    console.log(`\n${"═".repeat(60)}\nNO RULE for ${unresolved.length} field(s):`);
    for (const h of unresolved) {
      const at = h.value.indexOf("—");
      console.log(
        `  · ${h.collection}/${h.label} [${h.path}]\n      …${h.value.slice(Math.max(0, at - 60), at + 60)}…`,
      );
    }
    console.log("\nAborting — add a rule for each before applying.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n${"═".repeat(60)}\nPlanned rewrites (${planned.length}):`);
  for (const p of planned) {
    console.log(`\n  ${p.collection}/${p.label} [${p.path}]`);
    for (const r of REWRITES) {
      if (p.value.includes(r.from)) {
        console.log(`    -  ${r.from}`);
        console.log(`    +  ${r.to}`);
      }
    }
  }

  if (!apply) {
    console.log("\nSCAN ONLY — nothing written. Re-run with --apply.");
    await mongoose.disconnect();
    return;
  }

  let written = 0;
  for (const p of planned) {
    await db
      .collection(p.collection)
      .updateOne({ _id: new mongoose.Types.ObjectId(p.id) }, {
        $set: { [toDotted(p.path)]: p.next },
      });
    written++;
  }
  console.log(`\n✓ Wrote ${written} field(s).`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
