/**
 * Google Places → `externalReviews` research file.
 *
 *   GOOGLE_PLACES_API_KEY=... npx tsx scripts/fetch-google-reviews.ts --out scripts/clinic-reputation.json
 *   GOOGLE_PLACES_API_KEY=... npx tsx scripts/fetch-google-reviews.ts --slug thrivemd --top 3
 *
 * Resolves each clinic to a Google place, pulls the listing rating and the
 * reviews Google itself ranks as most relevant, and writes a file in the shape
 * `import-clinic-reputation` already accepts. It does NOT touch the database —
 * fetch, read the file, then import. Two commands, with a human in between,
 * because these quotes go out under real people's names.
 *
 * Uses Places API (New). The key needs "Places API (New)" enabled and should be
 * restricted to it. `NEXT_PUBLIC_MAPS_API_KEY` is deliberately NOT read: that
 * one is public by definition (it ships to the browser) and a key that can pull
 * Place Details should never be.
 *
 * Three things worth knowing before running it:
 *
 *  1. **Google returns at most 5 reviews per place, and won't paginate.** There
 *     is no supported way to get the 6th. `--top` can lower that, never raise
 *     it. Anyone who tells you otherwise is describing a scraper.
 *  2. **Places terms cap caching of review content at 30 days.** Whatever this
 *     writes goes stale on a deadline. Re-run it monthly or drop the quotes.
 *  3. **A place match is a guess until the domain confirms it.** Two clinics
 *     with similar names in the same city is the normal case, not the edge one,
 *     so a listing whose `websiteUri` doesn't match the clinic's own domain is
 *     reported and skipped rather than written on a maybe.
 *
 * The existing `summary`, `themes` and the whole `reddit` branch are carried
 * over from what's already stored, because the importer replaces
 * `externalReviews` wholesale — emitting only the Google half would silently
 * wipe every Reddit summary on the site.
 *
 * Note: if your Node can't resolve the MongoDB SRV record, set
 *   SCRIPT_DNS=8.8.8.8,1.1.1.1   before running. Otherwise leave it unset.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import { dbConnect } from "@/lib/db";
import { findFlaggedPhrases } from "@/lib/content-flags";
import { Clinic } from "@/models";

const PLACES_ROOT = "https://places.googleapis.com/v1";

/** Schema cap in `models/clinic.ts`. Longer quotes are trimmed, not rejected. */
const MAX_QUOTE = 600;

interface PlaceReview {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string };
  publishTime?: string;
  googleMapsUri?: string;
}

interface PlaceDetails {
  id?: string;
  displayName?: { text?: string };
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: PlaceReview[];
}

