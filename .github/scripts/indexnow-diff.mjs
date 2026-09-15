/**
 * Sitemap diff → IndexNow submission. Run by .github/workflows/indexnow.yml.
 *
 * Fetches production's sitemap.xml, compares every <loc>/<lastmod> pair against
 * the snapshot cached by the previous run, and submits only what is new or
 * newly modified. Plain Node with native fetch — no dependencies, so the job
 * needs no install step.
 *
 * Deliberate behaviours:
 *
 *   * The FIRST run (no snapshot) submits nothing and just seeds the snapshot.
 *     Otherwise enabling this workflow would fire the entire site at the
 *     engines from CI as a surprise. The one-time backfill is a deliberate,
 *     local act: `npm run indexnow:ping -- --all`. `workflow_dispatch` with
 *     `submit_all` does it from CI when that is what you want.
 *
 *   * app/sitemap.ts stamps the static marketing routes with render time rather
 *     than a content timestamp, so those ~35 URLs look "modified" whenever the
 *     date rolls over and are re-submitted about once a day. That is cheap and
 *     harmless next to the alternative of ignoring <lastmod> and missing real
 *     edits to record-backed pages, whose timestamps are genuine `updatedAt`
 *     values.
 *
 *   * Failure is loud but partial: a rejected batch fails the job so the run
 *     goes red, and the snapshot is still written for the batches that
 *     succeeded, so a transient error does not cause a permanent re-submit
 *     loop.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS_PER_REQUEST = 10_000;
const CACHE_DIR = ".indexnow-cache";
const SNAPSHOT = `${CACHE_DIR}/sitemap.json`;

const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const KEY = (process.env.INDEXNOW_KEY ?? "").trim();
const SUBMIT_ALL = process.env.SUBMIT_ALL === "true";

if (!SITE_URL || !KEY) {
  console.log("SITE_URL or INDEXNOW_KEY missing; nothing to do.");
  process.exit(0);
}

/** `{ "<loc>": "<lastmod>" }` for every URL the sitemap lists. */
async function fetchSitemap() {
  const target = `${SITE_URL}/sitemap.xml`;
  const res = await fetch(target, {
    headers: { "user-agent": "indexnow-diff (github-actions)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`GET ${target} -> ${res.status}`);
  const xml = await res.text();

  const entries = {};
  // One <url> element at a time, so a <lastmod> is paired with its own <loc>
  // rather than with whichever happens to follow it in the document.
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc) continue;
    entries[loc] =
      block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? "";
  }

  // A sitemap index (no <url> blocks) means the shape changed and this diff
  // would silently submit nothing. Fail rather than pretend.
  if (!Object.keys(entries).length) {
    throw new Error(
      `${target} listed no <url> entries. If it is now a sitemap index, this script needs to follow it.`,
    );
  }
  return entries;
}

async function readSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT, "utf8"));
  } catch {
    return null;
  }
}

async function writeSnapshot(entries) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(SNAPSHOT, JSON.stringify(entries), "utf8");
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function submit(urlList, host) {
  const keyLocation = `https://${host}/${KEY}.txt`;
  let failed = 0;

  for (const batch of chunk(urlList, MAX_URLS_PER_REQUEST)) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: KEY, keyLocation, urlList: batch }),
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`Submitted ${batch.length} URL(s) (HTTP ${res.status}).`);
      continue;
    }

    failed += 1;
    if (res.status === 403 || res.status === 422) {
      console.log(
        `::error::IndexNow rejected the key (HTTP ${res.status}). Check that ${keyLocation} ` +
          `is reachable and contains exactly the INDEXNOW_KEY secret.`,
      );
    } else {
      console.log(
        `::error::IndexNow returned HTTP ${res.status} for ${batch.length} URL(s).`,
      );
    }
  }
  return failed;
}

const current = await fetchSitemap();
const previous = await readSnapshot();
const locs = Object.keys(current);

// Host comes from the sitemap's own URLs, which are absolute against the
// deployment's NEXT_PUBLIC_SITE_URL — i.e. the canonical host, whatever
// hostname this job happened to fetch from.
const host = new URL(locs[0]).host;

let changed;
if (!previous) {
  changed = [];
  console.log(
    `Seeded snapshot with ${locs.length} URL(s). Nothing submitted on a first run — ` +
      `use \`npm run indexnow:ping -- --all\` for the initial backfill.`,
  );
} else if (SUBMIT_ALL) {
  changed = locs;
  console.log(`submit_all requested: submitting all ${locs.length} URL(s).`);
} else {
  changed = locs.filter((loc) => previous[loc] !== current[loc]);
  const added = locs.filter((loc) => !(loc in previous)).length;
  const removed = Object.keys(previous).filter(
    (loc) => !(loc in current),
  ).length;
  console.log(
    `Sitemap: ${locs.length} URL(s). Changed since last run: ${changed.length} ` +
      `(${added} new, ${changed.length - added} modified). ` +
      `${removed} dropped from the sitemap.`,
  );
  // A URL that left the sitemap is deliberately NOT submitted: it is either
  // gone (the route already pinged it on delete/unpublish) or newly noindexed,
  // and submitting a noindex URL wastes the signal.
}

let failed = 0;
if (changed.length) {
  for (const url of changed.slice(0, 25)) console.log(`  ${url}`);
  if (changed.length > 25) console.log(`  … ${changed.length - 25} more`);
  failed = await submit(changed, host);
} else if (previous) {
  console.log("No changes to submit.");
}

await writeSnapshot(current);

if (failed) process.exit(1);
