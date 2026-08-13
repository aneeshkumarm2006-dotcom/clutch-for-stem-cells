/**
 * THROWAWAY — pre-import linter for the 10-clinic batch.
 *
 * The importer's --dry run validates the Zod schema. It does NOT catch the four
 * things that would quietly ship a bad record:
 *   1. a stored seo.metaTitle / metaDescription shadowing lib/clinic-meta
 *   2. an em dash anywhere in the copy (site-wide policy)
 *   3. a content-flags phrase ("cure", "guaranteed", "reverses", ...)
 *   4. a non-Cloudinary image URL, which passes validation then breaks on the page
 * Plus HTML-entity contamination from scraped source pages.
 *
 * Usage:  npx tsx scripts/_lint-batch.ts scripts/<slug>.json [...]
 */
import { readFileSync } from "node:fs";
import { scanContentFlags } from "@/lib/content-flags";

const EM_DASH_RE = /[—–―‒−]/;
const ENTITY_RE = /&(amp|lt|gt|quot|#\d+|nbsp|apos|#x[0-9a-f]+);/i;

/** Walk every string in the object, remembering its path. */
function* strings(node: unknown, path = ""): Generator<[string, string]> {
  if (typeof node === "string") {
    yield [path, node];
  } else if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) yield* strings(v, `${path}[${i}]`);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      yield* strings(v, path ? `${path}.${k}` : k);
    }
  }
}

let problems = 0;

for (const file of process.argv.slice(2)) {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const rows: any[] = Array.isArray(parsed) ? parsed : [parsed];

  for (const c of rows) {
    const label = c.name ?? file;
    const issues: string[] = [];

    // 1. stored meta must not shadow the formula
    for (const [where, seo] of [
      ["seo", c.seo],
      ["reviewsPage.seo", c.reviewsPage?.seo],
      ["costPage.seo", c.costPage?.seo],
    ] as const) {
      if (seo?.metaTitle) issues.push(`${where}.metaTitle is set — must be omitted`);
      if (seo?.metaDescription)
        issues.push(`${where}.metaDescription is set — must be omitted`);
    }

    // 2 + 5. em dashes and HTML entities, anywhere
    for (const [path, value] of strings(c)) {
      if (EM_DASH_RE.test(value)) {
        issues.push(`em dash at ${path}: ${value.slice(0, 80)}`);
      }
      if (ENTITY_RE.test(value)) {
        issues.push(`HTML entity at ${path}: ${value.slice(0, 80)}`);
      }
    }

    // 3. banned efficacy language
    const prose = [...strings(c)].map(([, v]) => v);
    for (const f of scanContentFlags(prose)) {
      issues.push(`flagged phrase "${f.phrase}": …${f.context}…`);
    }

    // 4. images must be Cloudinary
    for (const [where, img] of [
      ["logo", c.logo],
      ["coverImage", c.coverImage],
      ...(c.gallery ?? []).map((g: any, i: number) => [`gallery[${i}]`, g]),
      ...(c.team ?? []).map((t: any, i: number) => [`team[${i}].photo`, t.photo]),
      ["medicalDirector.photo", c.medicalDirector?.photo],
    ] as [string, any][]) {
      if (!img?.url) continue;
      if (!/^https:\/\/res\.cloudinary\.com\//.test(img.url)) {
        issues.push(`${where} is not a Cloudinary URL: ${img.url}`);
      }
      if (!img.alt) issues.push(`${where} has no alt text`);
    }

    // Sanity: sane defaults for an unclaimed real-world listing
    // "draft" is a deliberate hold, not a defect — it is how a record with
    // unverifiable first-party sourcing lands in /admin without going public.
    if (c.status !== "published" && c.status !== "draft") {
      issues.push(`status is "${c.status}"`);
    }
    if (c.tier && c.tier !== "basic") issues.push(`tier is "${c.tier}"`);
    if (c.verification?.isVerified) issues.push("verification.isVerified is true");
    if (c.isClaimed) issues.push("isClaimed is true");
    if (c.externalReviews) issues.push("externalReviews is set (excluded this batch)");
    const hq = (c.locations ?? []).filter((l: any) => l.isHQ);
    if (hq.length !== 1) issues.push(`${hq.length} locations marked isHQ, expected 1`);
    // The batch is US-led, so the HQ must be US. Secondary offices abroad are
    // legitimate (MD Stem Cells has a Dubai site) — only require `region` for
    // the countries whose meta formula actually reads it.
    const REGION_COUNTRIES = new Set(["US", "CA", "AU"]);
    if (hq[0] && hq[0].countryCode !== "US") {
      issues.push(`HQ countryCode is "${hq[0].countryCode}", expected US`);
    }
    for (const l of c.locations ?? []) {
      if (!l.city) issues.push("a location has no city");
      if (REGION_COUNTRIES.has(l.countryCode) && !l.region) {
        issues.push(`location ${l.city} has no region (state)`);
      }
    }
    if (!c.conditionsTreated?.length) issues.push("no conditionsTreated");

    if (issues.length) {
      problems += issues.length;
      console.log(`\n✗ ${label}`);
      for (const i of issues) console.log(`    ${i}`);
    } else {
      console.log(
        `✓ ${label}  (${c.conditionsTreated.length} conditions, lead "${c.conditionsTreated[0]}")`,
      );
    }
  }
}

console.log(
  `\n${problems === 0 ? "LINT CLEAN" : `${problems} problem(s) — fix before importing`}`,
);
process.exit(problems === 0 ? 0 : 1);
