/**
 * Off-site reception importer.
 *
 * Reads a JSON file of `{ slug, externalReviews }` records — the Google listing
 * figures and Reddit discussion summary shown on `/clinic/[slug]/reviews` — and
 * writes each one through the SAME validated path the admin edit form uses:
 * `clinicUpdateSchema` → `findOne` → `clinic.set()` → `save()` → a
 * `clinic.update` audit entry attributed to a real admin.
 *
 *   npm run import-clinic-reputation -- scripts/clinic-reputation.json --dry
 *   npm run import-clinic-reputation -- scripts/clinic-reputation.json
 *
 * `externalReviews` is replaced wholesale, not merged. It is one research pass
 * with one date on it, and half-merging a fresh Google rating onto a stale
 * Reddit summary would produce a record whose `checkedAt` lies about part of
 * itself.
 *
 * Deliberately NOT recomputed here: `sortScore`. A third-party rating must not
 * move a clinic up the directory — ranking runs on reviews this site collected
 * and moderated, and letting an unaudited Google average feed it would make the
 * listing order gameable by whoever buys the most Google reviews.
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
import { recordAudit } from "@/lib/audit";
import { clinicUpdateSchema } from "@/lib/validation/clinic";
import { findFlaggedPhrases } from "@/lib/content-flags";
import { Clinic, User } from "@/models";

/** A record as it comes off the JSON file, before Zod has looked at it. */
type ReputationRecord = Record<string, unknown> & {
  slug?: string;
  externalReviews?: {
    google?: Record<string, unknown> & { highlights?: unknown[] };
    reddit?: Record<string, unknown>;
  };
};

const strings = (v: unknown[]): string[] =>
  v.filter((s): s is string => typeof s === "string" && s.trim().length > 0);

/**
 * Every string a record renders in OUR editorial voice.
 *
 * Themes are included alongside the summaries. They are the one place a claim
 * can slip in unnoticed — "cures arthritis" is just as much a medical claim as
 * a chip as it is in a sentence, and summarising someone else's post does not
 * make the claim ours to publish unqualified.
 *
 * Google `highlights` are deliberately absent: they are quoted, not authored,
 * and the gates that apply to them differ. See {@link quotedOf}.
 */
function proseOf(record: ReputationRecord): string[] {
  const ext = record.externalReviews ?? {};
  const branch = (b: Record<string, unknown> | undefined): unknown[] => {
    if (!b) return [];
    const themes = Array.isArray(b.themes) ? b.themes : [];
    const sources = Array.isArray(b.sources) ? b.sources : [];
    return [
      b.summary,
      ...themes,
      ...sources.map((s) =>
        s && typeof s === "object"
          ? (s as Record<string, unknown>).label
          : undefined,
      ),
    ];
  };

  return strings([...branch(ext.google), ...branch(ext.reddit)]);
}

/**
 * Verbatim reviewer text, which gets one gate rather than two.
 *
 * The compliance scan still applies. A reviewer writing "this cured my MS" is
 * an unqualified medical claim on a clinic page whoever typed it, and the fix
 * is for an editor to quote a different review, not to publish it and hope.
 *
 * The em/en dash gate does NOT apply, and that is the one deliberate exception
 * to the site-wide rule in `lib/meta-text.ts`. Every other string on the site
 * is ours to rewrite; a quote is not. Stripping a dash out of someone's
 * sentence and leaving their real name under it is the worse of the two
 * problems, so the dash stays.
 */
function quotedOf(record: ReputationRecord): string[] {
  const raw = record.externalReviews?.google?.highlights;
  if (!Array.isArray(raw)) return [];
  return strings(
    raw.map((h) =>
      h && typeof h === "object"
        ? (h as Record<string, unknown>).text
        : undefined,
    ),
  );
}

/** One-line description of what a record actually carries, for the log. */
function describe(ext: ReputationRecord["externalReviews"]): string {
  const parts: string[] = [];
  const g = ext?.google;
  const quotes = Array.isArray(g?.highlights) ? g.highlights.length : 0;
  const quoteNote = quotes ? `, ${quotes} quote(s)` : "";
  if (g?.rating != null) {
    parts.push(`Google ${g.rating}★ (${g.reviewCount ?? "?"})${quoteNote}`);
  } else if (g?.summary) {
    parts.push(`Google prose only${quoteNote}`);
  } else {
    parts.push("no Google");
  }

  const r = ext?.reddit;
  if (r?.summary) {
    const threads = Array.isArray(r.sources) ? r.sources.length : 0;
    parts.push(`Reddit ${r.sentiment ?? "unrated"} (${threads} thread(s))`);
  } else {
    parts.push("no Reddit");
  }
  return parts.join(", ");
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

  const file = resolve(
    process.cwd(),
    fileArg ?? "scripts/clinic-reputation.json",
  );
  let rows: ReputationRecord[];
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
    `\n${dry ? "DRY RUN — " : ""}Importing off-site reception for ${rows.length} clinic(s) from ${file}\n`,
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
    if (raw.externalReviews === undefined) {
      console.log(`✗ ${label}: no externalReviews block`);
      failed++;
      continue;
    }

    const prose = proseOf(raw);
    const quoted = quotedOf(raw);

    // Compliance gate (PRD §8): the same cure/guarantee scan the admin panel
    // runs, applied here because a machine-authored batch never sees that UI.
    // Quotes are scanned too — see `quotedOf`.
    const flags = findFlaggedPhrases([...prose, ...quoted]);
    if (flags.length) {
      const terms = [...new Set(flags)].join(", ");
      console.log(`✗ ${label}: content flags → ${terms}`);
      failed++;
      continue;
    }

    // Site-wide copy rule (`lib/meta-text.ts`): no em or en dash in rendered
    // text. Summarising models reach for one constantly, so this is the gate
    // that fires most often on a machine-authored batch. Rejecting rather than
    // silently rewriting is deliberate: a stripped dash usually leaves a comma
    // splice behind, and the generator is what needs correcting.
    const dashed = prose.filter((s) => /[—–]/.test(s));
    if (dashed.length) {
      console.log(
        `✗ ${label}: em/en dash in copy → "${dashed[0].slice(0, 80)}"`,
      );
      failed++;
      continue;
    }

    const parsed = clinicUpdateSchema.safeParse({
      externalReviews: raw.externalReviews,
    });
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

    const summary = describe(raw.externalReviews);

    if (dry) {
      console.log(`✓ ${label}: valid — ${summary} — not written`);
      updated++;
      continue;
    }

    const before = {
      googleRating: clinic.externalReviews?.google?.rating,
      redditThreads: clinic.externalReviews?.reddit?.sources?.length ?? 0,
    };

    clinic.set(parsed.data);
    await clinic.save();
    await recordAudit({
      actorUserId: actor?._id ?? null,
      action: "clinic.update",
      entityType: "Clinic",
      entityId: clinic._id,
      before,
      after: {
        googleRating: clinic.externalReviews?.google?.rating,
        redditThreads: clinic.externalReviews?.reddit?.sources?.length ?? 0,
      },
    });

    console.log(`✓ ${label}: ${summary} → /clinic/${clinic.slug}/reviews`);
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