/** Bare hostname, so "https://www.thrivemdclinic.com/x" and "thrivemdclinic.com" compare equal. */
function host(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Same registrable domain, allowing one to be a subdomain of the other.
 * `clinic.example.com` and `example.com` are the same operator; `example.com`
 * and `example.net` are not, whatever the names on the listings say.
 */
function sameDomain(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/** Trim to the schema cap at a word boundary, marking the cut. */
function clip(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_QUOTE) return t;
  const cut = t.slice(0, MAX_QUOTE - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > MAX_QUOTE * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

async function places<T>(
  path: string,
  fieldMask: string,
  key: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${PLACES_ROOT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(
      `${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

/** Best-guess place for a clinic, by name + address. Unverified until the domain agrees. */
async function findPlace(
  query: string,
  key: string,
): Promise<PlaceDetails | null> {
  const data = await places<{ places?: PlaceDetails[] }>(
    "/places:searchText",
    "places.id,places.displayName,places.websiteUri",
    key,
    {
      method: "POST",
      body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    },
  );
  return data.places?.[0] ?? null;
}

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());

  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.error(
      "GOOGLE_PLACES_API_KEY is not set.\n" +
        'Create a key at console.cloud.google.com with "Places API (New)" enabled,\n' +
        "then re-run. Do not reuse NEXT_PUBLIC_MAPS_API_KEY — it ships to the browser.",
    );
    process.exit(1);
  }

  const top = Math.min(Number(flag("top") ?? 3), 5);
  const only = flag("slug");
  const out = resolve(
    process.cwd(),
    flag("out") ?? "scripts/clinic-reputation.fetched.json",
  );

  await dbConnect();
  const clinics = await Clinic.find({
    isDeleted: { $ne: true },
    ...(only ? { slug: only } : {}),
  })
    .select("name slug website locations externalReviews")
    .sort({ name: 1 })
    .lean();

  console.log(
    `Fetching Google reviews for ${clinics.length} clinic(s), top ${top} each.\n`,
  );

  const records: unknown[] = [];
  let matched = 0;
  let skipped = 0;

  for (const c of clinics) {
    const hq =
      (c.locations ?? []).find((l) => l.isHQ) ?? (c.locations ?? [])[0];
    const address = [hq?.addressLine, hq?.city, hq?.region, hq?.country]
      .filter(Boolean)
      .join(", ");
    const query = `${c.name} ${address}`.trim();

    let place: PlaceDetails | null = null;
    try {
      place = await findPlace(query, key);
    } catch (err) {
      console.log(`✗ ${c.slug}: search failed → ${(err as Error).message}`);
      skipped++;
      continue;
    }

    if (!place?.id) {
      console.log(`✗ ${c.slug}: no place found for "${query}"`);
      skipped++;
      continue;
    }

    // Domain check before spending a Details call, and before trusting a name.
    const clinicHost = host(c.website);
    const placeHost = host(place.websiteUri);
    if (!sameDomain(clinicHost, placeHost)) {
      console.log(
        `✗ ${c.slug}: domain mismatch — listing "${place.displayName?.text ?? "?"}" ` +
          `is ${placeHost ?? "no site"}, clinic is ${clinicHost ?? "no site"}`,
      );
      skipped++;
      continue;
    }

    let details: PlaceDetails;
    try {
      details = await places<PlaceDetails>(
        `/places/${place.id}`,
        "id,displayName,rating,userRatingCount,googleMapsUri,reviews",
        key,
      );
    } catch (err) {
      console.log(`✗ ${c.slug}: details failed → ${(err as Error).message}`);
      skipped++;
      continue;
    }

    const highlights = (details.reviews ?? [])
      .map((r) => {
        const body = r.text?.text ?? r.originalText?.text ?? "";
        const author = r.authorAttribution?.displayName ?? "";
        if (!body.trim() || !author.trim()) return null;
        return {
          author: author.trim(),
          rating: r.rating,
          text: clip(body),
          publishedAt: r.publishTime ?? null,
          url: r.googleMapsUri ?? details.googleMapsUri,
        };
      })
      .filter(Boolean)
      .slice(0, top) as { author: string; text: string }[];

    // Warn, don't drop. The importer's compliance gate is the actual authority;
    // surfacing it here just saves a round trip when a quote won't make it.
    const flags = findFlaggedPhrases(highlights.map((h) => h.text));
    if (flags.length) {
      console.log(
        `  ! ${c.slug}: quote(s) contain flagged terms (${[...new Set(flags)].join(", ")}) — ` +
          "import will reject this record until you swap or drop them",
      );
    }

    const existing =
      (c as { externalReviews?: Record<string, unknown> }).externalReviews ??
      {};
    const existingGoogle = (existing.google ?? {}) as Record<string, unknown>;

    records.push({
      slug: c.slug,
      externalReviews: {
        ...existing,
        google: {
          ...existingGoogle,
          rating: details.rating ?? existingGoogle.rating,
          reviewCount: details.userRatingCount ?? existingGoogle.reviewCount,
          url: details.googleMapsUri ?? existingGoogle.url,
          highlights,
          checkedAt: new Date().toISOString().slice(0, 10),
        },
      },
    });

    matched++;
    console.log(
      `✓ ${c.slug}: ${details.rating ?? "?"}★ (${details.userRatingCount ?? "?"}), ` +
        `${highlights.length} quote(s)`,
    );
  }

  writeFileSync(out, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  console.log(
    `\nWrote ${matched} record(s) to ${out} (${skipped} skipped).\n` +
      "Nothing has been written to the database. Read the file, then:\n" +
      `  npm run import-clinic-reputation -- ${flag("out") ?? "scripts/clinic-reputation.fetched.json"} --dry`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
